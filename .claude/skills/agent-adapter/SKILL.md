---
name: agent-adapter
description: AI 코딩 에이전트(Claude Code, Codex CLI, Gemini CLI)의 작업 상태를 통일된 webhook 페이로드 {agent_name, state, message}로 변환하는 어댑터를 구축한다. Claude Code는 공식 hooks(HTTP type)을 사용하고, Codex/Gemini는 wrapper 셸 스크립트로 stdout/stderr를 휴리스틱 파싱한다. PreToolUse/PostToolUse/Notification/Stop/SessionStart 같은 hook 매핑, ~/.claude/settings.json 편집, wrapper 셸 작성, agent_name 충돌 처리가 필요하면 반드시 이 스킬을 사용할 것. 새 에이전트 종류 추가 시에도 트리거.
---

# Agent Adapter

## 언제 이 스킬을 쓰는가

- Claude Code의 hooks를 webhook으로 라우팅할 때
- Codex CLI / Gemini CLI를 wrapper 셸 스크립트로 감싸 상태 신호를 추출할 때
- 통일된 페이로드 스키마 `{agent_name, state, message}`를 정의/확장할 때
- 새로운 에이전트 종류를 어댑터 풀에 추가할 때

## 페이로드 스키마 (불변 계약)

```json
{
  "agent_name": "claude_code",
  "state": "working",
  "message": "src/components/Button.tsx 리팩토링 중..."
}
```

- `agent_name`: 고정 식별자 (`claude_code`, `codex`, `gemini`). 다중 인스턴스는 `claude_code-1`, `claude_code-2` 처럼 suffix
- `state`: 5개만 허용 — `idle`, `working`, `pending_approval`, `done`, `error`. 새 상태는 renderer-engineer와 합의 후 추가
- `message`: 사람이 읽을 수 있는 1~2줄. 비어있어도 됨

이 스키마는 `_workspace/adapter-engineer/payload-schema.md`에 단일 출처로 보관. 변경 시 SendMessage로 renderer/electron 양쪽 통보.

## Claude Code 어댑터 (1차 타깃, hooks 직접 사용)

### 매핑 표

| Claude Code Hook | matcher | → state | message 추출 |
|------------------|---------|---------|------------|
| `PreToolUse` | * | `working` | `tool_name` + 주요 인자 (예: `Edit src/Foo.tsx`) |
| `PostToolUse` | * | `working` | 직전 동작 요약 |
| `Notification` | `permission_prompt` | `pending_approval` | prompt 메시지 |
| `Stop` | * | `done` | "작업 완료" 또는 마지막 요약 |
| `SubagentStop` | * | `done` | 서브에이전트 종료 |
| `SessionStart` | * | `idle` | "세션 시작" |
| (exit code 2) | - | `error` | hook 실행 실패 메시지 |

### 사용자 설치 가이드 (`~/.claude/settings.json`)

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }],
    "PostToolUse": [{
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }],
    "Notification": [{
      "matcher": "permission_prompt",
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }],
    "Stop": [{
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }],
    "SessionStart": [{
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }]
  }
}
```

### 서버측 변환

webhook 서버가 `/event` 수신 시:
1. `req.body.hook_event_name`을 매핑 표로 변환
2. 변환된 `{agent_name: 'claude_code', state, message}`를 메인 프로세스 IPC `agent:event`로 발사
3. 변환 실패 시 `working` + 원본 hook 정보를 message에 포함하여 폴백

### 포트 동적 반영

webhook-server가 fallback한 실제 포트를 사용자에게 보여줘야 한다. 트레이 메뉴의 "Copy hooks config" 항목으로 현재 포트가 적용된 settings.json snippet을 클립보드에 복사해주는 기능 권장.

## Codex CLI Wrapper

PATH 우선순위로 wrapper가 실제 codex보다 먼저 잡히게 설치한다.

```bash
#!/usr/bin/env bash
# ~/.maple-overlay/bin/codex
# 실제 codex 경로 (wrapper와 충돌 방지)
REAL_CODEX="/usr/local/bin/codex"
WEBHOOK_URL="http://127.0.0.1:40429/event"
AGENT="codex"

post() {
  curl -s -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"agent_name\":\"$AGENT\",\"state\":\"$1\",\"message\":\"$2\"}" \
    >/dev/null 2>&1 || true
}

post "working" "codex started"

# stdout/stderr 파싱하며 휴리스틱 추론
"$REAL_CODEX" "$@" 2> >(tee >(while IFS= read -r line; do
  case "$line" in
    *"Approval required"*|*"(y/n)"*) post "pending_approval" "$line" ;;
    *"Error"*|*"failed"*) post "error" "$line" ;;
  esac
done >&2)) | while IFS= read -r line; do
  echo "$line"  # 원본 출력은 그대로 흘림
  case "$line" in
    *"Running"*|*"Executing"*) post "working" "$line" ;;
  esac
done

EXIT=$?
if [ $EXIT -eq 0 ]; then
  post "done" "codex completed"
else
  post "error" "codex exited with $EXIT"
fi
exit $EXIT
```

설치: `chmod +x ~/.maple-overlay/bin/codex` + shell rc에 `export PATH="$HOME/.maple-overlay/bin:$PATH"` 추가.

## Gemini CLI Wrapper

동일 패턴, gemini의 출력 형식에 맞춰 휴리스틱 패턴만 조정.

## 휴리스틱 한계 + 보수성

- wrapper는 stdout/stderr만 보므로 정확도 한계 있음 → **확신 없으면 `working` 유지**
- 잘못된 `done` 알림은 가장 나쁜 UX. `done`은 명확한 신호(exit code 0 + 완료 키워드)에서만
- 사용자 설정으로 휴리스틱 패턴 조정 가능하도록 설계 (예: `~/.maple-overlay/codex-patterns.json`)

## 실패 모드

- webhook 호출 실패: wrapper에서 silent fail (`|| true`). 원본 명령어 동작 절대 방해 X
- Claude Code hook 실패: Anthropic 권장 정책 따름. exit 2 → state=error로 매핑
- 알 수 없는 hook 이벤트: `working` + 원본 정보 message에 포함

## agent_name 충돌

같은 종류 에이전트가 여러 인스턴스로 띄워질 수 있다. 셸 wrapper에서 환경변수 `MAPLE_AGENT_INSTANCE`로 suffix 부여:
```bash
AGENT="codex${MAPLE_AGENT_INSTANCE:+-$MAPLE_AGENT_INSTANCE}"
```

## 새 에이전트 추가 (후속 작업)

1. 페이로드 스키마는 그대로 (불변)
2. 새 매핑 표를 `_workspace/adapter-engineer/{new-agent}-mapping.md`에 작성
3. 통합 방식 결정: hooks 지원 → 직접 사용, 미지원 → wrapper
4. installation-guide에 새 에이전트 섹션 추가
5. renderer-engineer에게 SendMessage로 새 agent_name 통보 (캐릭터 매핑 UI 갱신용)

## PoC 검증 (Phase 0)

실제 페이로드를 캡처하여 매핑이 맞는지 확인:
```bash
nc -l 40429
# 다른 터미널에서 Claude Code 작업 수행
# 캡처된 raw payload를 매핑 표와 대조
```
