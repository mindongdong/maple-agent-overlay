# Claude Code Hook → 통일 페이로드 매핑

Claude Code 의 공식 `hooks` 기능(HTTP type)이 보내는 raw payload 를 [`payload-schema.md`](./payload-schema.md) 형식으로 변환하는 규칙.

> **PoC 완료 (2026-05-03).** Claude Code 2.1.118 기준. 실제 hook payload 는 [`scripts/poc-scenarios.sh`](../../scripts/poc-scenarios.sh) + [`poc-hooks.json`](./poc-hooks.json) 으로 캡처. 결과는 [src/main/adapter/claude-code.ts](../../src/main/adapter/claude-code.ts) 에 반영됨.

## 매핑 표 (PoC 검증 완료)

| Claude Code hook | matcher | → state | message |
|------------------|---------|---------|---------|
| `SessionStart` | * | `idle` | "세션 시작" (※ `claude -p` 모드에서는 fire 안 됨, 대화형에서만) |
| `PreToolUse` | * | `working` | `${tool_name} ${요약(tool_input)}` |
| `PostToolUse` | * | `working` | `${tool_name} ${요약(tool_input)} (완료)` |
| `Notification` | `permission_prompt` | `pending_approval` | `tool_input.prompt` 또는 `message` |
| `Notification` | (기타) | `working` | `Notification: ${matcher}` |
| `Stop` | * | `done` | `last_assistant_message` 의 첫 줄 (없으면 "작업 완료") |
| `SubagentStop` | * | `done` | `${agent_type} 서브에이전트: ${last_assistant_message 첫 줄}` |
| (default) | - | `working` | `unknown hook: ${event}` (보수적 폴백) |

`agent_name` 은 모두 `claude_code` 고정.

## 페이로드 envelope (PoC 검증)

모든 hook payload 가 공유하는 필드:

```json
{
  "session_id": "<uuid>",
  "transcript_path": "<absolute path to .jsonl>",
  "cwd": "<absolute path>",
  "permission_mode": "default | bypassPermissions | acceptEdits | plan",
  "hook_event_name": "<event name>"
}
```

## 이벤트별 추가 필드 (PoC 검증)

### PreToolUse / PostToolUse

```json
{
  ...envelope,
  "tool_name": "Read | Bash | Edit | ...",
  "tool_input": { /* tool 별 다름, 아래 표 */ },
  "tool_use_id": "toolu_...",
  "tool_response": { /* PostToolUse 만 */ }
}
```

| tool_name | 핵심 `tool_input` 필드 |
|-----------|---------------------|
| `Read` / `Edit` / `Write` / `NotebookEdit` | `file_path` (절대 경로) |
| `Bash` | `command` (명령어) + **`description`** (사람이 읽기 좋은 한 줄 요약) |
| `Agent` (PRD 의 Task tool) | `subagent_type` (예: "general-purpose"), `description`, `prompt` |
| `Glob` / `Grep` | `pattern` (※ 본 PoC 에서 직접 캡처 X — claude -p 가 Bash grep 으로 우회. 공식 문서 기반 가정) |
| `ToolSearch` | `query` (deferred-tool 검색용) |

**중요 발견:** Bash 의 `description` 필드는 "Echo and print date" 처럼 사람이 읽기 좋은 한 줄. raw `command` 보다 말풍선 표시에 적합 → 매핑에서 우선 사용.

### Stop

```json
{
  ...envelope,
  "stop_hook_active": false,
  "last_assistant_message": "<assistant 의 마지막 응답 텍스트>"
}
```

`last_assistant_message` 는 종종 마크다운 코드블록/줄바꿈 포함 → `firstLine()` 으로 첫 줄만 추출하여 말풍선에 표시.

### SubagentStop

```json
{
  ...envelope,
  "agent_id": "a94adb95452ddd6eb",
  "agent_type": "general-purpose",
  "agent_transcript_path": "<.jsonl path>",
  "stop_hook_active": false,
  "last_assistant_message": "<서브에이전트 응답>"
}
```

