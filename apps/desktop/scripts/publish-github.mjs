/**
 * GitHub publish helper for the desktop release.
 *
 * Runs the two network steps that cannot use curl on this machine (the
 * sandboxed schannel stack lacks credentials; Node's OpenSSL stack works):
 *   ensure-repo — create the public repository if it does not exist
 *   release     — create a tagged release and upload the installer asset
 *
 * The HTTP exchange is written raw over a CONNECT-tunneled TLS socket:
 * node's http module misbehaves on a pre-wrapped socket, while the raw path
 * is deterministic and dependency-free. Secrets stay out of files and
 * history: the token is read from DSH_GITHUB_TOKEN only. The proxy is
 * DSH_PUBLISH_PROXY (default http://127.0.0.1:10808); clear it to go direct.
 * Everything else (git init, commit, push) is plain git with
 * `http.sslBackend=openssl`.
 */
import net from 'node:net'
import tls from 'node:tls'
import { createReadStream, statSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const token = process.env.DSH_GITHUB_TOKEN
if (token === undefined || token === '') {
  console.error('publish-github: DSH_GITHUB_TOKEN is required (never committed; revoke after use)')
  process.exit(1)
}
const proxy = process.env.DSH_PUBLISH_PROXY ?? 'http://127.0.0.1:10808'
const proxyUrl = new URL(proxy)
const API_HOST = 'api.github.com'
const UPLOAD_HOST = 'uploads.github.com'

/** Parse one HTTP response stream into {status, body} (Content-Length or chunked). */
function readResponse(socket) {
  return new Promise((resolvePromise, rejectPromise) => {
    let buf = Buffer.alloc(0)
    let headerEnd = -1
    let status = 0
    let contentLength = -1
    let chunked = false
    const bodyChunks = []
    const tryParse = () => {
      if (headerEnd === -1) return
      if (chunked) {
        while (true) {
          const lineEnd = buf.indexOf('\r\n', headerEnd)
          if (lineEnd === -1) return
          const sizeText = buf.slice(headerEnd, lineEnd).toString('latin1').split(';')[0].trim()
          const size = parseInt(sizeText, 16)
          if (Number.isNaN(size)) { rejectPromise(new Error(`bad chunk size ${sizeText}`)); return }
          if (size === 0) { resolvePromise({ status, body: Buffer.concat(bodyChunks) }); return }
          if (buf.length < lineEnd + 2 + size + 2) return
          bodyChunks.push(buf.slice(lineEnd + 2, lineEnd + 2 + size))
          headerEnd = lineEnd + 2 + size + 2
        }
      }
      if (contentLength !== -1 && buf.length >= headerEnd + contentLength) {
        resolvePromise({ status, body: buf.slice(headerEnd, headerEnd + contentLength) })
      }
    }
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      if (headerEnd === -1) {
        const idx = buf.indexOf('\r\n\r\n')
        if (idx === -1) return
        headerEnd = idx + 4
        const headText = buf.slice(0, idx).toString('latin1')
        const statusMatch = /^HTTP\/\S+\s+(\d+)/.exec(headText)
        status = statusMatch === null ? 0 : Number(statusMatch[1])
        for (const line of headText.split('\r\n').slice(1)) {
          const lower = line.toLowerCase()
          if (lower.startsWith('content-length:')) contentLength = Number(line.split(':', 2)[1].trim())
          if (lower.startsWith('transfer-encoding:') && lower.includes('chunked')) chunked = true
        }
      }
      tryParse()
    })
    socket.on('end', () => {
      if (headerEnd === -1) {
        rejectPromise(new Error('connection closed before response headers'))
      } else if (contentLength === -1 && !chunked) {
        resolvePromise({ status, body: buf.slice(headerEnd) })
      }
    })
    socket.on('error', rejectPromise)
    socket.setTimeout(120_000, () => rejectPromise(new Error('response timed out')))
  })
}

