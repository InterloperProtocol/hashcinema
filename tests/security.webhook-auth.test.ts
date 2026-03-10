import { isAuthorizedWebhookRequest } from "@/lib/security/webhook-auth";

describe("webhook auth guardrails", () => {
  it("accepts matching bearer token", () => {
    const authorized = isAuthorizedWebhookRequest({
      headers: {
        authorization: "Bearer secret-123",
        xHeliusWebhookSecret: null,
        xApiKey: null,
      },
      secret: "secret-123",
    });

    expect(authorized).toBe(true);
  });

  it("accepts matching raw token in custom header", () => {
    const authorized = isAuthorizedWebhookRequest({
      headers: {
        authorization: null,
        xHeliusWebhookSecret: "secret-123",
        xApiKey: null,
      },
      secret: "secret-123",
    });

    expect(authorized).toBe(true);
  });

  it("rejects mismatched tokens", () => {
    const authorized = isAuthorizedWebhookRequest({
      headers: {
        authorization: "Bearer wrong",
        xHeliusWebhookSecret: null,
        xApiKey: null,
      },
      secret: "secret-123",
    });

    expect(authorized).toBe(false);
  });
});
