# 통일 페이로드 스키마

이 프로젝트의 모든 어댑터는 다음 단일 형식으로 webhook을 호출한다. 이 문서가 **단일 출처(single source of truth)**다. 변경 시 `renderer-engineer`, `electron-architect`, `integration-qa` 에 SendMessage로 통보한다.

## 스키마

```ts
type Payload = {
  agent_name: string;     // 식별자. claude_code | codex | gemini | <future>. 다중 인스턴스는 suffix (예: claude_code-1)
  state: State;           // 5개 enum (아래 표)
  message: string;        // 사람이 읽을 수 있는 1~2줄. 비어있어도 됨 (default '')
};

type State =
  | 'idle'              // 작업 없음, 세션 시작 직후
  | 'working'           // 도구 실행 중 / 명령 진행 중
  | 'pending_approval'  // 사용자 승인 대기
  | 'done'              // 작업 완료 (5초 후 idle 자동 복귀)
  | 'error';            // 에러 발생 (5초 후 idle 자동 복귀)
```

## 예시

```json
{ "agent_name": "claude_code", "state": "working",
  "message": "Edit src/components/Button.tsx" }

{ "agent_name": "codex", "state": "pending_approval",
  "message": "Approval required: rm -rf node_modules" }

{ "agent_name": "claude_code", "state": "done", "message": "" }
```

## 검증 (zod)

```ts
import { z } from 'zod';

export const StateSchema = z.enum([
  'idle', 'working', 'pending_approval', 'done', 'error',
]);

export const PayloadSchema = z.object({
  agent_name: z.string().min(1).max(50),
  state: StateSchema,
  message: z.string().max(500).default(''),
});

export type Payload = z.infer<typeof PayloadSchema>;
```

이 schema는 다음 위치에서 그대로 사용한다 (중복 정의 금지):
- `webhook-server` 의 입력 검증
- 메인 → 렌더러 IPC 페이로드
- 렌더러의 `useAgentState` 훅 입력 검증

## 엔드포인트

| Method | Path | 인증 | 응답 |
|--------|------|------|------|
| POST | `/event` | (옵션) `Authorization: Bearer <token>` | 204 또는 200 `{ok:true}` |

## 변환 규칙 (어댑터별)

### Claude Code (hooks 직접 사용)
원시 hook payload → 통일 페이로드. 매핑 표는 [`claude-code-mapping.md`](./claude-code-mapping.md) 참조.

`agent_name`은 항상 `claude_code` 고정. 다중 인스턴스 식별이 필요해지면 환경변수 또는 hook payload 의 session id 등으로 suffix 부여를 검토.

### Codex / Gemini (wrapper 셸)
wrapper가 직접 통일 페이로드 형식으로 POST. 변환 레이어 없음. 매핑 표는 어댑터별 후속 문서로.

## 불변 원칙

- 5개 state는 임의로 추가/제거하지 않는다. 추가 필요 시 `renderer-engineer` 와 합의 후 시각 효과 + 자동 복귀 정책 동시 갱신
- 필드 이름은 snake_case (PRD 예시 준수)
- 페이로드 크기 상한 10KB (webhook 서버에서 enforce)

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 작성 | Phase 0 시작. PRD §2.4 + §2.5 기반 |
