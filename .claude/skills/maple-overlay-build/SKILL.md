---
name: maple-overlay-build
description: Maple Agent Overlay (Electron 데스크탑 오버레이 위젯) 프로젝트의 빌드/구현/확장을 5명 전문가 팀(electron-architect, renderer-engineer, adapter-engineer, api-integrator, integration-qa)으로 조율한다. PRD에 정의된 투명 오버레이 창, Click-through, 5상태(idle/working/pending_approval/done/error) 시각화, 메이플 캐릭터 위젯, Claude Code hooks 어댑터, Codex/Gemini wrapper, Nexon API 캐릭터 캐시, 시스템 트레이, 멀티 윈도우(가로/세로/Detached) 레이아웃 작업이 필요할 때 반드시 이 스킬을 사용할 것. 후속 키워드: 다시 실행, 재실행, 업데이트, 수정, 보완, 새 에이전트 추가, 새 상태 추가, 새 캐릭터 추가, QA 재실행, 보안 감사, Phase {N} 다시. 단순 PRD 질문은 직접 답변 가능하지만 코드 작업이 끼면 반드시 트리거.
---

# Maple Overlay Build — Orchestrator

PRD에 정의된 Maple Agent Overlay를 5명의 전문가 팀으로 빌드하는 오케스트레이터.

## 워크플로우 시작 전: 컨텍스트 확인 (Phase 0)

워크플로우 시작 시 `_workspace/` 존재 여부를 확인하여 실행 모드를 결정한다.

| `_workspace/` 상태 | 사용자 요청 | 실행 모드 |
|------------------|-----------|---------|
| 미존재 | 신규 빌드 요청 | **초기 실행** — Phase 1부터 전체 진행 |
| 존재 | 부분 수정 (예: "효과음 톤 조정") | **부분 재실행** — 해당 에이전트만 재호출 |
| 존재 | 새 입력 (예: 새 PRD 갱신) | **새 실행** — `_workspace/`를 `_workspace_prev/`로 이동 후 신규 진행 |
| 존재 | "QA 다시" / "보안 감사" | **검증만 재실행** — integration-qa만 호출 |

## 팀 구성

**모드: 에이전트 팀** (도메인 간 인터페이스 합의가 핵심이므로 팀 통신 필수)

5명, opus 모델 통일:

| 팀원 | 역할 | 핵심 산출물 |
|------|------|-----------|
| **electron-architect** | 메인 프로세스, 윈도우, 트레이, IPC | `src/main/`, `ipc-contract.md` |
| **renderer-engineer** | React UI, 5상태 애니메이션, 말풍선, hit-zone | `src/renderer/`, `ui-states.md` |
| **adapter-engineer** | Claude Code hooks, Codex/Gemini wrapper | `payload-schema.md`, `*-mapping.md`, wrapper 셸 |
| **api-integrator** | Nexon API, 캐시, 온보딩, agent_name 매핑 | `src/lib/nexon*`, `cache-strategy.md` |
| **integration-qa** | 경계면 교차 비교, 보안 감사 | `boundary-checks.md`, `security-audit.md` |

리더는 본 오케스트레이터(메인 컨텍스트)가 담당. `TeamCreate`로 5명 구성, `TaskCreate`로 작업 분배, 팀원들은 `SendMessage`로 자체 조율.

## Phase별 실행 계획 (PRD 마일스톤 정렬)

### Phase 1 (PoC + Core Overlay) — **adapter-engineer + electron-architect 병렬**

**작업:**
- adapter-engineer: Claude Code hooks PoC. `nc -l 40429`로 실제 페이로드 캡처 → 매핑 표 작성
- electron-architect: 투명/프레임리스 BrowserWindow + click-through + 드래그 + 하드코딩 이미지 표시
- renderer-engineer: 임시 하드코딩 캐릭터 표시용 최소 React 앱

**합의 포인트 (SendMessage 필수):**
- IPC 채널 명세 초안 (electron-architect → renderer-engineer)
- 페이로드 스키마 초안 (adapter-engineer → 전체)

