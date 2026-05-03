# Maple Agent Overlay

Electron 데스크탑 오버레이 위젯. AI 코딩 에이전트(Claude Code/Codex/Gemini)의 작업 상태를 메이플스토리 캐릭터로 시각화한다. 자세한 사양은 [PRD.md](PRD.md) 참조.

## 하네스: Maple Agent Overlay

**목표:** PRD 기반 Electron 오버레이 위젯을 5명 전문가 팀(electron-architect, renderer-engineer, adapter-engineer, api-integrator, integration-qa)으로 빌드·확장한다.

**트리거:** 본 프로젝트의 빌드/구현/확장/QA/보안 감사 작업 요청 시 `maple-overlay-build` 스킬을 사용하라. 다음 키워드에서 트리거:
- 빌드/구현: "Phase {1,2,3,4} 시작", "오버레이 만들어", "위젯 구현"
- 확장: "새 에이전트 추가", "새 상태 추가", "새 캐릭터 추가", "새 레이아웃 추가"
- 후속: "다시 실행", "재실행", "{도메인} 업데이트", "QA 재실행", "보안 감사", "회귀 테스트", "PRD 변경 반영"

단순 PRD 질문/조회는 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-02 | 초기 구성 (5 에이전트 + 6 스킬 + 오케스트레이터) | 전체 | PRD 기반 신규 하네스 구축 |
| 2026-05-02 | Phase 0: 프로젝트 스캐폴딩 (electron-vite + React + TS + Tailwind) + 캡처 도구 | scripts/, src/, _workspace/adapter-engineer/ | PRD Phase 0 PoC + 빌드 기반 |
| 2026-05-02 | Phase 1: 투명/프레임리스/alwaysOnTop 창 + click-through IPC + 둥둥 캐릭터 placeholder | src/main/, src/preload/, src/renderer/, _workspace/{electron-architect,renderer-engineer,integration-qa}/ | PRD Phase 1 — Core Overlay |
| 2026-05-02 | Phase 2: shared payload (zod) + webhook 서버(40429+ fallback) + Claude Code 어댑터 + IPC `agent:event` + 5상태 useAgentState hook + StateIcon/SpeechBubble | src/shared/, src/main/{webhook,adapter}/, src/renderer/src/{hooks,components}/ | PRD Phase 2 — Webhook + 단일 에이전트 |
| 2026-05-03 | Phase 3: shared layout + InitialContext (zod) + 가로/세로/Detached 윈도우 매니저 + agent_name 라우팅(메인 router + 렌더러 필터 2단계) + Detached 5+ 가드 + 윈도우별 click-through 독립 + IPC `layout:set` | src/shared/layout.ts, src/main/{layout,state,router}.ts, src/main/{window,ipc,index}.ts 갱신, src/renderer/src/hooks/useInitialContext.ts, App.tsx 갱신 | PRD Phase 3 — Multi-Agent + 레이아웃 |
| 2026-05-03 | Phase 4: Config 영속화 + 시스템 트레이 (Mute/Hide/Layout/Restart/Copy hooks/Quit) + WebAudio 효과음 + Nexon API (safeStorage 키 / 토큰 버킷 Rate Limit / in-flight dedup / 캐시) + 커스텀 프로토콜 `maple-character://` (path traversal 방어) + Codex/Gemini wrapper 셸 + CLI 온보딩 | src/shared/{config,character}.ts, src/main/{config,tray,nexon}/, src/renderer/src/hooks/{useMute,useSound,useCharacterMap}, scripts/{onboard*,wrappers/}, resources/icons/ | PRD Phase 4 — Integration & Polish |
