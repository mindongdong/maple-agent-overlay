# Multi-Agent 레이아웃 (단일 출처)

3가지 레이아웃 모드의 윈도우 / 위치 / 라우팅 설계.

## 레이아웃 모드

| Mode | 구성 | URL 쿼리 | 라우팅 |
|------|------|---------|------|
| `horizontal` | 단일 BrowserWindow + 가로 flex (N 캐릭터) | `?mode=horizontal&agents=a,b,c` | 메인이 단일 윈도우에 send. 렌더러 useAgentState 가 agent_name 으로 필터 |
| `vertical` | 단일 BrowserWindow + 세로 flex (N 캐릭터) | `?mode=vertical&agents=a,b,c` | 동일 |
| `detached` | N BrowserWindow (캐릭터당 1개) | `?mode=detached&agent=x` | 메인 router 가 agent_name 일치 윈도우에만 send |

## 사이즈 / 위치

상수 ([`src/main/layout.ts`](../../src/main/layout.ts) 상단):

```
CELL_W = 240        // 캐릭터 셀 너비
CELL_H = 240        // 캐릭터 셀 높이
GAP    = 12         // 셀 간 간격
PAD    = 12         // 윈도우 내부 패딩
EDGE_MARGIN = 24    // 화면 가장자리 여백
```

| Mode | width 식 | height 식 |
|------|---------|---------|
| horizontal (N) | `CELL_W * N + GAP * (N-1) + PAD * 2` | `CELL_H + PAD * 2` |
| vertical (N) | `CELL_W + PAD * 2` | `CELL_H * N + GAP * (N-1) + PAD * 2` |
| detached | `CELL_W` | `CELL_H` (×N 윈도우) |

위치: 모든 모드 공통 — 화면 작업영역 우측 하단 기준 `EDGE_MARGIN` 여백. Detached 는 좌측으로 `CELL_W + GAP` 만큼 stagger.

## Detached 5개 한도 (PRD §2.2 + §5)

`agents.length > 5` 이면 [`dialog.showMessageBox`](../../src/main/layout.ts#L52) 로 경고 + 처음 5개만 생성.

상수: [`MAX_DETACHED_WINDOWS = 5`](../../src/shared/layout.ts#L20) (shared).

## 레이아웃 전환

```
[old layout]  ─ destroyAll() ─▶  [empty]  ─ createForLayout(new) ─▶  [new layout]
```

[`src/main/index.ts:13-19`](../../src/main/index.ts#L13) `applyLayout` 함수가 위 시퀀스 수행.

호출 경로:
- 시작 시: `bootWindows()` — `createInitialState()` 의 layout
- 런타임: IPC `layout:set` (Phase 4 tray, Phase 3 dev/preload 양쪽에서 사용 가능)

전환 후 위젯이 재로드되므로 현재 표시 중인 상태는 초기화. Phase 4 영속화로 보완 예정.

## 환경변수 (Phase 3 dev)

| 변수 | 값 | 효과 |
|------|------|------|
| `MAPLE_LAYOUT` | `horizontal\|vertical\|detached` | 시작 레이아웃 |
| `MAPLE_AGENTS` | CSV (예: `claude_code,codex,gemini`) | 표시할 agent_name 목록 |

기본값: `horizontal` + `[claude_code]`.

예:
```bash
MAPLE_LAYOUT=detached MAPLE_AGENTS=claude_code,codex,gemini npm run dev
```

## InitialContext (단일 출처)

[`src/shared/layout.ts`](../../src/shared/layout.ts) 의 `InitialContextSchema` (zod discriminated union) 가 메인-렌더러 공유 형식. URL 쿼리 ↔ 객체 변환은 `parseInitialContextFromSearch` / `buildInitialContextSearch`.

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-03 | 초안 작성 | Phase 3 — Multi-Agent 시작 |