**검증 (점진적 QA):**
- integration-qa가 페이로드 스키마 ↔ Claude Code 실제 hook payload 일치 확인 (checkpoint 1, 4)

### Phase 2 (Webhook + 단일 에이전트) — **electron-architect + adapter-engineer + renderer-engineer**

**작업:**
- electron-architect: webhook-server 통합, IPC 연결
- adapter-engineer: Claude Code 어댑터 변환 레이어 완성
- renderer-engineer: 5상태 시각화 + 말풍선 + 5초 자동 복귀

**검증:**
- integration-qa가 Webhook → IPC → Renderer 흐름 전체 검증 (checkpoint 1~4)
- 보안: 127.0.0.1 바인딩 확인 (HIGH)

### Phase 3 (Multi-Agent) — **electron-architect + renderer-engineer**

**작업:**
- electron-architect: 가로/세로/Detached 레이아웃 윈도우 관리
- renderer-engineer: agent_name 라우팅 + 멀티 캐릭터 store

**검증:**
- 5상태가 모든 캐릭터에서 독립적으로 동작
- Detached 5+개 시 경고

### Phase 4 (Integration & Polish) — **api-integrator + electron-architect + adapter-engineer 병렬**

**작업:**
- api-integrator: Nexon API + safeStorage + 캐시 + 온보딩
- electron-architect: 트레이 메뉴 완성
- adapter-engineer: Codex/Gemini wrapper 셸 스크립트 + 설치 가이드
- renderer-engineer: 설정 UI (agent_name ↔ 캐릭터 매핑)

**검증 (전체 통합):**
- integration-qa가 모든 경계면 + 보안 감사 + Rate Limit 전체 검증

## 실행 모드: 에이전트 팀 패턴

```
[오케스트레이터/리더]
    ├── TeamCreate({
    │     team_name: 'maple-overlay-team',
    │     members: ['electron-architect', 'renderer-engineer',
    │                'adapter-engineer', 'api-integrator', 'integration-qa']
    │   })
    ├── TaskCreate(Phase 1 작업들, 의존성 표기)
    ├── 팀원들이 SendMessage로 합의 포인트 자체 조율
    ├── Phase별 산출물 검토 + 다음 Phase 작업 추가
    ├── 최종 통합 산출물 정리
    └── TeamDelete (또는 후속 작업 위해 유지)
```

**모든 Agent 호출에 `model: "opus"` 명시.**

## 데이터 전달 프로토콜

| 전략 | 적용 | 사례 |
|------|------|------|
| **태스크 기반** (`TaskCreate`) | 작업 진행 추적, 의존 관리 | "Phase 2: webhook 통합" 태스크가 "Phase 1: 페이로드 스키마" 완료 후 시작 |
| **메시지 기반** (`SendMessage`) | 실시간 합의, 경고 | adapter가 페이로드 필드 추가 시 renderer/electron에 즉시 통보 |
| **파일 기반** (`_workspace/`) | 산출물, 명세, 코드 | `payload-schema.md`, `ipc-contract.md` 등 |

### 작업 디렉토리 컨벤션

```
_workspace/
├── electron-architect/
│   ├── window-config.md
│   ├── ipc-contract.md       ← electron의 단일 출처
│   └── tray-spec.md
├── renderer-engineer/
│   ├── ui-states.md          ← 5상태 단일 출처
│   └── hit-zone-spec.md
├── adapter-engineer/
│   ├── payload-schema.md     ← 페이로드 단일 출처
│   ├── claude-code-mapping.md
│   ├── codex-wrapper.sh
│   └── gemini-wrapper.sh
├── api-integrator/
│   ├── nexon-api-spec.md
│   ├── cache-strategy.md
│   └── onboarding-flow.md
└── integration-qa/
    ├── boundary-checks.md
    ├── security-audit.md
    └── regression-log.md
```

최종 산출물(실행 가능 코드)은 `src/main/`, `src/renderer/`, `src/lib/`로. `_workspace/`는 명세/근거/검증 보고서 보존용.

## 에러 핸들링

