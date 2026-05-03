# Multi-Agent 라우팅 (단일 출처)

복수 캐릭터가 한 화면(또는 별도 윈도우)에 존재할 때 어떤 페이로드가 어떤 캐릭터로 가야 하는지.

## 라우팅 2단계

**1단계 — 메인 router** ([`src/main/router.ts`](../../src/main/router.ts)):
- unified (horizontal/vertical): 단일 윈도우에 그대로 전달
- detached: `payload.agent_name` 과 일치하는 윈도우에만 전달

**2단계 — 렌더러 useAgentState** ([`src/renderer/src/hooks/useAgentState.ts`](../../src/renderer/src/hooks/useAgentState.ts#L62)):
- 윈도우가 받은 페이로드 중 `payload.agent_name === this.agentName` 인 것만 반영

→ Detached 모드에서는 메인이 이미 거르므로 렌더러 필터는 **방어선** 역할. unified 에서는 렌더러 필터가 **분배 역할**.

## 매핑 테이블 (예시)

```
agent:event { agent_name: 'codex', state: 'working', ... }

[horizontal/vertical]                  [detached]
        │                                    │
        ▼                                    ▼
   single window                  router.perAgent.get('codex')
        │                                    │
   ┌────┴────┐                               ▼
   │  flex   │                      window-for-codex.send(payload)
   │ ┌─┬─┬─┐ │                               │
   │ │A│B│C│ │                               ▼
   │ └─┴─┴─┘ │                          codex character
   └─────────┘
        │
   각 Character 의 useAgentState(name)
   가 자기 이름이면 반영, 아니면 무시
```

## 구현 매핑

| 동작 | 위치 |
|------|------|
| 메인 라우팅 | [`src/main/router.ts:11-29`](../../src/main/router.ts#L11) |
| 렌더러 라우팅 | [`useAgentState.ts:61-63`](../../src/renderer/src/hooks/useAgentState.ts#L61) — `if (parsed.data.agent_name !== agentName) return` |
| 윈도우 → agent 매핑 (detached) | [`src/main/layout.ts:69`](../../src/main/layout.ts#L69) `active.perAgent.set(agent, win)` |
| URL 컨텍스트 파싱 | [`useInitialContext.ts`](../../src/renderer/src/hooks/useInitialContext.ts) → [`shared/layout.ts:parseInitialContextFromSearch`](../../src/shared/layout.ts#L52) |

## 매핑 누락 처리 (detached)

router 에서 `perAgent.get(agent_name)` 가 undefined 면:
- 페이로드 drop
- console.warn 로 어떤 agent 가 등록되어 있는지 함께 출력

→ 사용자가 `MAPLE_AGENTS` 에 빠뜨린 에이전트의 이벤트가 들어오면 침묵 실패 X, 명시적 경고.

## 알 수 없는 agent_name (Phase 3 정책)

unified 에서 등록되지 않은 agent_name 이 들어오면:
- 메인은 그대로 단일 윈도우에 전달
- 렌더러의 어떤 Character 의 useAgentState 도 매칭하지 않음 → 화면 변화 없음 (silent)

이것이 unified 에서의 의도된 동작 (filter 역할). Phase 4 에서 자동 등록(auto-grow on first sight) 옵션 검토.

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-03 | 초안 작성 | Phase 3 — Multi-Agent 시작 |
