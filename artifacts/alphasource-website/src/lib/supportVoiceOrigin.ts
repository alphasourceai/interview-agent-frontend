// Separate allowlists prevent a dev build from opening a staging voice session.
export function supportVoiceOrigin(
  raw: unknown,
  environment: unknown,
): string | null {
  const expected =
    environment === "development"
      ? "https://interview-agent-backend-qa.onrender.com"
      : environment === "staging" || environment == null || environment === ""
        ? "https://ia-backend-qa.onrender.com"
        : null;
  if (!expected || raw !== expected) return null;
  try {
    const url = new URL(String(raw));
    return url.protocol === "https:" &&
      url.origin === raw &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
      ? expected
      : null;
  } catch {
    return null;
  }
}
