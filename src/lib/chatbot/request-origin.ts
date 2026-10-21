export function isSameOriginRequest(request: { headers: Headers; nextUrl: { origin: string; protocol: string } }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
    if (parsed.origin === request.nextUrl.origin) return true;
    // Next's development URL can be canonicalized to localhost although the
    // browser used 127.0.0.1. Host is browser-controlled, unlike forwarded-host
    // headers; compare its full origin, including scheme and normalized port.
    if (!host || /[\s/\\@,?#]/.test(host)) return false;
    return parsed.origin === new URL(`${request.nextUrl.protocol}//${host}`).origin;
  } catch { return false; }
}
