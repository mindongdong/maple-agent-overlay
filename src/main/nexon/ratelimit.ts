/**
 * Nexon Open API 분당 500회 한도. 안전 마진 80% → 분당 400회 셀프-제한.
 *
 * 토큰 버킷: 60초 윈도우 안에서 capacity 회까지 호출 허용.
 *  - take(): 토큰 1개 소비. 0개면 false 반환 → 호출 보류
 *  - 슬라이딩 윈도우: 마지막 60초 동안의 호출 시각을 큐로 보관
 */

const WINDOW_MS = 60_000;
const CAPACITY = 400; // 80% of 500/min

const stamps: number[] = [];

export function tryTake(now: number = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  while (stamps.length > 0 && stamps[0]! < cutoff) stamps.shift();
  if (stamps.length >= CAPACITY) return false;
  stamps.push(now);
  return true;
}

export function currentUsage(now: number = Date.now()): { used: number; capacity: number } {
  const cutoff = now - WINDOW_MS;
  while (stamps.length > 0 && stamps[0]! < cutoff) stamps.shift();
  return { used: stamps.length, capacity: CAPACITY };
}

/** 같은 키의 동시 진행 호출은 하나의 Promise 를 공유 (in-flight dedup). */
const inflight = new Map<string, Promise<unknown>>();

export function dedup<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = factory().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
