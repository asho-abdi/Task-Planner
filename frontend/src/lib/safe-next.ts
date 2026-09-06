const ALLOWED_PREFIXES = ["/invite/", "/workspace/create", "/app"];

export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  if (ALLOWED_PREFIXES.some((prefix) => next === prefix || next.startsWith(prefix))) {
    return next;
  }
  return null;
}
