export function isAuthorizedWebhookRequest(input: {
  headers: {
    authorization?: string | null;
    xHeliusWebhookSecret?: string | null;
    xApiKey?: string | null;
  };
  secret: string;
}): boolean {
  const expected = input.secret.trim();
  if (!expected) return false;

  const candidates = [
    input.headers.authorization,
    input.headers.xHeliusWebhookSecret,
    input.headers.xApiKey,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());

  return candidates.some((value) => value === expected || value === `Bearer ${expected}`);
}
