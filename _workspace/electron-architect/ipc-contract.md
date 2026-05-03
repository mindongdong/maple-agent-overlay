# IPC 채널 명세 (단일 출처)

이 문서가 모든 IPC 채널의 단일 출처. 추가/변경 시 [`renderer-engineer`](../renderer-engineer/) 와 즉시 합의.

## 채널 표

| 채널 | 방향 | 페이로드 | 용도 |
|------|------|----------|------|
| `mouse:set-ignore` | 렌더러 → 메인 | `boolean` | hit-zone 진입/이탈. 보낸 윈도우만 토글 (Detached 다중 윈도우 독립 동작) |
| `agent:event` | 메인 → 렌더러 | `Payload` (zod) | 어댑터 페이로드 라우팅. router 가 레이아웃별로 분기 |
| `layout:set` | 렌더러 → 메인 | `Layout` | 레이아웃 전환. 트레이 + dev preload 양쪽에서 호출 |
| `characters:get` | 렌더러 → 메인 (invoke) | (없음) → `AgentImageMap` | 부팅 시 1회. agent_name → 이미지 URL |
| `characters:changed` | 메인 → 렌더러 | `AgentImageMap` | 캐릭터 매핑 변경 알림 |
| `tray:mute` | 메인 → 렌더러 | `boolean` | mute 상태 변경 푸시 |
| `tray:get-mute` | 렌더러 → 메인 (invoke) | (없음) → `boolean` | 부팅 시 1회 mute 초기값 |

## 트레이 액션 (직접 IPC 채널 X — 메인-내부 호출)

트레이 메뉴는 메인 프로세스 내부에서 직접 콜백 실행 ([`tray.ts`](../../src/main/tray.ts) → [`index.ts`](../../src/main/index.ts) 의 toggleMute/Hide, applyLayout, restartWebhook). 별도 IPC 채널 없음.

| 트레이 항목 | 메인 동작 | 렌더러로 푸시되는 부수 효과 |
|-----------|---------|------------------------|
| Mute checkbox | `writeConfig({mute})`, broadcast `tray:mute` | `tray:mute` |
| Hide checkbox | `writeConfig({hidden})`, win.hide()/show() | (없음 — webhook 계속 동작) |
| Layout radio | `applyLayout(layout)` | 윈도우 destroy/recreate, 자동으로 새 컨텍스트로 재로드 |
| Restart webhook | `webhook.restart()`, tray.update({port}) | (없음) |
| Copy hooks config | `clipboard.writeText(json)` | (없음) |
| Quit | `app.quit()` | (없음) |

## Phase 별 도입 시점

| Phase | 채널 |
|-------|------|
| 1 | `mouse:set-ignore` |
| 2 | `agent:event` |
| 3 | `layout:set` (sender 윈도우 기반 mouse:set-ignore 로 진화) |
| 4 (현재) | `characters:get/changed`, `tray:mute`, `tray:get-mute` |

## 안전 원칙

- preload 는 ipcRenderer 자체를 노출하지 않는다. 함수 7개만 (`setMouseIgnore`, `onAgentEvent`, `setLayout`, `getCharacterMap`, `onCharacterMapChanged`, `onMuteChanged`, `getMute`)
- 메인 핸들러는 인자를 zod 또는 `typeof` 로 한 번 더 검증
- `mouse:set-ignore` 는 `event.sender` 의 윈도우만 토글
- 모든 invoke 핸들러는 main-only 데이터를 반환 (기존 캐시/매핑 read)

## 단일 출처 모듈

| 모듈 | 정의 | 양쪽 import |
|------|------|----------|
| `Payload`, `State` | [`src/shared/payload.ts`](../../src/shared/payload.ts) | main + preload + renderer |
| `Layout`, `InitialContext` | [`src/shared/layout.ts`](../../src/shared/layout.ts) | main + preload + renderer |
| `Config` | [`src/shared/config.ts`](../../src/shared/config.ts) | main 전용 (Phase 4) |
| `CharacterEntry`, `AgentImageMap`, `CHARACTER_PROTOCOL` | [`src/shared/character.ts`](../../src/shared/character.ts) | main + preload + renderer |

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 (Phase 1) | Core Overlay |
| 2026-05-02 | `agent:event` 실제 구현 | Phase 2 |
| 2026-05-03 | `mouse:set-ignore` sender 기반, `layout:set` 추가 | Phase 3 |
| 2026-05-03 | `characters:get/changed`, `tray:mute`, `tray:get-mute` 추가. 트레이 액션 동작 표 명시 | Phase 4 |
