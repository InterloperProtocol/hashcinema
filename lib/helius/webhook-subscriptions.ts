import { getEnv } from "@/lib/env";
import { getHeliusClient } from "@/lib/helius/client";
import { PublicKey } from "@solana/web3.js";

const HELIUS_WEBHOOK_TYPE = "enhanced";
const HELIUS_WEBHOOK_TRANSACTION_TYPES = ["ANY"];

interface HeliusWebhookRecord {
  webhookID: string;
  webhookURL: string;
  webhookType: string;
  authHeader: string;
  transactionTypes: string[];
  accountAddresses: string[];
}

function isValidSolanaAddress(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function buildTargetWebhookUrl(appBaseUrl: string): string {
  return new URL("/api/helius-webhook", appBaseUrl).toString();
}

function webhookMatchesTarget(
  webhook: HeliusWebhookRecord,
  targetWebhookUrl: string,
): boolean {
  return (
    normalizeUrl(webhook.webhookURL) === normalizeUrl(targetWebhookUrl) &&
    webhook.webhookType === HELIUS_WEBHOOK_TYPE
  );
}

function pickManagedWebhook(
  webhooks: HeliusWebhookRecord[],
  targetWebhookUrl: string,
  authHeader: string,
): HeliusWebhookRecord | null {
  const matches = webhooks.filter((webhook) =>
    webhookMatchesTarget(webhook, targetWebhookUrl),
  );
  if (matches.length === 0) {
    return null;
  }

  return matches.find((webhook) => webhook.authHeader === authHeader) ?? matches[0]!;
}

function buildUpdatedTransactionTypes(current: string[]): string[] {
  return uniq([...current, ...HELIUS_WEBHOOK_TRANSACTION_TYPES]);
}

async function getManagedWebhookByIdIfConfigured(): Promise<HeliusWebhookRecord | null> {
  const env = getEnv();
  if (!env.HELIUS_WEBHOOK_ID) {
    return null;
  }

  try {
    const helius = getHeliusClient();
    return (await helius.webhooks.get(env.HELIUS_WEBHOOK_ID)) as HeliusWebhookRecord;
  } catch {
    return null;
  }
}

export interface HeliusWebhookSubscriptionResult {
  webhookId: string;
  created: boolean;
  alreadySubscribed: boolean;
}

export async function ensurePaymentAddressSubscribedToHeliusWebhook(
  paymentAddress: string,
): Promise<HeliusWebhookSubscriptionResult> {
  if (!isValidSolanaAddress(paymentAddress)) {
    throw new Error("Payment address is not a valid Solana public key");
  }

  const env = getEnv();
  if (!env.HELIUS_WEBHOOK_SECRET) {
    throw new Error("HELIUS_WEBHOOK_SECRET is required for webhook subscription");
  }

  const targetWebhookUrl = buildTargetWebhookUrl(env.APP_BASE_URL);
  const helius = getHeliusClient();
  const managedById = await getManagedWebhookByIdIfConfigured();
  const managed =
    managedById ??
    pickManagedWebhook(
      (await helius.webhooks.getAll()) as HeliusWebhookRecord[],
      targetWebhookUrl,
      env.HELIUS_WEBHOOK_SECRET,
    );

  if (!managed) {
    const created = await helius.webhooks.create({
      webhookURL: targetWebhookUrl,
      accountAddresses: [paymentAddress],
      transactionTypes: [...HELIUS_WEBHOOK_TRANSACTION_TYPES],
      webhookType: HELIUS_WEBHOOK_TYPE,
      authHeader: env.HELIUS_WEBHOOK_SECRET,
    });

    return {
      webhookId: created.webhookID,
      created: true,
      alreadySubscribed: false,
    };
  }

  const alreadySubscribed = managed.accountAddresses.includes(paymentAddress);
  const nextAddresses = alreadySubscribed
    ? managed.accountAddresses
    : uniq([...managed.accountAddresses, paymentAddress]);
  const nextTransactionTypes = buildUpdatedTransactionTypes(
    managed.transactionTypes,
  );
  const needsUpdate =
    !alreadySubscribed ||
    managed.authHeader !== env.HELIUS_WEBHOOK_SECRET ||
    normalizeUrl(managed.webhookURL) !== normalizeUrl(targetWebhookUrl) ||
    managed.webhookType !== HELIUS_WEBHOOK_TYPE ||
    nextTransactionTypes.length !== managed.transactionTypes.length;

  if (needsUpdate) {
    await helius.webhooks.update(managed.webhookID, {
      webhookURL: targetWebhookUrl,
      accountAddresses: nextAddresses,
      transactionTypes: nextTransactionTypes,
      webhookType: HELIUS_WEBHOOK_TYPE,
      authHeader: env.HELIUS_WEBHOOK_SECRET,
    });
  }

  return {
    webhookId: managed.webhookID,
    created: false,
    alreadySubscribed,
  };
}
