# 시스템 트레이 (단일 출처)

PRD §2.7 — Mute / Hide / Layout / Restart / Quit + 현재 포트 표시.

## 메뉴 구성 ([`tray.ts`](../../src/main/tray.ts))

```
🍁 Maple Overlay
├─ Port: 40429                         (disabled label)
├─ Copy hooks config snippet           (clipboard 에 settings.json snippet)
├─ ──────────────────
├─ ☐ Mute sounds                        (checkbox, persisted)
├─ ☐ Hide widget                        (checkbox, persisted, 백그라운드 webhook 유지)
├─ ──────────────────
├─ Layout                               (submenu, radio)
│  ├─ ◯ 가로 정렬
│  ├─ ◯ 세로 정렬
│  └─ ◯ Detached (분리)
├─ ──────────────────
├─ Restart webhook server              (포트 충돌 시 새 포트 fallback)
├─ ──────────────────
└─ Quit
```

## 아이콘

| 플랫폼 | 파일 | 비고 |
|-------|------|------|
| macOS | [`resources/icons/trayTemplate.png`](../../resources/icons/trayTemplate.png) | 알파만 (template image), `setTemplateImage(true)` → 다크/라이트 자동 적응 |
| Windows / Linux | [`resources/icons/tray.png`](../../resources/icons/tray.png) | 노란색 + 갈색 테두리 (메이플 톤) |

생성 방식: Phase 4 의 inline node 스크립트 (zlib + 수동 PNG encoding). 16×16. `scripts/build-tray-icon.mjs` 로 재생성 가능 (현재 인라인, 추후 분리 가능).

추가로 macOS 는 [`tray.setTitle('🍁')`](../../src/main/tray.ts#L41) 로 메뉴바 텍스트도 표시.

## 동작 ↔ Config 동기화

모든 토글은 [`writeConfig`](../../src/main/config.ts#L40) 로 `userData/config.json` 에 영속. 다음 시작 시 [`readConfig`](../../src/main/config.ts#L20) 가 복원.

| 토글 | config 필드 | 부수 효과 |
|------|----------|--------|
| Mute | `mute` | broadcast `tray:mute` IPC → renderer useMute 갱신 → useSound 가 호출 무시 |
| Hide | `hidden` | 모든 윈도우 hide()/show() — webhook 서버는 계속 동작 (PRD §2.7) |
| Layout | `layout` | destroy 후 새 모드로 createForLayout |

## Restart webhook

기존 서버 close → 새 listen 시도. 포트 충돌이 있었으면 새 포트로 fallback (40430+). [`tray.update({port})`](../../src/main/tray.ts#L48) 로 메뉴 라벨 즉시 갱신.

## Copy hooks config

현재 listening 포트가 적용된 `~/.claude/settings.json` snippet 을 클립보드에 복사 ([`tray.ts:88`](../../src/main/tray.ts#L88)). 사용자 편의 — 직접 포트 수정 안 해도 됨.

## window-all-closed 정책 변경

Phase 3 까지: 모든 윈도우 close → app.quit() (macOS 외).
Phase 4: **트레이가 살아있으면 quit 하지 않음.** Hide widget 으로 모든 윈도우 hide 해도 백그라운드 webhook 유지 (PRD §2.7 명시 요구사항).

[`index.ts:122-125`](../../src/main/index.ts#L122) 의 `window-all-closed` 핸들러는 의도적으로 빈 함수.

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-03 | 초안 작성 | Phase 4 — Integration & Polish |
