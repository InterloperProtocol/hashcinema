import { getBucket } from "@/lib/firebase/admin";
import { fetchWithTimeout } from "@/lib/network/http";
import {
  isRetryableHttpStatus,
  RetryableError,
  withRetry,
} from "@/lib/network/retry";

const LONG_LIVED_EXPIRY = "03-01-2500";

export async function uploadBufferToStorage(params: {
  storagePath: string;
  contentType: string;
  data: Buffer;
}): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(params.storagePath);

  await file.save(params.data, {
    metadata: {
      contentType: params.contentType,
      cacheControl: "public,max-age=31536000,immutable",
    },
    resumable: false,
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: LONG_LIVED_EXPIRY,
  });

  return signedUrl;
}

export async function uploadRemoteFileToStorage(params: {
  sourceUrl: string;
  storagePath: string;
  contentType: string;
}): Promise<string> {
  const arrayBuffer = await withRetry(
    async () => {
      const response = await fetchWithTimeout(params.sourceUrl, {}, 20_000);
      if (!response.ok) {
        const message = `Failed to fetch remote file (${response.status}): ${params.sourceUrl}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableError(message);
        }
        throw new Error(message);
      }
      return response.arrayBuffer();
    },
    {
      attempts: 3,
      baseDelayMs: 600,
      maxDelayMs: 4_000,
    },
  );

  return uploadBufferToStorage({
    storagePath: params.storagePath,
    contentType: params.contentType,
    data: Buffer.from(arrayBuffer),
  });
}
