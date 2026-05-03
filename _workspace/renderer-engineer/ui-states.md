# 5상태 시각화 정의 (단일 출처)

페이로드 `state` enum 5종에 대한 시각/사운드/전이 규칙. [`payload-schema.md`](../adapter-engineer/payload-schema.md) 와 동일 enum 사용.

## 상태 표

| state | 진입 효과 (0~2초) | 2초 후 | 사운드 | 자동 복귀 |
|-------|----------------|------|------|---------|
| `idle` | 💡 깜빡임 | fade-out, 정적 | - | - |
| `working` | 📖 깜빡임 + 둥둥(float) | 책 fade-out, 둥둥 지속 + message 말풍선 | - | - |
| `pending_approval` | ❓ 깜빡임 | 아이콘 fade-out + message 말풍선 | (mute 아니면) 알림음 | - |
| `done` | ✅ 깜빡임 | message 말풍선 | 완료 효과음 | 5초 후 idle |
| `error` | ❗ 깜빡임 | message 말풍선 | 피격 효과음 | 5초 후 idle |

## Phase 별 구현 상태

| Phase | 구현 |
|-------|------|
| 1 | 둥둥 애니메이션 (working 흉내) |
| 2 (현재) | **5상태 모두 + 진입 효과 + fade-out + 자동 복귀 + 라우팅** ✅ |
| 4 | 효과음 + mute 토글 |

## 구현 매핑

| 요소 | 위치 |
|------|------|
| State enum 단일 출처 | [`src/shared/payload.ts:8`](../../src/shared/payload.ts#L8) |
| 상태 → 아이콘 매핑 | [`src/renderer/src/components/StateIcon.tsx:3`](../../src/renderer/src/components/StateIcon.tsx#L3) |
| 진입 효과 / 자동 복귀 타이밍 | [`src/renderer/src/hooks/useAgentState.ts`](../../src/renderer/src/hooks/useAgentState.ts) (`ENTRY_FX_MS=2000`, `AUTO_IDLE_MS=5000`) |
| working = 둥둥 트리거 | [`Character.tsx:23`](../../src/renderer/src/components/Character.tsx#L23) (`showFloat = state === 'working'`) |
| 말풍선 표시 조건 | [`Character.tsx:24`](../../src/renderer/src/components/Character.tsx#L24) (`!entryActive && message.length > 0`) |

## CSS 애니메이션

| 클래스 | 정의 | 용도 |
|-------|------|------|
| `character-float` | 1.6s ease-in-out infinite, translateY ±6px | working 상태 둥둥 |
| `icon-blink` | 0.8s ease-in-out infinite, opacity 1↔0.35 | 진입 0~2초 깜빡임 |
| `icon-fade-after-entry` | 0.4s ease-out forwards, scale 0.85 + opacity 0 | 2초 후 페이드 아웃 |

[`src/renderer/src/index.css`](../../src/renderer/src/index.css) 참조.

## 자동 복귀 규칙

`done` / `error` 진입 후 5초 → `idle` 복귀. 새 이벤트가 도착하면 이전 타이머 cleanup. 구현: [`useAgentState.ts:51`](../../src/renderer/src/hooks/useAgentState.ts#L51).

## agent_name 라우팅

`useAgentState(agentName)` 가 IPC 페이로드에서 `agent_name === agentName` 인 경우만 반영. Phase 2 단계에서는 단일 캐릭터 (`claude_code`) 만 사용 — Phase 3 에서 멀티 라우팅으로 확장.

## 톤

- 픽셀 아트 (`shape-rendering: crispEdges` on SVG)
- 노란/베이지 (메이플 UI 톤)
- 효과음은 짧고 만족스럽게 (Phase 4)

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 작성. Phase 1 단계에서는 둥둥 애니메이션만 구현 | Phase 1 — Core Overlay |
| 2026-05-02 | 5상태 + 진입/페이드/자동 복귀 + 라우팅 완성 | Phase 2 — Webhook + 단일 에이전트 |