/** One raw HTTPS request through the CONNECT proxy; resolves {status, body}. */
function request(host, method, path, headers, body) {
  return new Promise((resolvePromise, rejectPromise) => {
    const plain = net.connect(Number(proxyUrl.port), proxyUrl.hostname, () => {
      plain.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`)
    })
    plain.setTimeout(60_000, () => { plain.destroy() })
    let head = ''
    const onData = (chunk) => {
      head += chunk.toString('latin1')
      const idx = head.indexOf('\r\n\r\n')
      if (idx === -1) return
      plain.removeListener('data', onData)
      const statusLine = head.slice(0, idx).split('\r\n')[0]
      if (!statusLine.includes('200')) {
        plain.destroy()
        rejectPromise(new Error(`proxy CONNECT rejected: ${statusLine}`))
        return
      }
      const rest = Buffer.from(head.slice(idx + 4), 'latin1')
      const socket = tls.connect({ socket: plain, servername: host }, () => {
        const lines = [`${method} ${path} HTTP/1.1`, `Host: ${host}`, 'Connection: close']
        for (const [key, value] of Object.entries(headers)) lines.push(`${key}: ${value}`)
        socket.write(`${lines.join('\r\n')}\r\n\r\n`)
        if (body !== undefined) socket.write(body)
        readResponse(socket).then(resolvePromise, rejectPromise)
      })
      socket.on('error', rejectPromise)
      if (rest.length > 0) plain.unshift(rest)
    }
    plain.on('data', onData)
    plain.on('error', rejectPromise)
  })
}

/** JSON API call with the bearer token. */
async function api(method, path, body) {
  const headers = {
    Authorization: `token ${token}`,
    'User-Agent': 'dsh-desktop-publish',
    Accept: 'application/vnd.github+json',
  }
  let encoded
  if (body !== undefined) {
    encoded = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(Buffer.byteLength(encoded))
  }
  const res = await request(API_HOST, method, path, headers, encoded)
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GitHub API ${method} ${path} -> ${res.status}: ${res.body.toString('utf8').slice(0, 400)}`)
  }
  return res
}

const command = process.argv[2]

if (command === 'ensure-repo') {
  const name = process.argv[3]
  const description = process.argv[4]
  if (name === undefined || description === undefined) {
    console.error('usage: publish-github.mjs ensure-repo <name> <description>')
    process.exit(1)
  }
  const me = JSON.parse((await api('GET', '/user')).body.toString('utf8'))
  const owner = me.login
  console.log(`owner=${owner}`)
  const existing = await request(API_HOST, 'GET', `/repos/${owner}/${name}`, {
    Authorization: `token ${token}`,
    'User-Agent': 'dsh-desktop-publish',
  })
  if (existing.status === 200) {
    console.log(`repo already exists: ${owner}/${name}`)
  } else {
    await api('POST', '/user/repos', {
      name,
      description,
      homepage: `https://github.com/${owner}/${name}`,
      private: false,
      has_issues: true,
    })
    console.log(`repo created: ${owner}/${name}`)
  }
  process.exit(0)
}

if (command === 'release') {
  const repo = process.argv[3]
  const tag = process.argv[4]
  const assetPath = process.argv[5]
  if (repo === undefined || tag === undefined || assetPath === undefined) {
    console.error('usage: publish-github.mjs release <owner/repo> <tag> <asset>')
    process.exit(1)
  }
  const asset = resolve(assetPath)
  const size = statSync(asset).size
  let releaseId
  try {
    const create = await api('POST', `/repos/${repo}/releases`, {
      tag_name: tag,
      name: `DeepSeek Harness Desktop ${tag}`,
      body: 'Windows x64 安装包(双击即用)。详见 README。',
      draft: false,
      prerelease: tag.includes('-rc'),
    })
    releaseId = JSON.parse(create.body.toString('utf8')).id
  } catch {
    const found = await api('GET', `/repos/${repo}/releases/tags/${tag}`)
    releaseId = JSON.parse(found.body.toString('utf8')).id
  }
  console.log(`release id=${releaseId}, uploading ${asset} (${(size / 1024 / 1024).toFixed(1)} MB)`)
  const chunks = []
  for await (const chunk of createReadStream(asset)) chunks.push(chunk)
  const upload = await request(
    UPLOAD_HOST,
    'POST',
    `/repos/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(basename(asset))}`,
    {
      Authorization: `token ${token}`,
      'User-Agent': 'dsh-desktop-publish',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(size),
    },
    Buffer.concat(chunks),
  )
  if (upload.status < 200 || upload.status >= 300) {
    throw new Error(`asset upload -> ${upload.status}: ${upload.body.toString('utf8').slice(0, 400)}`)
  }
  console.log(`asset uploaded: ${JSON.parse(upload.body.toString('utf8')).browser_download_url}`)
  process.exit(0)
}

console.error(`publish-github: unknown command ${command}`)
process.exit(1)
