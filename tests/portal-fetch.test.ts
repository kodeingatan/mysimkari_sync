import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchWithRetry,
  toPortalError,
} from "../electron/portal-fetch";
import { suppressPdfJsFontWarnings } from "../electron/parser/pdf-parser";

afterEach(() => {
  vi.unstubAllGlobals();
});

const networkError = () => {
  const err = new TypeError("fetch failed");
  (err as unknown as { cause: unknown }).cause = {
    code: "EAI_AGAIN",
    hostname: "mysimkari.kejaksaan.go.id",
  };
  return err;
};

describe("fetchWithRetry", () => {
  it("returns response on first success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("https://example.com");
    expect(await res.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("https://example.com", undefined, {
      baseDelayMs: 1,
    });
    expect(await res.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting attempts", async () => {
    const fetchMock = vi.fn().mockRejectedValue(networkError());
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 }),
    ).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-network errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 }),
    ).rejects.toThrow("boom");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("toPortalError", () => {
  it("maps DNS failures to a DNS-specific message", () => {
    const result = toPortalError(networkError());
    expect(result.error).toBe("network");
    expect(result.message).toMatch(/DNS/i);
  });

  it("maps generic failures to a generic message", () => {
    const result = toPortalError(new TypeError("fetch failed"));
    expect(result.error).toBe("network");
    expect(result.message).toMatch(/portal MySimkari/i);
  });
});

describe("suppressPdfJsFontWarnings", () => {
  it("swallows pdf.js font warnings but forwards the rest", async () => {
    const logged: unknown[][] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      logged.push(args);
    };
    try {
      await suppressPdfJsFontWarnings(async () => {
        console.log("Warning: TT: undefined function: 21");
        console.log('Warning: Required "glyf" table is not found -- trying to recover.');
        console.log("Warning: something else important");
      });
    } finally {
      console.log = original;
    }
    expect(logged).toEqual([["Warning: something else important"]]);
  });

  it("restores console.log even when fn throws", async () => {
    const original = console.log;
    await expect(
      suppressPdfJsFontWarnings(async () => {
        throw new Error("inner");
      }),
    ).rejects.toThrow("inner");
    expect(console.log).toBe(original);
  });
});
