import { z } from 'zod';

/**
 * Nexon API 로 받은 캐릭터 메타데이터 (개별).
 *
 * userData/character-cache/index.json 의 한 항목 형식.
 */
export const CharacterEntrySchema = z.object({
  ocid: z.string().min(1),
  character_name: z.string().min(1),
  /** 로컬 캐시 파일 이름 (디렉토리 내) — 보통 `${ocid}.png` */
  file: z.string().min(1),
  /** ISO timestamp */
  cached_at: z.string(),
});
export type CharacterEntry = z.infer<typeof CharacterEntrySchema>;

export const CharacterIndexSchema = z.array(CharacterEntrySchema);

/**
 * agent_name → ocid 매핑. userData/agent-character-map.json 형식.
 */
export const AgentCharacterMapSchema = z.record(z.string().min(1), z.string().min(1));
export type AgentCharacterMap = z.infer<typeof AgentCharacterMapSchema>;

/**
 * 렌더러로 보내는 즉시-사용 페이로드: agent_name → 이미지 URL (custom protocol).
 *
 * 매핑이 없거나 이미지 캐시가 없는 agent 는 키에서 제외 → 렌더러가 placeholder 사용.
 */
export const AgentImageMapSchema = z.record(z.string().min(1), z.string().url());
export type AgentImageMap = z.infer<typeof AgentImageMapSchema>;

/** 커스텀 프로토콜 prefix. file:// 직접 노출 회피 + sandbox 안전. */
export const CHARACTER_PROTOCOL = 'maple-character';

export function buildCharacterUrl(ocid: string): string {
  // ocid 외부 입력이지만 영숫자/하이픈만 허용되는 ID 라 path 인코딩 안전
  return `${CHARACTER_PROTOCOL}://${encodeURIComponent(ocid)}.png`;
}
