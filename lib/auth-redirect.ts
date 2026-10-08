export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/";
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith("/") ||
      decoded.startsWith("//") ||
      /[\\\x00-\x1f]/.test(decoded) ||
      decoded.startsWith("/api/") ||
      decoded.startsWith("/login")
    )
      return "/";
    const url = new URL(value, "https://inventory.invalid");
    return url.origin === "https://inventory.invalid"
      ? url.pathname + url.search
      : "/";
  } catch {
    return "/";
  }
}