`agent_type` 가 있어 "general-purpose 서브에이전트: ..." 형태로 더 정보 풍부한 메시지 가능.

### Notification (`permission_prompt`)

PoC 에서 직접 캡처 X — Claude Code 의 자체 sandbox 가 위험 명령어를 hook 보다 먼저 차단 (예: `rm /tmp/...` → "Blocked by sandbox" 응답). 따라서 매핑은 공식 문서 기반 가정으로 유지:
- `tool_input.prompt` 또는 `tool_input.message` 에 권한 요청 텍스트
- 매핑은 [claude-code.ts:46](../../src/main/adapter/claude-code.ts#L46) 의 보수적 폴백 활용

대화형(non-`-p`) 세션에서 권한 우회 미설정 + 위험 명령 입력 시 fire 예상. 대화형 검증은 사용자 환경에 의존하므로 deferred.

## PoC 검증 결과

### 캡처 통계 (2026-05-03)

| Hook | 횟수 | 비고 |
|------|------|------|
| `PreToolUse` | 10 | Read×2, Bash×5, ToolSearch×2, Agent×1 |
| `PostToolUse` | 9 | (Agent 의 PostToolUse 1건 누락 — SubagentStop 직후라 timing 추정) |
| `Stop` | 8 | 매 시나리오 종료마다 1건 |
| `SubagentStop` | 1 | Task tool 시나리오에서 1건 |
| `SessionStart` | 0 | `claude -p` 모드에서는 fire 안 됨 |
| `Notification` | 0 | sandbox 가 먼저 차단 |
| **합계** | **28** | (probe 2건 별도) |

### 매핑 적용 결과 샘플 (실제 캡처 → 매핑 출력)

| 원본 hook | 매핑 결과 |
|----------|--------|
| `Stop` | `done · poc-smoketest` |
| `Stop` | `done · The title is "메이플 에이전트 오버레이 (Maple Agent Overlay)".` |
| `PreToolUse/Read` | `working · Read PRD.md` (basename 으로 정제) |
| `PreToolUse/Bash` | `working · Bash Echo and print date` (description 사용) |
| `PreToolUse/Bash` | `working · Bash Find line numbers containing 'Phase 0' in PRD.md` |
| `PreToolUse/Agent` | `working · Agent → general-purpose: PoC subagent test` |
| `SubagentStop` | `done · general-purpose 서브에이전트: subagent-poc-done` |
| `Stop` (sandbox 차단) | `done · Blocked by sandbox: \`rm\` is restricted to ...` (장문 → 500자 clamp) |

### 매핑 보정 사항 (PoC 결과 반영)

- [x] `Stop` 메시지: literal "작업 완료" → `last_assistant_message` 사용
- [x] `SubagentStop`: `agent_type` 활용한 풍부한 메시지
- [x] `Bash`: `description` 우선 (raw `command` 폴백)
- [x] `Read/Edit/Write`: `file_path` 의 basename 만 (전체 절대 경로 X)
- [x] `Agent` (Task) tool: `subagent_type + description` 로 출력
- [x] `ToolSearch`: `query` 매핑 추가
- [x] 멀티라인 메시지: `firstLine()` 으로 첫 줄만 (말풍선 가독성)
- [ ] 대화형 `Notification(permission_prompt)` 필드 검증 — Phase 5 사용자 환경에서 검증 예정

## Finalize 커밋

위 매핑은 [src/main/adapter/claude-code.ts](../../src/main/adapter/claude-code.ts) 에 반영됨. 본 문서가 단일 출처 — 매핑 코드와 항상 동기화.

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 작성 (PRD §2.5 기반) | Phase 0 시작 |
| 2026-05-03 | PoC 검증 결과 반영. 페이로드 envelope + tool_input 필드 확정. Bash description, Stop/SubagentStop last_assistant_message, Agent tool, basename 정제 등 적용 | Phase 0 PoC 완료 → 매핑 finalize |
