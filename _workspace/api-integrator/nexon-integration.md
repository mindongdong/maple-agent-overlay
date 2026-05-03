# Nexon API 통합 (단일 출처)

Phase 4 완성 — Nexon Open API 호출, safeStorage 키 저장, 캐시, Rate Limit, 커스텀 프로토콜.

## 모듈 분할

| 모듈 | 책임 |
|------|------|
| [`keystore.ts`](../../src/main/nexon/keystore.ts) | safeStorage 로 API 키 암호화 read/write/delete |
| [`ratelimit.ts`](../../src/main/nexon/ratelimit.ts) | 토큰 버킷 (60초/400회 셀프-제한) + in-flight dedup |
| [`client.ts`](../../src/main/nexon/client.ts) | HTTP 호출, zod 검증, NexonApiError 분기 |
| [`cache.ts`](../../src/main/nexon/cache.ts) | userData/character-cache/ + agent-character-map.json read/write |
| [`protocol.ts`](../../src/main/nexon/protocol.ts) | `maple-character://` 커스텀 프로토콜 + path traversal 방어 |
| [`onboarding.ts`](../../src/main/nexon/onboarding.ts) | 키 → OCID → basic → 다운로드 → 캐시 → 매핑 (단일 함수) |

## API 키 보안

- `safeStorage.encryptString` 으로 OS keychain 기반 암호화
- 저장 위치: `userData/nexon-key.bin` (mode 0o600)
- 평문 저장 절대 금지 — grep 검증 통과
- safeStorage 미지원 환경에서는 저장 거부 (`isEncryptionAvailable()` false → throw)

## Rate Limit

- Nexon 한도: 분당 500회
- 셀프 한도: **분당 400회 (80% margin)** — [`ratelimit.ts:9`](../../src/main/nexon/ratelimit.ts#L9)
- 슬라이딩 윈도우: 최근 60초 호출 시각을 큐로 보관, capacity 도달 시 `tryTake` false
- in-flight dedup: 같은 OCID/캐릭명 동시 호출은 하나의 Promise 공유 ([`ratelimit.ts:23`](../../src/main/nexon/ratelimit.ts#L23))
- 도달 시 silent fail X — `NexonApiError('rate_limit', 429, ...)` throw → 호출자가 사용자에게 메시지

## 캐시 정책

- 캐시 hit 이면 외부 호출 0회 (PRD §5: 영구 캐시)
- 디렉토리: `userData/character-cache/`
  - `index.json` — `CharacterIndex` 메타
  - `{ocid}.png` — PNG 바이트
- 매핑: `userData/agent-character-map.json` — `AgentCharacterMap`
- 무효화: 사용자 명시 (`--force` 플래그). 자동 무효화 X
- ocid sanitization: `[^a-zA-Z0-9_-]` → `_` (path 안전성)

## 커스텀 프로토콜

```
maple-character://{ocid}.png
  → userData/character-cache/{ocid}.png
```

- `protocol.registerSchemesAsPrivileged` 로 secure + standard scheme 등록 (app.ready 이전)
- `protocol.handle` 에서 path traversal 다중 방어:
  1. basename 만 추출
  2. `^[a-zA-Z0-9_\-.]+\.png$` 정규식 화이트리스트
  3. resolve 후 cacheDir prefix 재검증
- file:// 직접 노출 X, sandbox 안전, CORS 비활성

## CSP 갱신

[`renderer/index.html:6`](../../src/renderer/index.html#L6) 의 `img-src` 에 `maple-character:` 추가 — 커스텀 프로토콜 이미지 허용. file: 제거 (불필요).

## 온보딩 플로우

CLI: `npm run onboard`

```
[ENTER]  Nexon API key  ──▶  safeStorage 암호화 저장
   │
   ▼
[ENTER]  캐릭터명  ──▶  fetchOcid → fetchBasic → fetchImage → cache.upsertEntry
   │
   ▼
[ENTER]  agent_name (선택)  ──▶  cache.setMapping
```

- 옵션 인자: `--key=` `--name=` `--agent=` `--force`
- 인터랙티브 또는 args 양쪽 지원
- safeStorage 가 main 프로세스 API 라 Electron 컨텍스트에서 실행 — `electron scripts/onboard-runner.cjs` 로 spawn
- 실패 분기: 401(키 무효), 404(이름 오타), 429(Rate Limit) — 사용자에게 명확한 메시지

## 렌더러 통합

- [`useCharacterMap`](../../src/renderer/src/hooks/useCharacterMap.ts) — `getCharacterMap()` invoke + `onCharacterMapChanged` 푸시 구독
- [`Character.tsx`](../../src/renderer/src/components/Character.tsx) — 매핑 hit 이면 `<img src="maple-character://...">`, 아니면 `PlaceholderCharacter`
- IPC `characters:changed` 는 부팅 직후 + 매핑 변경 시 push

## 법적 고지

- Nexon Open API ToS: **비상업 개인 용도 한정**
- README 명시 + 온보딩 출력에 노출 (Phase 5 in-app 설정 UI 에서도 표시 예정)

## Pending → Phase 5

- 캐시 무효화 UI (트레이 메뉴 또는 in-app 설정)
- agent_name ↔ 캐릭터 변경 UI (현재 CLI/JSON 만)
- 자동 갱신 옵션 (예: 1주일마다)

## 변경 이력

| 날짜 | 변경 | 사유 |
|------|------|------|
| 2026-05-03 | 초안 작성 | Phase 4 — Integration & Polish |
