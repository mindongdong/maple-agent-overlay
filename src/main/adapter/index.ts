import { PayloadSchema, type Payload } from '../../shared/payload';
import { mapClaudeCodeHook } from './claude-code';

/**
 * 들어온 raw 페이로드를 통일 형식으로 변환.
 *
 *  1. 이미 통일 형식 ({agent_name, state, message}) 이면 그대로 통과 — wrapper 셸이 보낸 경우
 *  2. Claude Code hook payload (hook_event_name 존재) → mapClaudeCodeHook
 *  3. 그 외 → null
 */
export function adaptIncoming(raw: unknown): Payload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  // (1) wrapper 직발사: 이미 통일 형식
  if (typeof r['agent_name'] === 'string' && typeof r['state'] === 'string') {
    const result = PayloadSchema.safeParse(raw);
    return result.success ? result.data : null;
  }

  // (2) Claude Code hook payload
  if (typeof r['hook_event_name'] === 'string') {
    const mapped = mapClaudeCodeHook(raw);
    if (!mapped) return null;
    const result = PayloadSchema.safeParse(mapped);
    return result.success ? result.data : null;
  }

  return null;
}

export type { Payload };
