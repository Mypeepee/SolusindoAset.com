/** Keep email deep links after sign-in, accepting only this site's own URLs. */
export function signInReturnUrl(currentHref: string): string {
  const current = new URL(currentHref);
  const requested = current.searchParams.get("callbackUrl");
  if (requested) {
    try {
      const target = new URL(requested, current.origin);
      if (
        target.origin === current.origin &&
        target.pathname.replace(/\/+$/, "") !== "/signin"
      )
        return target.toString();
    } catch {
      /* Ignore invalid or cross-origin destinations. */
    }
  }
  return current.pathname.replace(/\/+$/, "") === "/signin"
    ? new URL("/dashboard", current.origin).toString()
    : current.toString();
}
