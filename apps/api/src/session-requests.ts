const RETAIN_MS = 10 * 60_000;

export function createSessionRequests() {
  const active = new Map<string, string>();
  const seen = new Map<string, number>();

  function reserve(sessionId: string, requestKey: string) {
    const now = Date.now();
    for (const [key, expiresAt] of seen) if (expiresAt <= now) seen.delete(key);
    const key = `${sessionId}:${requestKey}`;
    if (active.has(sessionId) || seen.has(key)) return false;
    // 同步占位，避免两个并发请求都通过检查。
    active.set(sessionId, requestKey);
    seen.set(key, now + RETAIN_MS);
    return true;
  }

  function release(sessionId: string, requestKey: string) {
    if (active.get(sessionId) === requestKey) active.delete(sessionId);
  }

  return { reserve, release };
}
