export interface PortalFetchOptions {
  /** Total attempts including the first one (default 3). */
  attempts?: number;
  /** Base delay before retry; doubled every attempt (default 1000ms). */
  baseDelayMs?: number;
  /** Per-attempt timeout (default 15000ms). */
  timeoutMs?: number;
}

export interface PortalNetworkError {
  error: "network";
  message: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Network-level failures thrown by fetch (undici surfaces them as TypeError,
 * timeouts as abort errors). HTTP error statuses do NOT throw, so callers
 * keep handling response.ok themselves.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof DOMException && error.name !== "SyntaxError") return true;
  const code = (error as { code?: unknown })?.code;
  return typeof code === "string" && code.startsWith("UND_ERR_");
}

/**
 * fetch() with per-attempt timeout and exponential-backoff retries for
 * transient network failures (flaky DNS like EAI_AGAIN, resets, timeouts).
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: PortalFetchOptions,
): Promise<Response> {
  const attempts = opts?.attempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 1000;
  const timeoutMs = opts?.timeoutMs ?? 15000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        signal: init?.signal ?? controller.signal,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt >= attempts) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Map a fetch failure to a user-facing (Indonesian) error payload. */
export function toPortalError(error: unknown): PortalNetworkError {
  const code = (error as { cause?: { code?: unknown } })?.cause?.code;
  if (code === "EAI_AGAIN" || code === "ENOTFOUND") {
    return {
      error: "network",
      message:
        "Tidak dapat menemukan server mysimkari.kejaksaan.go.id (gangguan DNS). Periksa koneksi internet/VPN lalu coba lagi.",
    };
  }
  return {
    error: "network",
    message:
      "Tidak dapat terhubung ke portal MySimkari. Periksa koneksi internet/VPN lalu coba lagi.",
  };
}
