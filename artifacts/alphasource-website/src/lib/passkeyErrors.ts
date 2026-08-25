type PasskeyErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  cause?: unknown;
};

const CANCELLATION_NAMES = new Set(["AbortError", "NotAllowedError"]);
const CANCELLATION_CODES = new Set([
  "ERROR_CEREMONY_ABORTED",
  "PASSKEY_CANCELLED",
  "PASSKEY_CANCELED",
  "WEBAUTHN_CEREMONY_ABORTED",
]);

function errorChain(error: unknown): PasskeyErrorLike[] {
  const chain: PasskeyErrorLike[] = [];
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth += 1) {
    const item = current as PasskeyErrorLike;
    chain.push(item);
    current = item.cause;
  }
  return chain;
}

export function isPasskeyCancellation(error: unknown): boolean {
  return errorChain(error).some((item) => {
    const name = String(item.name || "").trim();
    const code = String(item.code || "").trim().toUpperCase();
    const message = String(item.message || "").trim();
    return CANCELLATION_NAMES.has(name)
      || CANCELLATION_CODES.has(code)
      || /\b(?:cancelled|canceled|ceremony was (?:sent an )?abort signal)\b/i.test(message);
  });
}

export function passkeyFailureMessage(error: unknown, fallback: string): string {
  for (const item of errorChain(error)) {
    const message = String(item.message || "").trim();
    if (message) return message;
  }
  return fallback;
}
