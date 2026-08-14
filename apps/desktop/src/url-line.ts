/**
 * The stable `dsh web: http://127.0.0.1:<port>` line the web-app bundle prints
 * after its Loader tree settles. It is the only readiness signal the shell
 * trusts: a line means the whole tree settled and the server bound its port.
 */
const URL_LINE = /^dsh web: (https?:\/\/\S+)/

/**
 * Extract the canonical loopback URL from one sidecar stdout line.
 * @param line - one raw stdout line, possibly with trailing whitespace or the LAN suffix.
 * @returns the URL, or undefined when the line is not the announcement.
 */
export function parseUrlLine(line: string): string | undefined {
  return URL_LINE.exec(line.trim())?.[1]
}
