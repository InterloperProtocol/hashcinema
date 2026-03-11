import { beforeEach, describe, expect, it, vi } from "vitest";

const PAYMENT_ADDRESS = "D1CRgh1Ty3yjDwN9CkwtsRWKmsmKQ2BbRbtKvCTfAN8Z";
const OTHER_ADDRESS = "11111111111111111111111111111111";
const WEBHOOK_ID = "b22ab57c-ed5f-4674-90d7-11a540ecafe6";

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
  webhooksGet: vi.fn(),
  webhooksGetAll: vi.fn(),
  webhooksCreate: vi.fn(),
  webhooksUpdate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: mocks.getEnv,
}));

vi.mock("@/lib/helius/client", () => ({
  getHeliusClient: () => ({
    webhooks: {
      get: mocks.webhooksGet,
      getAll: mocks.webhooksGetAll,
      create: mocks.webhooksCreate,
      update: mocks.webhooksUpdate,
    },
  }),
}));

import { ensurePaymentAddressSubscribedToHeliusWebhook } from "@/lib/helius/webhook-subscriptions";

describe("helius webhook subscription management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnv.mockReturnValue({
      APP_BASE_URL: "https://hashart.fun",
      HELIUS_WEBHOOK_SECRET:
        "97cf053aa0775f3dfe3098719618be3cf1ba487cd5712ba257eed03b665e9a61",
      HELIUS_WEBHOOK_ID: WEBHOOK_ID,
    });
  });

  it("prefers configured webhook id and updates it with the new payment address", async () => {
    mocks.webhooksGet.mockResolvedValue({
      webhookID: WEBHOOK_ID,
      webhookURL: "https://old.ngrok.app/",
      webhookType: "enhanced",
      authHeader: "outdated-secret",
      transactionTypes: ["SWAP"],
      accountAddresses: [OTHER_ADDRESS],
    });

    const result = await ensurePaymentAddressSubscribedToHeliusWebhook(
      PAYMENT_ADDRESS,
    );

    expect(mocks.webhooksGet).toHaveBeenCalledWith(WEBHOOK_ID);
    expect(mocks.webhooksGetAll).not.toHaveBeenCalled();
    expect(mocks.webhooksUpdate).toHaveBeenCalledWith(
      WEBHOOK_ID,
      expect.objectContaining({
        webhookURL: "https://hashart.fun/api/helius-webhook",
        webhookType: "enhanced",
        authHeader:
          "97cf053aa0775f3dfe3098719618be3cf1ba487cd5712ba257eed03b665e9a61",
      }),
    );
    expect(result).toEqual({
      webhookId: WEBHOOK_ID,
      created: false,
      alreadySubscribed: false,
    });
  });

  it("creates a webhook when no managed webhook exists", async () => {
    mocks.getEnv.mockReturnValue({
      APP_BASE_URL: "https://hashart.fun",
      HELIUS_WEBHOOK_SECRET:
        "97cf053aa0775f3dfe3098719618be3cf1ba487cd5712ba257eed03b665e9a61",
      HELIUS_WEBHOOK_ID: undefined,
    });
    mocks.webhooksGetAll.mockResolvedValue([]);
    mocks.webhooksCreate.mockResolvedValue({
      webhookID: "new-webhook-id",
    });

    const result = await ensurePaymentAddressSubscribedToHeliusWebhook(
      PAYMENT_ADDRESS,
    );

    expect(mocks.webhooksGet).not.toHaveBeenCalled();
    expect(mocks.webhooksGetAll).toHaveBeenCalledTimes(1);
    expect(mocks.webhooksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookURL: "https://hashart.fun/api/helius-webhook",
        webhookType: "enhanced",
        transactionTypes: ["ANY"],
        accountAddresses: [PAYMENT_ADDRESS],
      }),
    );
    expect(result).toEqual({
      webhookId: "new-webhook-id",
      created: true,
      alreadySubscribed: false,
    });
  });

  it("skips update when address is already subscribed with matching config", async () => {
    mocks.webhooksGet.mockResolvedValue({
      webhookID: WEBHOOK_ID,
      webhookURL: "https://hashart.fun/api/helius-webhook",
      webhookType: "enhanced",
      authHeader:
        "97cf053aa0775f3dfe3098719618be3cf1ba487cd5712ba257eed03b665e9a61",
      transactionTypes: ["ANY"],
      accountAddresses: [PAYMENT_ADDRESS],
    });

    const result = await ensurePaymentAddressSubscribedToHeliusWebhook(
      PAYMENT_ADDRESS,
    );

    expect(mocks.webhooksUpdate).not.toHaveBeenCalled();
    expect(result).toEqual({
      webhookId: WEBHOOK_ID,
      created: false,
      alreadySubscribed: true,
    });
  });
});
