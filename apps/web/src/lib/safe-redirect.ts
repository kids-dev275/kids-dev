/**
 * Validates and normalizes internal redirect paths.
 * Prevents open-redirect attacks by ensuring the path begins with a single '/'
 * and does not contain protocol specifiers, double slashes, or backslashes.
 */
export function getSafeNextUrl(rawNext: string | null | undefined, fallback = "/account"): string {
  if (!rawNext) return fallback;
  const trimmed = rawNext.trim();
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\") &&
    !trimmed.includes(":")
  ) {
    return trimmed;
  }
  return fallback;
}
