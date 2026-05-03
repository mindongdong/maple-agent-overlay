---
name: integration-qa-overlay
description: Maple Agent Overlay 프로젝트의 도메인 간 경계면(boundary)을 교차 비교 검증한다. 어댑터 페이로드↔렌더러 상태 매핑, 메인↔렌더러 IPC shape 일치, 캐시 경로 규약, 보안(127.0.0.1 loopback bind, contextIsolation, safeStorage), Click-through hit-zone 동작, Rate Limit 준수를 점검할 때 반드시 이 스킬을 사용할 것. 통합 검증, QA, 회귀 테스트, 보안 감사 키워드에서 트리거.
---

# Integration QA — Maple Overlay

## 언제 이 스킬을 쓰는가

- 새 모듈/페어가 완성된 직후 (점진적 검증)
- 전체 빌드 완료 후 통합 정합성 감사
- 회귀 테스트 (이전 검증 통과 항목 재확인)
- 보안 감사 (배포 전, 또는 정기적으로)

## 검증 철학

**"파일이 있다" ≠ "통합이 작동한다."** 파일 존재 확인이 아니라, **두 파일을 동시에 읽고 shape/계약/행동을 비교**한다.

## 경계면별 검증 매트릭스

각 경계면에서 **두 파일을 동시에 열어 일치를 확인**한다.

### 1. 어댑터 → Webhook 서버 (HIGH)

**파일 비교:**
- `_workspace/adapter-engineer/payload-schema.md`
- `src/main/webhook.ts` (또는 통합 위치)

**체크포인트:**
- [ ] 페이로드 필드명(`agent_name`, `state`, `message`)이 정확히 일치
- [ ] state enum 5개 값이 양쪽 모두 동일
- [ ] zod schema가 페이로드 명세와 일치
- [ ] 검증 실패 시 처리(400 응답)가 구현됨

### 2. Webhook → IPC `agent:event` (HIGH)

**파일 비교:**
- 메인의 `webhook.on('event', ...)` 핸들러
- 메인의 `webContents.send('agent:event', ...)` 발신

**체크포인트:**
- [ ] 메시지 채널명이 `agent:event`로 일관 (오타 없음)
- [ ] webhook 페이로드의 모든 필드가 IPC payload로 전달됨
- [ ] 에러 시 IPC 미발사 (잘못된 데이터 누설 방지)

### 3. IPC `agent:event` → 렌더러 hook (HIGH)

**파일 비교:**
- `src/main/preload.ts`의 `onAgentEvent` 노출
- `src/renderer/hooks/useAgentState.ts`의 리스너

**체크포인트:**
- [ ] preload contextBridge로 노출된 API 이름이 hook이 호출하는 이름과 동일 (`window.overlay.onAgentEvent`)
- [ ] 페이로드 shape이 렌더러 zod schema와 일치
- [ ] agent_name 라우팅 로직이 매핑 누락 없이 작동

### 4. Hook 매핑 ↔ 5상태 정의 (HIGH)

**파일 비교:**
- `_workspace/adapter-engineer/claude-code-mapping.md`
- `_workspace/renderer-engineer/ui-states.md`

**체크포인트:**
- [ ] 매핑 표의 모든 → state 값이 5상태 enum에 존재
- [ ] 5상태 모두 최소 1개 hook에 매핑됨 (커버리지)
- [ ] `done`/`error` 5초 자동 복귀가 렌더러에 구현됨

### 5. Click-through Hit-Zone 동작 (MEDIUM)

**파일 비교:**
- `_workspace/electron-architect/ipc-contract.md` (`mouse:set-ignore`)
- `src/renderer/components/HitZone.tsx`
- `src/main/ipc.ts`의 핸들러

**체크포인트:**
- [ ] 캐릭터 + 말풍선 영역이 HitZone에 감싸짐 (투명 배경 포함 여부 검토)
- [ ] mouseenter/leave가 양방향 IPC 발사
- [ ] 메인이 `setIgnoreMouseEvents(ignore, { forward: true })`로 정확히 처리
- [ ] 디바운싱이 있어 IPC 폭주 없음

### 6. Nexon 캐시 경로 규약 (MEDIUM)

**파일 비교:**
- `_workspace/api-integrator/cache-strategy.md`
- 렌더러의 `<img src="..." />` 지점

