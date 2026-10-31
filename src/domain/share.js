/**
 * Helpers for temporary share sessions (doctor viewing links).
 * The share token travels in the URL hash fragment (#share=...), which is
 * never sent to servers in HTTP requests or referrer headers.
 */

/** Extract the share token from a location hash string, or return "". */
export function parseShareToken(hash) {
  if (!hash) {
    return "";
  }
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of fragment.split("&")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq) === "share") {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return "";
}

/** Build the URL a doctor opens: the app base plus the share fragment. */
export function buildShareUrl(baseUrl, token) {
  return `${baseUrl}#share=${encodeURIComponent(token)}`;
}

/** Whole seconds until the session expires; null when the date is invalid. */
export function shareSecondsLeft(expiresAt, nowMs) {
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) {
    return null;
  }
  return Math.max(0, Math.ceil((expiresMs - nowMs) / 1000));
}

/** Human label such as "残り約30分" / "残り約1分未満" / "期限切れ". */
export function formatShareRemaining(seconds) {
  if (seconds === null) {
    return "";
  }
  if (seconds <= 0) {
    return "期限切れ";
  }
  if (seconds < 60) {
    return "残り約1分未満";
  }
  return `残り約${Math.ceil(seconds / 60)}分`;
}
