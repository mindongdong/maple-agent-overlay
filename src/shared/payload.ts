import { z } from 'zod';

/**
 * 어댑터 → 위젯 페이로드의 단일 출처.
 *
 * 명세는 _workspace/adapter-engineer/payload-schema.md.
 * 메인(webhook 서버, IPC) + 렌더러(상태 훅) 양쪽이 이 모듈을 import 해서 일관성 유지.
 */
export const StateSchema = z.enum([
  'idle',
  'working',
  'pending_approval',
  'done',
  'error',
]);

export const PayloadSchema = z.object({
  agent_name: z.string().min(1).max(50),
  state: StateSchema,
  message: z.string().max(500).default(''),
});

export type State = z.infer<typeof StateSchema>;
export type Payload = z.infer<typeof PayloadSchema>;

export const ALL_STATES: readonly State[] = StateSchema.options;
