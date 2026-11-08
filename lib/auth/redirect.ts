/** Accepts only same-origin relative paths; anything else falls back. */
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    /[\u0000-\u001f\u007f\s]/.test(next)
  ) {
    return fallback;
  }
  return next;
}
