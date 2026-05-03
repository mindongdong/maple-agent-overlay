import type { Payload } from '../../shared/payload';

const AGENT_NAME = 'claude_code';
const MESSAGE_MAX = 500;

/**
 * Claude Code hooks (HTTP type) raw payload → 통일 페이로드 변환.
 *
 * 매핑 단일 출처: _workspace/adapter-engineer/claude-code-mapping.md.
 * 보수적 원칙:
 *  - 확신 없으면 working 으로 폴백 (잘못된 done 알림이 가장 나쁜 UX)
 *  - 알 수 없는 hook 은 무시 (null 반환) 하지 않고 working 으로 표시 + raw 정보 message 에 포함
 *
 * PoC 캡처 결과로 필드명 (`tool_name`, `tool_input`, `prompt`, ...) 을 검증한 뒤 finalize.
 */
export function mapClaudeCodeHook(raw: unknown): Payload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const event = typeof r['hook_event_name'] === 'string' ? r['hook_event_name'] : null;
  if (!event) return null;

  switch (event) {
    case 'SessionStart':
      return payload('idle', '세션 시작');

    case 'PreToolUse':
    case 'PostToolUse': {
      const tool = typeof r['tool_name'] === 'string' ? r['tool_name'] : '';
      const summary = summarizeToolInput(tool, r['tool_input']);
      const suffix = event === 'PostToolUse' ? ' (완료)' : '';
      return payload('working', `${tool}${summary ? ' ' + summary : ''}${suffix}`.trim());
    }

    case 'Notification': {
      const matcher = typeof r['matcher'] === 'string' ? r['matcher'] : '';
      if (matcher === 'permission_prompt') {
        const prompt =
          (typeof r['prompt'] === 'string' && r['prompt']) ||
          (typeof r['message'] === 'string' && r['message']) ||
          '승인 대기 중';
        return payload('pending_approval', String(prompt));
      }
      // 다른 Notification 종류는 working 폴백
      return payload('working', `Notification: ${matcher || 'unknown'}`);
    }

    case 'Stop':
      return payload('done', '작업 완료');

    case 'SubagentStop':
      return payload('done', '서브에이전트 완료');

    default:
      return payload('working', `unknown hook: ${event}`);
  }
}

function payload(state: Payload['state'], message: string): Payload {
  return {
    agent_name: AGENT_NAME,
    state,
    message: clamp(message),
  };
}

function clamp(s: string): string {
  if (s.length <= MESSAGE_MAX) return s;
  return s.slice(0, MESSAGE_MAX - 1) + '…';
}

/**
 * tool_input 의 핵심 정보를 한 줄 요약으로. 필드명 추정 — PoC 검증 후 보정 예정.
 */
function summarizeToolInput(tool: string, input: unknown): string {
  if (typeof input !== 'object' || input === null) return '';
  const i = input as Record<string, unknown>;

  const filePath = pick(i, ['file_path', 'path', 'filePath']);
  const command = pick(i, ['command']);
  const pattern = pick(i, ['pattern', 'query']);

  switch (tool) {
    case 'Edit':
    case 'Write':
    case 'Read':
    case 'NotebookEdit':
      return filePath ?? '';
    case 'Bash':
      return command ? truncate(command, 60) : '';
    case 'Grep':
    case 'Glob':
      return pattern ? truncate(pattern, 60) : '';
    default:
      return filePath ?? command ?? pattern ?? '';
  }
}

function pick(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
