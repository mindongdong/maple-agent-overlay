# Phase 0 PoC — Claude Code hook 페이로드 캡처

PRD Phase 0 ("Claude Code hooks → 로컬 nc -l 40429로 실제 페이로드 캡처 및 상태 매핑 검증")의 실행 절차.

## 목표

1. Claude Code 가 `PreToolUse / PostToolUse / Notification / Stop / SessionStart` 등에서 실제로 어떤 페이로드를 보내는지 raw JSON으로 캡처한다
2. 캡처한 페이로드를 [`claude-code-mapping.md`](./claude-code-mapping.md)의 매핑 표와 대조하여 매핑이 실제 데이터와 일치하는지 검증한다
3. 검증 결과를 토대로 `payload-schema.md`(통일 페이로드 스키마) 와 매핑 표를 finalize 한다

## 실행 절차

### 1. 캡처 서버 띄우기

프로젝트 루트에서:

```bash
node scripts/capture-hooks.mjs
# 또는
npm run poc:capture
```

기본 포트는 `40429`. 사용 중이면 자동 fallback (`40430`, `40431`, ...). 콘솔에 출력되는 실제 listening URL을 확인한다.

### 2. Claude Code hooks 설정

`~/.claude/settings.json` 에 다음을 추가 (이미 있으면 url만 캡처 서버 주소에 맞춘다). `40429` 자리에 1번에서 표시된 실제 포트를 사용한다:

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

> 위 설정을 적용한 뒤 Claude Code 세션을 새로 시작해야 hooks 가 로드된다.

### 3. 다양한 시나리오 실행

다음 액션을 차례로 수행하면서 캡처를 모은다:

| # | 시나리오 | 기대 hook | 확인할 매핑 |
|---|---------|----------|------------|
| 1 | 새 Claude Code 세션 시작 | `SessionStart` | → `idle` |
| 2 | 간단한 파일 읽기 요청 | `PreToolUse` (Read) → `PostToolUse` | → `working` |
| 3 | 파일 편집 요청 | `PreToolUse` (Edit) | 도구명/인자가 message로 어떻게 들어오는지 확인 |
| 4 | 권한이 필요한 명령 (예: `git push` 처음 수행) | `Notification` (matcher: `permission_prompt`) | → `pending_approval` |
| 5 | 짧은 대화로 응답 마무리 | `Stop` | → `done` |
| 6 | (선택) 서브에이전트 사용 | `SubagentStop` | → `done` |

### 4. 결과 확인

- `_workspace/captures/` 디렉토리에 시각순으로 raw JSON + 헤더가 적재된다
- `_workspace/adapter-engineer/payload-samples.jsonl` 에 한 줄 = 한 캡처 형식으로 누적된다
- 콘솔에 시간 + 한 줄 요약 (`[1] 2026-05-02T...  PreToolUse / Edit`) 이 흐른다

### 5. 매핑 검증

캡처가 충분히 모이면 캡처 서버를 `Ctrl+C`로 종료. 다음을 점검한다:

- [ ] 표의 각 hook이 적어도 1번씩 잡혔다
- [ ] [`claude-code-mapping.md`](./claude-code-mapping.md) 의 → state 매핑이 의미적으로 맞는다
- [ ] message 추출 로직이 실제 페이로드 필드명을 정확히 사용한다 (`tool_name`, `prompt`, `tool_input.file_path` 등)
- [ ] 매핑되지 않는 hook이 있으면 `working`으로 폴백되는지 확인 (또는 새 매핑 추가)

검증 결과는 [`claude-code-mapping.md`](./claude-code-mapping.md) 의 "PoC 검증 결과" 섹션에 기록한다.

## 보안 체크 (캡처 도중에도 적용)

- 캡처 서버는 `127.0.0.1`에만 바인딩되어 있다 (`scripts/capture-hooks.mjs:97`). 외부 네트워크에 노출되지 않는다
- 캡처 파일에는 사용자가 작업 중이던 파일 경로 / 도구 인자가 포함될 수 있으므로 git에 commit 하지 말 것 (`.gitignore` 에 `_workspace/captures/` 추가됨)

## 다음 단계

PoC 검증이 끝나면:
- 매핑 표를 finalize → `claude-code-mapping.md`
- 통일 페이로드 스키마를 finalize → `payload-schema.md`
- 결과를 사용자에게 보고하고 Phase 1(Core Overlay) 진입 여부 결정
