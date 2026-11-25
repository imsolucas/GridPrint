import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Minimal OpenF1 client with an on-disk JSON cache.
 *
 * - Cache key is the full request URL (sha1), so different filters never collide.
 * - Only successful array responses are cached; errors and empty results are not,
 *   because an empty result can be transient (data still being ingested).
 * - Requests are serialised with a small gap to stay well under the free rate limit,
 *   and 429s are retried with backoff.
 * - Set OPENF1_OFFLINE=1 to serve from cache only (useful for demos / flights).
 */

const BASE_URL = process.env.OPENF1_BASE_URL ?? "https://api.openf1.org/v1";
export const CACHE_DIR =
  process.env.GRIDPRINT_CACHE_DIR ?? path.join(process.cwd(), "data", "cache", "openf1");
const OFFLINE = process.env.OPENF1_OFFLINE === "1";
const MIN_GAP_MS = 400;

export class OpenF1Error extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly url: string,
  ) {
    super(message);
    this.name = "OpenF1Error";
  }
}

export type Params = Record<string, string | number>;
const OPS = [">=", "<=", ">", "<"];

/** Builds an OpenF1 URL. Keys may end with a comparison operator, e.g. `{"date>": iso}`. */
export function buildUrl(endpoint: string, params: Params): string {
  const parts = Object.entries(params).map(([k, v]) => {
    const op = OPS.find((o) => k.endsWith(o));
    const key = op ? k.slice(0, -op.length) : k;
    return `${encodeURIComponent(key)}${op ?? "="}${encodeURIComponent(String(v))}`;
  });
  return `${BASE_URL}/${endpoint}${parts.length ? "?" + parts.join("&") : ""}`;
}

interface CacheEntry<T> {
  url: string;
  fetchedAt: string;
  body: T[];
}

function cachePath(endpoint: string, url: string) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 20);
  return path.join(CACHE_DIR, `${endpoint}-${hash}.json`);
}

async function readCache<T>(file: string, ttlMs: number | null): Promise<T[] | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!Array.isArray(entry.body)) return null;
    if (ttlMs !== null && Date.now() - Date.parse(entry.fetchedAt) > ttlMs && !OFFLINE) return null;
    return entry.body;
  } catch {
    return null;
  }
}

async function writeCache<T>(file: string, url: string, body: T[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const entry: CacheEntry<T> = { url, fetchedAt: new Date().toISOString(), body };
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(entry));
  await fs.rename(tmp, file);
}

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequestAt + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function fetchJson(url: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await throttled(() =>
        fetch(url, { headers: { accept: "application/json" }, cache: "no-store" }),
      );
    } catch (err) {
      throw new OpenF1Error(`Network error contacting OpenF1: ${(err as Error).message}`, null, url);
    }
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    // OpenF1 answers "no results" with a 404 + {detail}; treat as an empty list.
    if (res.status === 404) return [];
    if (!res.ok) throw new OpenF1Error(`OpenF1 responded ${res.status}`, res.status, url);
    return res.json();
  }
}

export interface FetchOptions {
  /** Cache lifetime in ms; null = never expires (completed-session data does not change). */
  ttlMs?: number | null;
}

export async function openf1<T>(endpoint: string, params: Params, opts: FetchOptions = {}): Promise<T[]> {
  const url = buildUrl(endpoint, params);
  const file = cachePath(endpoint, url);
  const ttl = opts.ttlMs === undefined ? null : opts.ttlMs;

  const cached = await readCache<T>(file, ttl);
  if (cached) return cached;
  if (OFFLINE) throw new OpenF1Error("OPENF1_OFFLINE=1 and no cached response", null, url);

  const body = await fetchJson(url);
  if (!Array.isArray(body)) {
    throw new OpenF1Error("Unexpected OpenF1 response (not an array)", null, url);
  }
  if (body.length > 0) await writeCache(file, url, body as T[]);
  return body as T[];
}
