import { z } from 'zod';

/**
 * 위젯 배치 모드.
 *
 *  - horizontal: 단일 BrowserWindow + 가로 flex
 *  - vertical:   단일 BrowserWindow + 세로 flex
 *  - detached:   캐릭터당 별도 BrowserWindow
 *
 * Detached 5개 초과는 사용자에게 경고 후 거부 (PRD §2.2).
 */
export const LayoutSchema = z.enum(['horizontal', 'vertical', 'detached']);
export type Layout = z.infer<typeof LayoutSchema>;

export const ALL_LAYOUTS: readonly Layout[] = LayoutSchema.options;

export const DEFAULT_LAYOUT: Layout = 'horizontal';

/** Detached 모드 윈도우 상한. PRD §2.2 + §5 */
export const MAX_DETACHED_WINDOWS = 5;

/**
 * 렌더러가 부팅 시 메인으로부터 받는 초기 컨텍스트.
 *
 * URL 쿼리 파라미터로 전달 (window.loadURL/loadFile 의 search). 이유:
 *  - dev/prod 양쪽에서 동일하게 동작
 *  - Detached 모드의 N 윈도우가 각자 다른 agent 를 받기 쉬움
 *  - 비동기 IPC 보다 페인트 전 동기 접근 가능
 */
export const InitialContextSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('horizontal'),
    agents: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    mode: z.literal('vertical'),
    agents: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    mode: z.literal('detached'),
    agent: z.string().min(1),
  }),
]);
export type InitialContext = z.infer<typeof InitialContextSchema>;

/** URL 검색 문자열 → InitialContext 파싱. 실패 시 fallback (단일 horizontal/claude_code). */
export function parseInitialContextFromSearch(search: string): InitialContext {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');

  if (mode === 'detached') {
    const agent = params.get('agent') ?? 'claude_code';
    return { mode, agent };
  }
  if (mode === 'horizontal' || mode === 'vertical') {
    const agents = (params.get('agents') ?? 'claude_code')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { mode, agents: agents.length ? agents : ['claude_code'] };
  }
  return { mode: 'horizontal', agents: ['claude_code'] };
}

/** InitialContext → URL 쿼리 문자열 ('?...' 포함). */
export function buildInitialContextSearch(ctx: InitialContext): string {
  const params = new URLSearchParams();
  params.set('mode', ctx.mode);
  if (ctx.mode === 'detached') {
    params.set('agent', ctx.agent);
  } else {
    params.set('agents', ctx.agents.join(','));
  }
  return `?${params.toString()}`;
}
