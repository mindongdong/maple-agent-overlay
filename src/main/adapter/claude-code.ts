import type { Payload } from '../../shared/payload';

const AGENT_NAME = 'claude_code';
const MESSAGE_MAX = 500;
const TOOL_SUMMARY_MAX = 80;

/**
 * Claude Code hooks (HTTP type) raw payload → 통일 페이로드 변환.
 *
 * 매핑 단일 출처: _workspace/adapter-engineer/claude-code-mapping.md.
 * 페이로드 shape 은 _workspace/adapter-engineer/payload-samples.jsonl 의 PoC 캡처로 확정.
 *
 * 보수적 원칙:
 *  - 확신 없으면 working 으로 폴백 (잘못된 done 알림이 가장 나쁜 UX)
 *  - 알 수 없는 hook 은 무시 (null 반환) 하지 않고 working 으로 표시 + raw 정보 message 에 포함
 */
export function mapClaudeCodeHook(raw: unknown): Payload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const event = pick(r, ['hook_event_name']);
  if (!event) return null;

  switch (event) {
    case 'SessionStart':
      return payload('idle', '세션 시작');

    case 'PreToolUse':
    case 'PostToolUse': {
      const tool = pick(r, ['tool_name']) ?? '';
      const summary = summarizeToolInput(tool, r['tool_input']);
      const suffix = event === 'PostToolUse' ? ' (완료)' : '';
      const text = summary ? `${tool} ${summary}${suffix}` : `${tool}${suffix}`;
      return payload('working', text.trim());
    }

    case 'Notification': {
      // PoC 에서 직접 캡처는 못함 (sandbox 가 먼저 차단). matcher 기반 분기 유지.
      const matcher = pick(r, ['matcher']) ?? '';
      if (matcher === 'permission_prompt') {
        const prompt = pick(r, ['prompt', 'message']) ?? '승인 대기 중';
        return payload('pending_approval', prompt);
      }
      return payload('working', `Notification: ${matcher || 'unknown'}`);
    }

    case 'Stop': {
      // PoC 검증: payload 에 last_assistant_message 가 항상 있음
      const last = pick(r, ['last_assistant_message']);
      return payload('done', firstLine(last) ?? '작업 완료');
    }

    case 'SubagentStop': {
      // PoC 검증: agent_type + last_assistant_message 둘 다 존재
      const agentType = pick(r, ['agent_type']);
      const last = pick(r, ['last_assistant_message']);
      const prefix = agentType ? `${agentType} 서브에이전트` : '서브에이전트';
      const tail = firstLine(last);
      return payload('done', tail ? `${prefix}: ${tail}` : `${prefix} 완료`);
    }

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
 * tool_input 의 핵심 정보를 한 줄 요약으로.
 *
 * PoC 검증 결과 (실제 필드명):
 *  - Read / Edit / Write / NotebookEdit:  tool_input.file_path
 *  - Bash:                                 tool_input.command + 사람이 읽기 좋은 description
 *  - Agent (Task tool):                    tool_input.subagent_type + description + prompt
 *  - Glob / Grep:                          tool_input.pattern (캡처 안 됐지만 공식 문서 기반)
 *  - ToolSearch:                           tool_input.query (Claude Code 의 deferred-tool 검색)
 */
function summarizeToolInput(tool: string, input: unknown): string {
  if (typeof input !== 'object' || input === null) return '';
  const i = input as Record<string, unknown>;

  switch (tool) {
    case 'Read':
    case 'Edit':
    case 'Write':
    case 'NotebookEdit': {
      const fp = pick(i, ['file_path', 'path', 'filePath']);
      return fp ? truncate(basename(fp), TOOL_SUMMARY_MAX) : '';
    }
    case 'Bash': {
      // description (human-readable) 이 있으면 우선, 없으면 command
      const desc = pick(i, ['description']);
      if (desc) return truncate(desc, TOOL_SUMMARY_MAX);
      const cmd = pick(i, ['command']);
      return cmd ? truncate(cmd, TOOL_SUMMARY_MAX) : '';
    }
    case 'Agent':
    case 'Task': {
      const sub = pick(i, ['subagent_type']);
      const desc = pick(i, ['description']);
      const part = desc ?? pick(i, ['prompt']) ?? '';
      const head = sub ? `→ ${sub}` : 'subagent';
      return truncate(part ? `${head}: ${part}` : head, TOOL_SUMMARY_MAX);
    }
    case 'Grep':
    case 'Glob': {
      const pat = pick(i, ['pattern', 'query']);
      return pat ? truncate(pat, TOOL_SUMMARY_MAX) : '';
    }
    case 'ToolSearch': {
      const q = pick(i, ['query']);
      return q ? truncate(q, TOOL_SUMMARY_MAX) : '';
    }
    default: {
      // 알 수 없는 tool — 자주 쓰이는 식별 필드 폴백 검색
      const any = pick(i, ['file_path', 'path', 'command', 'pattern', 'query', 'description']);
      return any ? truncate(any, TOOL_SUMMARY_MAX) : '';
    }
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

/** 메시지에 줄바꿈/연속 공백이 있으면 첫 줄로 정제 (말풍선 표시용). */
function firstLine(s: string | null): string | null {
  if (!s) return null;
  const trimmed = s.split(/\r?\n/, 1)[0]?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

/** 절대 경로의 마지막 세그먼트만. 메시지 가독성 향상. */
function basename(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx >= 0 ? p.slice(idx + 1) : p;
}
