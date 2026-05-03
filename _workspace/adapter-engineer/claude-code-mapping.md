# Claude Code Hook → 통일 페이로드 매핑

Claude Code의 공식 `hooks` 기능(HTTP type)이 보내는 raw payload를 [`payload-schema.md`](./payload-schema.md) 형식으로 변환하는 규칙.

## 매핑 표 (초안 — Phase 0 PoC로 검증 예정)

| Claude Code hook | matcher | → state | message 추출 (예상) |
|------------------|---------|---------|------------------|
| `SessionStart` | * | `idle` | `"세션 시작"` |
| `PreToolUse` | * | `working` | `${tool_name} ${요약(tool_input)}` (예: `Edit src/Foo.tsx`) |
| `PostToolUse` | * | `working` | 직전 도구 + `(완료)` 또는 결과 요약 |
| `Notification` | `permission_prompt` | `pending_approval` | payload 의 prompt 텍스트 |
| `Stop` | * | `done` | `"작업 완료"` 또는 마지막 응답 요약 |
| `SubagentStop` | * | `done` | `"서브에이전트 완료"` |
| (hook exit code 2) | - | `error` | hook 실행 실패 메시지 |

`agent_name` 은 모두 `claude_code` 고정.

## tool_input 요약 규칙 (예상)

- `Edit`, `Write`, `Read`: `${tool_name} ${file_path}`
- `Bash`: `Bash ${command 의 첫 60자}`
- `Grep`, `Glob`: `${tool_name} ${pattern}`
- 기타: `${tool_name}` 만

실제 페이로드 필드명은 PoC로 확정. 추정 기반 구현 금지.

## 변환 의사코드

```ts
function mapClaudeHook(raw: ClaudeHookPayload): Payload | null {
  const event = raw.hook_event_name;

  // 1) SessionStart → idle
  if (event === 'SessionStart') {
    return { agent_name: 'claude_code', state: 'idle', message: '세션 시작' };
  }

  // 2) PreToolUse / PostToolUse → working
  if (event === 'PreToolUse' || event === 'PostToolUse') {
    const tool = raw.tool_name ?? '';
    const summary = summarizeToolInput(tool, raw.tool_input);
    return { agent_name: 'claude_code', state: 'working', message: `${tool} ${summary}`.trim() };
  }

  // 3) Notification (permission_prompt) → pending_approval
  if (event === 'Notification' && raw.matcher === 'permission_prompt') {
    return { agent_name: 'claude_code', state: 'pending_approval', message: raw.prompt ?? '' };
  }

  // 4) Stop / SubagentStop → done
  if (event === 'Stop' || event === 'SubagentStop') {
    return { agent_name: 'claude_code', state: 'done', message: '' };
  }

  // 5) 알 수 없음 → working 폴백 (보수적)
  return { agent_name: 'claude_code', state: 'working',
           message: `unknown hook: ${event}` };
}
```

## PoC 검증 결과

> 아래는 [`poc-instructions.md`](./poc-instructions.md) 절차로 캡처를 모은 후 채울 섹션.

### 캡처 요약 (TBD)

| # | hook_event_name | matcher | tool_name | 비고 |
|---|----------------|---------|-----------|------|
| 1 | (TBD) | | | |

### 매핑 보정 사항 (TBD)

- [ ] tool_input 의 실제 필드명을 확인하여 `summarizeToolInput` 구현
- [ ] Notification 의 prompt 가 `prompt` 필드인지 다른 이름인지 확인
- [ ] PostToolUse 페이로드에 결과 요약을 만들 수 있는 필드가 있는지 확인
- [ ] 매핑 표에 누락된 hook 이벤트가 있는지 확인 (예: `UserPromptSubmit`, `PreCompact` 등)

### Finalize

PoC 검증이 끝나면 위 의사코드를 보정한 뒤 `src/main/adapter/claude-code.ts` 로 옮긴다 (Phase 2 작업).

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 작성 (PRD §2.5 기반) | Phase 0 시작 |