**체크포인트:**
- [ ] 경로 형식 일치 (file:// 또는 maple-character:// 등 합의된 프로토콜)
- [ ] index.json 스키마가 양쪽에서 동일하게 해석됨
- [ ] 캐시 hit 시 외부 호출 0회 (네트워크 mock 또는 로그 검증)

### 7. agent_name ↔ 캐릭터 매핑 (MEDIUM)

**파일 비교:**
- `agent-character-map.json` 스키마
- 렌더러 store의 매핑 사용

**체크포인트:**
- [ ] 매핑이 없는 agent_name 도착 시 폴백 동작 정의됨 (예: 기본 캐릭터 또는 무시)
- [ ] 매핑 변경 IPC가 렌더러까지 전달됨

## 보안 감사 (HIGH, 배포 전 필수)

- [ ] webhook 서버가 **`127.0.0.1`에만 바인딩** (코드 grep: `0.0.0.0`, `''`, `'::'` 금지)
- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- [ ] preload의 contextBridge 노출 API가 **최소한**의 함수만 (불필요한 ipcRenderer 직접 노출 금지)
- [ ] Nexon API 키가 `safeStorage.encryptString`으로 암호화되어 저장됨
- [ ] webhook 페이로드 zod 검증 + 크기 상한(10KB)
- [ ] 외부 URL 로드 차단 (`will-navigate` 핸들러)
- [ ] 토큰 옵션 사용 시 `Authorization: Bearer` 정확히 검증

**보안 위반 발견 시 즉시 HIGH priority로 보고하고 수정 전 진행 차단.**

## Rate Limit 준수

- [ ] Nexon API 호출이 토큰 버킷(분당 400회 셀프-제한)을 거침
- [ ] in-flight dedup이 같은 OCID 동시 요청을 합침
- [ ] 캐시 hit 시 외부 호출 0회 (로그/카운터로 검증)

## 검증 실행 패턴

### 정적 검증 (코드 grep)

```bash
# 외부 IP 바인딩 검출
grep -nE "listen\([^,]+, *['\"](?:0\\.0\\.0\\.0|::)['\"]" src/

# nodeIntegration true 검출
grep -rn "nodeIntegration: true" src/

# 평문 키 저장 의심
grep -rn "writeFileSync.*api.?key" src/
```

### 동적 검증 (가능한 부분)

- webhook 서버를 띄우고 `nc localhost 40429` + 외부 IP 시도 (외부는 거부되어야 함)
- 캐시 디렉토리 미리 채우고 앱 실행 → 네트워크 호출 0회 확인 (Charles/mitmproxy 또는 코드 카운터)
- hit-zone 진입/이탈 시뮬레이션 (Spectron 또는 수동 마우스 이동)

### Phase 0 PoC 검증

```bash
nc -l 40429
# 다른 터미널에서 Claude Code 작업
# 캡처된 raw payload를 mapping 표와 대조
```

## 보고 양식

```markdown
# Integration QA Report — {YYYY-MM-DD}

## Summary
- HIGH: 0 / MEDIUM: 1 / LOW: 0
- 신규 발견: 1 / 회귀: 0

## HIGH
(none)

## MEDIUM
### M-001: hit-zone 디바운싱 누락
- **경계면:** Renderer ↔ Main IPC
- **증거:**
  - `src/renderer/components/HitZone.tsx:12` — debounce 없이 직접 IPC 발사
  - `_workspace/renderer-engineer/hit-zone-spec.md:24` — "16ms debounce" 명시
- **권고 수정:** renderer-engineer에게 task 생성

## LOW
(none)
```

**상충 발견 시 어느 쪽이 옳은지 단정하지 않는다.** 양쪽 출처와 차이를 보고하고 결정은 오케스트레이터/사용자에게.

## 점진적 QA 원칙

전체 완성 후 1회가 아니라, **각 모듈 또는 페어 완성 직후 즉시** 해당 부분만 검증. 예:
- adapter-engineer가 payload schema 확정 → 즉시 checkpoint 1, 4 검증
- electron-architect가 IPC contract 확정 → 즉시 checkpoint 2, 3 검증
- 보안 항목은 PR/배포 직전 항상 전체 재실행

## 우선순위 가이드

| 항목 | 우선순위 | 차단 여부 |
|------|---------|---------|
| 보안 (loopback bind, isolation, key encryption) | HIGH | 배포 차단 |
| 페이로드 ↔ 상태 매핑 | HIGH | 빌드 차단 |
| IPC shape 일치 | MEDIUM | 차단 안 함, 즉시 수정 권고 |
| Rate Limit / 캐시 | MEDIUM | 차단 안 함, 즉시 수정 권고 |
| 톤/UX | LOW | 사용자 피드백으로 |
