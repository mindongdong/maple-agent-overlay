# 📄 [PRD] 메이플 에이전트 오버레이 (Maple Agent Overlay)

## 1. 프로젝트 개요

Claude Code, Codex, Gemini CLI 등 AI 코딩 에이전트의 작업 상태를 메이플스토리 캐릭터로 시각화하는 데스크탑 오버레이 위젯. 지루한 대기 시간을 줄이고 '퀘스트 완료' 효과음으로 도파민과 작업 동기를 부여한다.

- **타겟 플랫폼:** Windows, macOS (Electron 기반)
- **핵심 가치:** 코딩 몰입감 증대, 다중 에이전트 상태 직관 확인, 저리소스
- **MVP 원칙:** Claude Code 단일 에이전트 + 단일 캐릭터로 dogfooding 후 확장

---

## 2. 주요 기능 요구사항

### 2.1. 윈도우 동작 방식

- 투명 배경(Transparent), 프레임리스(Frameless), 항상 위(Always on Top, `screen-saver` 레벨)
- 기본 위치: 화면 우측 하단
- macOS 호환: `visibleOnAllWorkspaces: true`, `setVisibleOnAllWorkspaces({ visibleOnFullScreen: true })`
- **Click-through 토글:** 기본 `setIgnoreMouseEvents(true, { forward: true })`. renderer에서 `mousemove` 추적 → 캐릭터/말풍선 hit-zone 진입 시 false 전환, 이탈 시 true 복귀
- 풀스크린 게임/비디오 위에는 표시되지 않을 수 있음 (OS 한계, 사용자에게 명시 고지)

### 2.2. 다중 캐릭터 배치 옵션

| 옵션 | 설명 | 구현 방식 |
|---|---|---|
| A. 가로 정렬 (기본) | 우→좌 정렬 | 단일 BrowserWindow + flexbox |
| B. 세로 정렬 | 하→상 스택 | 단일 BrowserWindow + flexbox |
| C. 독립 분리 (Detached) | 각자 자유 배치 | 캐릭터당 별도 BrowserWindow (5개 초과 시 메모리 경고) |

### 2.3. 상태 시각화 플로우

| State | 진입 효과 (0~2초) | 사운드 |
|---|---|---|
| `idle` | 퀘스트 전구 깜빡임 | - |
| `working` | 퀘스트 책 + 둥둥 애니메이션 (CSS `translateY` keyframe) | - |
| `pending_approval` | `?` 말풍선 깜빡임 | (선택) 알림음 |
| `done` | 퀘스트 완료 도장 | 완료 효과음 |
| `error` | 붉은 `!` 아이콘 | 피격 효과음 |

- 2초 후 아이콘 fade-out → 말풍선으로 페이로드 `message` 표시
- `done`/`error` 5초 경과 → `idle` 자동 복귀
- 캐릭터 모션은 CSS 애니메이션으로 흉내 (Nexon API는 정적 이미지 1장만 제공)

### 2.4. 에이전트 통신 규격

**HTTP 웹훅 서버 (Electron 메인 프로세스 내장)**

- 기본 포트: **40429** → 사용 중이면 40430, 40431… 자동 fallback. 트레이에 현재 포트 표시
- 보안: `127.0.0.1` 바인딩만 허용 (외부 접근 차단). 옵션으로 토큰 헤더 지원
- Endpoint: `POST /event`

```json
{
  "agent_name": "claude_code",
  "state": "working",
  "message": "src/components/Button.tsx 리팩토링 중..."
}
```

### 2.5. 에이전트 어댑터 레이어 (Phase 0 핵심)

각 에이전트의 통합 방식이 다르므로 어댑터 별도 설계.

