import type { Config } from "./config.js";

export class DataUnavailable extends Error {
  constructor(public readonly source: string) { super(`${source} is temporarily unavailable. No stock or availability conclusion can be drawn. Try again.`); }
}

/** Bounded public reads only. No arbitrary table, URL, SQL, token or user identity input. */
export class PublicData {
  constructor(private readonly config: Config, private readonly fetcher: typeof fetch = fetch) {}
  async read(table: "parts" | "blog_posts", params: URLSearchParams): Promise<unknown[]> {
    const target = new URL(`/rest/v1/${table}`, this.config.supabaseUrl);
    target.search = params.toString();
    try {
      const response = await this.fetcher(target, {
        headers: { apikey: this.config.publishableKey, Accept: "application/json" },
        signal: AbortSignal.timeout(7000), cache: "no-store", redirect: "error",
      });
      if (!response.ok || !response.body) throw new Error("read");
      const reader = response.body.getReader();
      const pieces: Uint8Array[] = []; let size = 0;
      for (;;) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error("read cap"); }
        pieces.push(chunk.value);
      }
      const value: unknown = JSON.parse(Buffer.concat(pieces).toString());
      if (!Array.isArray(value)) throw new Error("shape");
      return value;
    } catch { throw new DataUnavailable(table === "parts" ? "Live HAR inventory" : "HAR published articles"); }
  }
}
