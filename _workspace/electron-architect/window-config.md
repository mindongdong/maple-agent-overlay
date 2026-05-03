# Overlay Window 설정 결정 근거

[`src/main/window.ts`](../../src/main/window.ts) 의 BrowserWindow 옵션 결정 근거.

## 핵심 옵션

| 옵션 | 값 | PRD 근거 / 이유 |
|------|------|---------------|
| `transparent` | `true` | PRD §2.1 — 투명 배경 |
| `frame` | `false` | PRD §2.1 — 프레임리스 |
| `alwaysOnTop` | `true` + `screen-saver` 레벨 | PRD §2.1 — 가장 높은 z-order |
| `resizable` | `false` | 위젯이라 사이즈 변경 불필요 |
| `movable` | `true` | PRD Phase 1 — 드래그 |
| `minimizable / maximizable / fullscreenable` | `false` | 위젯 의도와 무관 |
| `skipTaskbar` | `true` | 작업표시줄(Win)/Dock(macOS) 노출 안 함 |
| `hasShadow` | `false` | 투명 배경과 그림자 충돌 회피 |
| `focusable` | `false` | 다른 앱 포커스 강탈 방지 — 코딩 작업 흐름 보존 |

## 위치

`screen.getPrimaryDisplay().workArea` 기준 우측 하단 + 24px 여백 ([`src/main/window.ts:7-15`](../../src/main/window.ts#L7-L15)).

## macOS 호환

```ts
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
```

다른 데스크탑 / 풀스크린 앱 위에서도 보이게. 단 일부 풀스크린 게임/비디오 위는 OS 가 차단할 수 있다 (PRD §2.1 명시 한계).

## 보안 (`webPreferences`)

| 옵션 | 값 | 이유 |
|------|------|------|
| `sandbox` | `true` | preload + 렌더러를 chromium sandbox 안에서 실행 |
| `contextIsolation` | `true` | Node API 가 렌더러 전역에 새지 않음 |
| `nodeIntegration` | `false` | Node API 직접 사용 차단. 필요한 API 는 preload contextBridge 로만 |

`integration-qa` HIGH 체크포인트와 일치.

## 초기 click-through 상태

```ts
win.setIgnoreMouseEvents(true, { forward: true });
```

기본 ON. 렌더러 [`HitZone`](../../src/renderer/src/components/HitZone.tsx) 가 마우스 진입 시 false 로 토글. 자세한 시퀀스는 [`../renderer-engineer/hit-zone-spec.md`](../renderer-engineer/hit-zone-spec.md) 참조.

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | 초안 작성 | Phase 1 — Core Overlay 시작 |
