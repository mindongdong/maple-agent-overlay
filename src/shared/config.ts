import { z } from 'zod';
import { LayoutSchema, DEFAULT_LAYOUT } from './layout';

/**
 * userData/config.json 스키마. Phase 4 영속화 단일 출처.
 *
 * 변경 시 [`src/main/config.ts`](../main/config.ts) 의 default 도 함께 갱신.
 * 새 필드 추가 시 .default() 부여하여 구버전 config 와 호환.
 */
export const ConfigSchema = z.object({
  layout: LayoutSchema.default(DEFAULT_LAYOUT),
  agents: z.array(z.string().min(1)).default(['claude_code']),
  mute: z.boolean().default(false),
  hidden: z.boolean().default(false),
  webhookToken: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
