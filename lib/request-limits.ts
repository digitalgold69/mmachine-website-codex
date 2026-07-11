import crypto from "node:crypto";
import { getD1 } from "@/lib/cloudflare";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function clientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const retryAfterSeconds = Math.max(1, windowStart + windowSeconds - nowSeconds);
  const keyHash = crypto
    .createHash("sha256")
    .update(`${scope}:${clientAddress(request)}`)
    .digest("hex");

  try {
    const db = await getD1();
    await db
      .prepare("delete from request_limits where window_start < ?")
      .bind(nowSeconds - 7 * 24 * 60 * 60)
      .run();
    await db
      .prepare(
        `insert into request_limits (scope, key_hash, window_start, hits)
         values (?, ?, ?, 1)
         on conflict(scope, key_hash, window_start)
         do update set hits = hits + 1`
      )
      .bind(scope, keyHash, windowStart)
      .run();

    const row = await db
      .prepare(
        "select hits from request_limits where scope = ? and key_hash = ? and window_start = ?"
      )
      .bind(scope, keyHash, windowStart)
      .first<{ hits: number }>();

    return { allowed: Number(row?.hits || 0) <= limit, retryAfterSeconds };
  } catch (error) {
    console.error("rate_limit_check_failed", {
      scope,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { allowed: true, retryAfterSeconds };
  }
}