| 에이전트 | 통합 방식 | 매핑 |
|---|---|---|
| **Claude Code** | 공식 `hooks` 기능의 **HTTP handler** 직접 사용 | `PreToolUse` / `PostToolUse` → `working`, `Notification`(permission_prompt) → `pending_approval`, `Stop` / `SubagentStop` → `done`, exit code 2 → `error`, `SessionStart` → `idle` |
| **Codex CLI** | Wrapper 셸 스크립트 (`codex` 호출 가로채서 stdout/stderr 파싱 후 webhook 발사) | 휴리스틱 기반 상태 추론 |
| **Gemini CLI** | Wrapper 방식 (동일) | 동일 |

**Claude Code 설정 예시 (`~/.claude/settings.json`)**

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }],
    "Notification": [{
      "matcher": "permission_prompt",
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }],
    "Stop": [{
      "hooks": [{ "type": "http", "url": "http://127.0.0.1:40429/event" }]
    }]
  }
}
```

→ 어댑터 서버가 Claude Code의 hook payload를 수신해 자체 페이로드 형식으로 변환.

### 2.6. 캐릭터 및 시스템 설정

- **온보딩:** Nexon Open API Key 입력 → 캐릭터명 입력 → OCID 조회 → `character_basic.character_image` URL 획득 → **PNG 로컬 캐시** (이후 오프라인 동작, Rate Limit 회피)
- **캐릭터 풀 관리:** 여러 캐릭터 등록 가능
- **에이전트 매핑:** 설정 UI에서 `agent_name` ↔ 캐릭터 1:1 매핑. API 요청 수신 시 `agent_name` 기반으로 해당 캐릭터 위젯만 독립 업데이트
- **로컬 에셋:** 상태 아이콘(png/gif) 및 효과음(.mp3)은 외부 통신 없이 Electron 앱 내부에 정적 포함

### 2.7. 방해 금지 및 제어 (System Tray)

- **Mute:** 시각적 애니메이션·말풍선 유지, 효과음만 차단
- **Hide Widget:** 위젯 숨김 (백그라운드 웹훅 서버는 계속 동작)
- **Layout 전환:** 가로 / 세로 / Detached
- **현재 포트 표시 + 서버 재시작**
- **Quit**

---

## 3. 기술 스택

- **App Framework:** Electron.js
- **Frontend:** React + Vite (정적 빌드) / Tailwind / CSS Animation
- **Backend (Local Server):** Node.js `http` 또는 경량 Express (`127.0.0.1`만 listen)
- **External API:** Nexon MapleStory Open API (캐릭터 정보·외형 이미지)
- **Adapter:** Claude Code hooks (HTTP type) / Codex·Gemini는 셸 wrapper

---

## 4. 개발 마일스톤 (MVP)

### Phase 0 — 어댑터 PoC (1~2일)
- Claude Code hooks → 로컬 `nc -l 40429`로 실제 페이로드 캡처 및 상태 매핑 검증

### Phase 1 — Core Overlay
- 투명/프레임리스 창 + 하드코딩 이미지 + Click-through 토글 + 드래그

### Phase 2 — Webhook + 단일 에이전트
- 40429 서버 + Claude Code 어댑터 1종 + 5가지 상태 렌더링 (단일 캐릭터)

### Phase 3 — Multi-Agent
- `agent_name` 라우팅 + 가로/세로/Detached 레이아웃

### Phase 4 — Integration & Polish
- Nexon API 연동 + 캐릭터 캐시 + 트레이 메뉴 + 설정 UI + Codex/Gemini wrapper

---

## 5. 비기능 요구사항 / 제약

- **Nexon API Rate Limit:** 분당 500회 → 캐릭터 이미지는 최초 1회 fetch 후 영구 캐시
- **보안:** 웹훅 서버는 loopback-only, 외부 IP 바인딩 금지
- **포트 충돌:** 자동 fallback 정책 + 트레이 노출
- **성능:** Detached 모드 윈도우 5개 초과 시 사용자 경고
- **법적:** Nexon Open API ToS상 비상업 개인 용도 한정 (배포 시 재확인 필수)