| 에러 유형 | 정책 |
|---------|------|
| 팀원 응답 실패 | 1회 재시도. 재실패 시 그 결과 없이 진행 + 보고서에 누락 명시 |
| 도메인 간 상충 (예: IPC 채널명 불일치) | 어느 쪽 삭제 금지. 양쪽 출처 병기하여 사용자/리더가 결정 |
| 보안 위반 발견 | HIGH 우선순위. 즉시 사용자에게 보고, 수정 전 다음 Phase 진행 차단 |
| Phase 0 PoC 실패 (Claude Code hook 페이로드 매핑 실패) | adapter-engineer가 매핑 보수적으로 (working 폴백). PoC 결과를 사용자에게 보고하고 진행 |

## 후속 작업 패턴

### "QA 다시 돌려줘"
1. Phase 0 컨텍스트 확인 → `_workspace/integration-qa/` 존재 여부
2. integration-qa만 단독 호출 (`Agent` 도구로 단일 호출, 팀 재구성 불필요)
3. 새 보고서를 `regression-log.md`에 추가 (이전 보고서 보존)

### "새 에이전트(예: Aider) 추가해줘"
1. adapter-engineer 단독 호출 → 새 매핑 표 작성
2. renderer-engineer에게 SendMessage → 캐릭터 매핑 UI 갱신 (필요 시)
3. integration-qa에게 새 페이로드 형식 검증 요청

### "Detached 레이아웃 버그 고쳐줘"
1. 영향 도메인 파악 (electron-architect ± renderer-engineer)
2. 작은 팀(2명)으로 재구성 또는 단독 호출
3. 수정 후 integration-qa 회귀 검증

### "효과음/톤 바꿔줘"
1. renderer-engineer 단독 호출
2. assets/ 교체 + ui-states.md 갱신
3. integration-qa는 LOW 우선순위라 생략 가능

## 후속 작업 키워드 인식

다음 표현은 **모두 본 오케스트레이터 트리거**에 해당:
- "다시 실행", "재실행", "다시 빌드"
- "Phase {1,2,3,4} 다시"
- "{도메인} 부분만 수정", "{도메인} 업데이트"
- "QA 재실행", "보안 감사", "회귀 테스트"
- "새 에이전트 추가", "새 상태 추가", "새 캐릭터 추가", "새 레이아웃 추가"
- "PRD 변경 반영", "스펙 업데이트"

## 산출물 체크리스트

각 Phase 종료 시 확인:
- [ ] `_workspace/{agent}/` 산출물 존재 + 단일 출처 일관
- [ ] 코드가 실행 가능 상태 (`pnpm dev` 또는 동등)
- [ ] integration-qa 보고서에 HIGH 항목 0개
- [ ] PRD의 비기능 요구사항 (Rate Limit, loopback bind, 5+ 윈도우 경고) 충족
- [ ] CLAUDE.md 변경 이력 갱신

## 테스트 시나리오

### 정상 흐름
1. 사용자: "PRD 기반으로 Phase 1 (PoC + Core Overlay) 시작해줘"
2. 오케스트레이터: 컨텍스트 확인 (신규) → 팀 구성 → 어댑터 PoC + 투명 창 + 임시 렌더러 병렬 실행
3. integration-qa가 페이로드 매핑 검증 → PASS
4. 결과 정리, Phase 2 진행 여부 사용자 확인

### 에러 흐름
1. 사용자: "Phase 2 진행"
2. integration-qa가 webhook 서버에서 `0.0.0.0` 바인딩 발견 (HIGH)
3. 오케스트레이터: 즉시 사용자에게 보안 위반 보고 + Phase 3 진행 차단
4. electron-architect에게 수정 task 생성
5. 수정 후 integration-qa 재검증 → PASS → Phase 3 진행

## 참조

- PRD: `PRD.md`
- 에이전트 정의: `.claude/agents/{name}.md`
- 도메인 스킬: `.claude/skills/{electron-overlay-window, react-character-widget, agent-adapter, nexon-maple-api, webhook-server, integration-qa-overlay}/SKILL.md`
