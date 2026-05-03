---
name: nexon-maple-api
description: Nexon MapleStory Open API를 호출하여 캐릭터명→OCID 조회, character_basic.character_image URL 획득, PNG를 로컬에 영구 캐싱한다. Rate Limit(분당 500회) 회피, 토큰 버킷, in-flight dedup, safeStorage로 API 키 암호화, Electron userData 디렉토리 캐시 관리가 필요하면 반드시 이 스킬을 사용할 것. 온보딩 플로우(키 입력→캐릭터명 입력→이미지 다운로드), 다중 캐릭터 풀 관리, agent_name↔캐릭터 매핑 데이터 모델, 캐시 새로고침을 다룰 때 트리거.
---

# Nexon Maple API

## 언제 이 스킬을 쓰는가

- 사용자에게 Nexon Open API 키 + 캐릭터명을 받는 온보딩을 만들 때
- 캐릭터 이미지를 다운로드하여 영구 캐싱할 때
- 다중 캐릭터 풀 관리, agent_name ↔ 캐릭터 매핑 데이터 모델을 정의할 때
- Rate Limit 안전장치 (토큰 버킷, in-flight dedup) 가 필요할 때

## 핵심 엔드포인트

| 용도 | Method | Path | 주요 쿼리/응답 |
|------|--------|------|---------------|
| OCID 조회 | GET | `/maplestory/v1/id` | `?character_name=...` → `{ocid: string}` |
| 기본 정보 | GET | `/maplestory/v1/character/basic` | `?ocid=...&date=...` → `{character_image: url, ...}` |

**Base URL:** `https://open.api.nexon.com`
**헤더:** `x-nxopen-api-key: {USER_KEY}`

응답 스키마는 zod로 검증한다 (외부 API 신뢰 금지):
```ts
const OcidResponse = z.object({ ocid: z.string() });
const BasicResponse = z.object({
  character_image: z.string().url(),
  character_name: z.string(),
  // 필요한 필드만 추가
});
```

## 온보딩 플로우 (단계별)

1. **API 키 입력** → 사용자가 nexon developer portal에서 발급한 키 붙여넣기
2. **키 유효성 검증** → 가벼운 호출 (예: 자기 OCID 조회)로 401 여부 확인
3. **캐릭터명 입력** → 사용자가 공식 닉네임 입력
4. **OCID 조회** → `/id?character_name=...`
5. **기본 정보 조회** → `/character/basic?ocid=...`
6. **이미지 다운로드** → `character_image` URL을 fetch하여 PNG로 저장
7. **메타데이터 저장** → `index.json`에 캐릭터 등록
8. **온보딩 완료** → renderer에 `agent:character-pool-updated` IPC 발사

## 캐시 디렉토리 구조

```
{app.getPath('userData')}/character-cache/
├── index.json                    # [{character_name, ocid, file: 'a1b2c3.png', cached_at}]
└── {ocid}.png                    # 다운로드된 캐릭터 이미지
```

**index.json 예시:**
```json
[
  { "character_name": "메이플전사", "ocid": "abc123", "file": "abc123.png", "cached_at": "2026-05-02T10:00:00Z" }
]
```

## 캐시 정책 (NEVER 위반)

- 캐시 hit이면 외부 호출 0회 (PRD: "이후 영구 캐시" 원칙)
- 캐시 무효화는 사용자 명시 요청 시만 (트레이 메뉴 또는 설정 UI)
- 캐시 누락 시 즉시 재다운로드 (사용자 허락 불필요, 자기 캐릭터이므로)

## API 키 보안

평문 저장 금지. Electron `safeStorage` 사용:
```ts
import { safeStorage } from 'electron';

function saveKey(key: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption not available on this platform');
  }
  const encrypted = safeStorage.encryptString(key);
  fs.writeFileSync(keyPath, encrypted);
}

function loadKey(): string | null {
  if (!fs.existsSync(keyPath)) return null;
  const encrypted = fs.readFileSync(keyPath);
  return safeStorage.decryptString(encrypted);
}
```

저장 위치: `{userData}/credentials.bin` (디렉토리 권한 0700 권장).

## Rate Limit 안전장치

- 한도: **분당 500회**, 안전 마진 **80%** → 분당 400회 셀프-제한
- 토큰 버킷: 60초 윈도우, 400 토큰
- in-flight dedup: 같은 OCID에 대한 동시 요청은 하나의 Promise를 공유

```ts
const inflight = new Map<string, Promise<Buffer>>();
async function getCharacterImage(ocid: string): Promise<Buffer> {
  if (inflight.has(ocid)) return inflight.get(ocid)!;
  const p = fetchAndCache(ocid).finally(() => inflight.delete(ocid));
  inflight.set(ocid, p);
  return p;
}
```

Rate Limit 도달 시: silent fail 금지. 사용자에게 명시적 메시지 (대기 후 재시도 권유).

## agent_name ↔ 캐릭터 매핑

별도 파일로 관리:
```
{userData}/agent-character-map.json
```

```json
{
  "claude_code": "abc123",
  "codex": "def456",
  "gemini": "ghi789"
}
```

매핑 변경은 설정 UI에서 수행 (renderer 영역). 본 스킬은 **데이터 모델과 read/write 헬퍼만** 제공:
```ts
function readMap(): Record<string, string> { /* ... */ }
function setMapping(agentName: string, ocid: string): void { /* ... */ }
```

매핑 변경 시 `agent:character-pool-updated` IPC로 렌더러에 통보.

## 이미지 사용 방식 (renderer 합의)

- 옵션 A: `file://{userData}/character-cache/{ocid}.png` 절대 경로
- 옵션 B: 메인이 IPC로 base64 또는 Buffer 전달

권장: **옵션 A** (간단, 오버헤드 없음). renderer에서 직접 `<img src="file://...">`. Electron 보안 설정에서 file:// 프로토콜 허용 필요할 수 있음 — 그 경우 `protocol.registerFileProtocol`로 커스텀 프로토콜(`maple-character://`)을 만들어 sandbox 안전성 유지.

## 에러 분기

| 코드 | 의미 | 사용자 조치 |
|------|------|----------|
| 401 | API 키 무효 | 키 재입력 |
| 404 | OCID 없음 (캐릭터명 오타) | 캐릭터명 확인 |
| 429 | Rate Limit 초과 | 대기 후 재시도 |
| 5xx | Nexon 서버 오류 | 잠시 후 재시도 |
| 네트워크 실패 | 오프라인/방화벽 | 캐시가 있으면 그대로 진행 |

## 법적 고지

- Nexon Open API ToS: **비상업 개인 용도 한정**
- 배포 시 README + 설정 화면 + 온보딩 화면에 명시
- 상업 배포 전 ToS 재확인 필수

## 후속 작업 시

- 새 캐릭터 추가: index.json append + 매핑 UI 연동
- 캐시 마이그레이션 (디렉토리 구조 변경): 기존 index.json 읽어 신구조로 이전
- API 응답 필드 추가 활용: zod 스키마 확장 + 캐시 메타데이터 갱신
