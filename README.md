# Maple Agent Overlay

메이플스토리 캐릭터로 AI 코딩 에이전트(Claude Code, Codex CLI, Gemini CLI)의 작업 상태를 시각화하는 데스크탑 오버레이 위젯. 자세한 사양은 [PRD.md](./PRD.md).

> **현재 단계**: Phase 4 완료 — Nexon API + 트레이 + 효과음 + Codex/Gemini wrapper. Phase 5(in-app 설정 GUI) 보류 중.

## 기술 스택

- Electron + electron-vite (main/preload/renderer 분리 빌드)
- React 18 + TypeScript + Tailwind CSS (renderer)
- Node.js `http` (메인 프로세스 내장 webhook 서버, loopback only)
- zod (모든 단일 출처 스키마)
- WebAudio API (효과음 합성 — .mp3 자산 없이)
- Electron `safeStorage` (Nexon API 키 암호화)

## 실행

```bash
npm install
npm run typecheck         # 타입 검증
npm run dev               # Electron 앱 띄우기
npm run build             # 프로덕션 빌드
```

## 디렉토리 구조

```
src/
├── shared/               # 메인/preload/렌더러 공유 단일 출처 스키마
│   ├── payload.ts        # Payload, State (zod)
│   ├── layout.ts         # Layout, InitialContext (zod)
│   ├── config.ts         # Config (zod, persisted)
│   └── character.ts      # CharacterEntry, AgentImageMap, maple-character://
├── main/                 # Electron 메인 프로세스
│   ├── adapter/          # Claude Code hook → 통일 페이로드
│   ├── nexon/            # Nexon Open API + safeStorage + 캐시 + 커스텀 프로토콜
│   ├── webhook.ts        # 127.0.0.1:40429+ 서버
│   ├── window.ts, layout.ts, router.ts
│   ├── tray.ts           # 시스템 트레이 메뉴
│   ├── config.ts         # userData/config.json 영속화
│   └── ipc.ts, index.ts
├── preload/              # contextBridge 노출 (함수 7개)
└── renderer/             # React UI

scripts/
├── capture-hooks.mjs     # Phase 0 PoC 캡처 도구
├── onboard.mjs           # Nexon 캐릭터 CLI 온보딩
├── onboard-runner.cjs    # Electron 컨텍스트 entry
└── wrappers/             # Codex / Gemini 셸 wrapper

resources/icons/          # 트레이 아이콘 (16×16 PNG)
_workspace/               # 에이전트별 명세 / 검증 보고서
.claude/                  # 하네스 (에이전트 + 스킬 + 오케스트레이터)
```

## 처음 사용하기

### 1. Claude Code 에 hooks 등록

`~/.claude/settings.json` 에 다음 추가 (또는 트레이 메뉴 "Copy hooks config snippet" 으로 클립보드에 복사):

```json
{
  "hooks": {
    "PreToolUse":   [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }] }],
    "PostToolUse":  [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }] }],
    "Notification": [{ "matcher": "permission_prompt",
                       "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }] }],
    "Stop":         [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }] }],
    "SessionStart": [{ "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }] }]
  }
}
```

### 2. (옵션) Nexon 캐릭터 등록

placeholder 캐릭터 대신 메이플 캐릭터를 쓰고 싶으면:

```bash
npm run onboard
# 또는 비대화형:
npm run onboard -- --key=YOUR_NEXON_KEY --name=캐릭터명 --agent=claude_code
```

키는 `safeStorage` 로 암호화되어 `userData/nexon-key.bin` 에 저장. 이미지는 `userData/character-cache/` 에 영구 캐시 (Rate Limit 회피).

### 3. (옵션) Codex / Gemini wrapper 설치

```bash
mkdir -p ~/.maple-overlay/bin
cp scripts/wrappers/codex scripts/wrappers/gemini ~/.maple-overlay/bin/
chmod +x ~/.maple-overlay/bin/{codex,gemini}
# shell rc 에 추가:
export PATH="$HOME/.maple-overlay/bin:$PATH"
```

이후 `codex` / `gemini` 호출이 자동으로 webhook 으로 상태 보고.

### 4. 시작

```bash
npm run dev
```

트레이 메뉴 (메이플 잎 아이콘) 에서:
- **Mute sounds** — 효과음 차단 (시각 효과는 유지)
- **Hide widget** — 위젯 숨김 (백그라운드 webhook 은 계속 동작)
- **Layout** — 가로 / 세로 / Detached 전환
- **Restart webhook server** — 포트 충돌 시 새 포트 fallback
- **Copy hooks config snippet** — 현재 포트가 적용된 settings.json snippet 을 클립보드로

## 마일스톤

| Phase | 상태 | 내용 |
|-------|------|------|
| 0 | ✅ | 어댑터 PoC + 프로젝트 스캐폴딩 |
| 1 | ✅ | 투명/프레임리스/alwaysOnTop 창 + Click-through + 드래그 |
| 2 | ✅ | webhook 서버(40429+) + Claude Code 어댑터 + 5상태 렌더링 |
| 3 | ✅ | Multi-agent 라우팅 + 가로/세로/Detached 레이아웃 |
| 4 | ✅ | Nexon API + 트레이 + 효과음 + Codex/Gemini wrapper |
| 5 | ⏭️ | In-app 설정 GUI, 캐시 무효화 UI, 윈도우 위치 영속화 |

## 보안 원칙

- webhook / 캡처 서버 모두 **`127.0.0.1`** 에만 바인딩 (외부 IP 절대 금지)
- BrowserWindow: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- preload: 7개 함수만 노출 (ipcRenderer 직접 노출 X)
- Nexon API 키: Electron `safeStorage` 로 암호화 (mode 0o600)
- 캐릭터 이미지 로드: 커스텀 프로토콜 `maple-character://` (path traversal 다중 방어)
- Rate Limit 셀프 한도: 분당 400회 (Nexon 한도의 80%)

## Phase 0 — Hook 페이로드 PoC (선택)

```bash
npm run poc:capture
# ~/.claude/settings.json 의 hooks url 을 출력된 포트로 맞추고 Claude Code 작업
# 캡처: _workspace/captures/<ts>-N.body.txt
# 매핑 검증: _workspace/adapter-engineer/claude-code-mapping.md
```

## 라이선스

비상업 개인 용도 한정 (Nexon Open API ToS 준수). 배포 전 ToS 재확인 필수.
