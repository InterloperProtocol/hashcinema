import { RetryableError } from "@/lib/network/retry";

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let abortedByCaller = false;
  const callerSignal = init.signal;
  const abortListener = () => {
    abortedByCaller = true;
    controller.abort();
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeout);
      throw new Error("Request aborted before fetch started");
    }
    callerSignal.addEventListener("abort", abortListener);
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !abortedByCaller) {
      throw new RetryableError(`Request timed out after ${timeoutMs}ms`, {
        cause: error as Error,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", abortListener);
    }
  }
}

