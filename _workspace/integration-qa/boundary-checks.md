# Integration QA — 점진적 검증

## Phase 4 — Integration & Polish (현재)

- HIGH: 0 / MEDIUM: 0 / LOW: 0
- 검증 시점: Phase 4 완료 직후
- 차단 사유: 없음. 사용자 dev/실사용 단계 진입 가능

### 보안 감사 (HIGH)

| 체크포인트 | 결과 | 증거 |
|-----------|------|------|
| 외부 IP 바인딩 없음 | ✅ PASS | grep 0건 |
| `contextIsolation/sandbox/nodeIntegration` 옵션 위반 없음 | ✅ PASS | grep 0건 |
| preload 노출 함수 7개만 (ipcRenderer 직접 노출 X) | ✅ PASS | grep 결과 함수만 노출, raw ipcRenderer 노출 X |
| API 키 평문 저장 없음 | ✅ PASS | `safeStorage.encryptString` 만 사용. `writeFileSync.*api.?key` 검색 0건 |
| safeStorage 미지원 환경에서 저장 거부 | ✅ PASS | [`keystore.ts:18`](../../src/main/nexon/keystore.ts#L18) `isEncryptionAvailable()` 체크 후 throw |
| 키 파일 권한 0o600 | ✅ PASS | [`keystore.ts:28`](../../src/main/nexon/keystore.ts#L28) |
| 커스텀 프로토콜 path traversal 다중 방어 | ✅ PASS | [`protocol.ts:38-50`](../../src/main/nexon/protocol.ts#L38) — basename + 정규식 + resolve prefix |
| 커스텀 프로토콜 secure + standard scheme | ✅ PASS | [`protocol.ts:18-26`](../../src/main/nexon/protocol.ts#L18) `bypassCSP: false`, `corsEnabled: false` |
| 페이로드 zod 1차 (webhook) | ✅ PASS | [`adapter/index.ts`](../../src/main/adapter/index.ts) |
| 페이로드 zod 2차 (렌더러) | ✅ PASS | [`useAgentState.ts:60`](../../src/renderer/src/hooks/useAgentState.ts#L60) |
| 페이로드 크기 상한 (10KB) | ✅ PASS | [`webhook.ts:8`](../../src/main/webhook.ts#L8) |
| CSP 갱신 (img-src maple-character:) | ✅ PASS | [`renderer/index.html:6`](../../src/renderer/index.html#L6) |

### 신규 경계면 (Phase 4)

#### Boundary P1: Config 영속화 (HIGH)

| 위치 | 동작 |
|------|------|
| 단일 출처 스키마 | [`shared/config.ts`](../../src/shared/config.ts) `ConfigSchema` (zod) — 신규 필드는 `.default()` 부여로 구버전 호환 |
| read | [`config.ts:20`](../../src/main/config.ts#L20) — JSON parse → zod parse → 실패 시 `.bak` 백업 + DEFAULT 폴백 |
| write | [`config.ts:40`](../../src/main/config.ts#L40) — patch 머지 → zod parse → atomic write |
| cache | 메모리 cached + readConfig 의 lazy 초기화 |

✅ 잘못된 config.json 도 사용자 데이터 잃지 않고 복구 (.bak 백업).

#### Boundary P2: 트레이 ↔ 렌더러 mute (HIGH)

| 위치 | 흐름 |
|------|------|
| 트레이 click | [`tray.ts:60`](../../src/main/tray.ts#L60) → `cb.onToggleMute()` |
| 메인 처리 | [`index.ts:33`](../../src/main/index.ts#L33) — writeConfig + broadcast `tray:mute` + tray.update |
| 렌더러 수신 | [`useMute.ts`](../../src/renderer/src/hooks/useMute.ts) — `onMuteChanged` 구독 |
| 사운드 차단 | [`useSound.ts:54`](../../src/renderer/src/hooks/useSound.ts#L54) — `if (muted) return` |
| 부팅 sync | `getMute()` invoke 1회 |

✅ Push (변경 시) + Pull (부팅 시) 양쪽 — race condition 없음.

#### Boundary P3: agent_name → 캐릭터 이미지 (MEDIUM)

| 위치 | 흐름 |
|------|------|
| 메인 build | [`ipc.ts:buildAgentImageMap`](../../src/main/ipc.ts) — readAgentMap × hasImage 교집합만 |
| 메인 push | [`index.ts:broadcastCharacterMap`](../../src/main/index.ts) — 부팅 직후 setImmediate |
| invoke | `characters:get` |
| 렌더러 수신 | [`useCharacterMap.ts`](../../src/renderer/src/hooks/useCharacterMap.ts) — invoke + onChanged |
| 렌더 분기 | [`Character.tsx:43`](../../src/renderer/src/components/Character.tsx#L43) — `imageUrl` 있으면 img, 없으면 PlaceholderCharacter |

✅ 캐시 누락된 매핑은 자동으로 placeholder 폴백 (silent — UX 안전).

#### Boundary P4: Rate Limit + dedup (MEDIUM)

| 검증 | 위치 |
|------|------|
| 80% 셀프 한도 | [`ratelimit.ts:9`](../../src/main/nexon/ratelimit.ts#L9) `CAPACITY = 400` |
| 슬라이딩 윈도우 60초 | [`ratelimit.ts:6`](../../src/main/nexon/ratelimit.ts#L6) `WINDOW_MS = 60_000` |
| in-flight dedup | [`ratelimit.ts:30`](../../src/main/nexon/ratelimit.ts#L30) `dedup(key, factory)` |
| 캐시 hit 시 호출 0 | [`onboarding.ts:39`](../../src/main/nexon/onboarding.ts#L39) — `if (force \|\| !hasImage(ocid))` |

✅ 같은 OCID 동시 호출 → Promise 1개 공유. capacity 초과 → silent fail X, NexonApiError throw.

#### Boundary P5: 어댑터 wrapper (Codex/Gemini) → webhook (MEDIUM)

| 위치 | 동작 |
|------|------|
| Codex wrapper | [`scripts/wrappers/codex`](../../scripts/wrappers/codex) — 휴리스틱 + curl POST |
| Gemini wrapper | [`scripts/wrappers/gemini`](../../scripts/wrappers/gemini) — 동일 패턴 |
| 통일 페이로드 진입 | [`adapter/index.ts:18`](../../src/main/adapter/index.ts#L18) — `agent_name + state` 형식 인식 후 `PayloadSchema.safeParse` |

✅ wrapper silent fail (`|| true`) 로 원본 명령어 영향 X. JSON escape (따옴표/백슬래시/개행/300자 컷) 적용.

### 기존 경계면 (Phase 1~3 회귀 없음)

| Boundary | 결과 |
|----------|------|
| 1: 어댑터 ↔ 렌더러 상태 enum | ✅ shared 단일 출처 |
| 2: Webhook → IPC `agent:event` | ✅ |
| 5: hit-zone 디바운스 / 윈도우별 독립 | ✅ |
| L1: URL 쿼리 ↔ InitialContext | ✅ |
| L2: agent_name 라우팅 (메인 router + 렌더러 필터 2단계) | ✅ |
| L4: Detached 5+ 가드 | ✅ |

### 빌드 파이프라인

| 명령 | 결과 |
|------|------|
| `npm run typecheck` (node + web) | ✅ PASS |
| `npm run build` (clean) | ✅ PASS — 경고 0건 |
| 산출물 크기 | main 133.14kB / preload 1.37kB / renderer 336.17kB |

## ⚠️ Pending — 사용자 액션 필요

1. **PoC 캡처** (Phase 0 carry-over) — `npm run poc:capture` + Claude Code hooks 설정 → [`claude-code-mapping.md`](../adapter-engineer/claude-code-mapping.md) 의 PoC 결과 섹션 채우기
2. **Nexon 온보딩** — `npm run onboard` 실행 → 실제 캐릭터 이미지 확인. (옵션 — 없으면 placeholder 캐릭터로 동작)
3. **Codex/Gemini wrapper 설치** — `scripts/wrappers/codex`, `scripts/wrappers/gemini` 를 PATH 우선 디렉토리에 설치

## 의도적 deferral (Phase 5 후보)

- In-app 설정 GUI (현재는 CLI 온보딩 + JSON 파일만)
- 캐시 무효화 UI (현재 `--force` 플래그로만)
- 영구 윈도우 위치 저장 (현재 부팅 시 우측 하단으로 리셋)
- 자동 캐릭터 갱신

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-02 | Phase 1 검증 보고서 초안 | Core Overlay 완료 직후 |
| 2026-05-02 | Phase 2 검증 — webhook → IPC → 5상태 흐름 | Phase 2 완료 직후 |
| 2026-05-03 | Phase 3 검증 — InitialContext, 라우팅, click-through 윈도우별, Detached 5+ 가드 | Phase 3 완료 직후 |
| 2026-05-03 | Phase 4 검증 — Config 영속화, 트레이 mute/hide/layout, Nexon API 보안 (safeStorage + Rate Limit + path traversal 방어), 커스텀 프로토콜, wrapper 통합 | Phase 4 완료 직후 |
