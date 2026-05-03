import type { Payload } from '../shared/payload';
import type { ActiveWindows } from './layout';

/**
 * 어댑터 페이로드를 활성 레이아웃에 맞춰 올바른 윈도우(들)에 보낸다.
 *
 *  - unified (horizontal/vertical): 단일 윈도우에 그대로 send. 렌더러 측 useAgentState 가 agent_name 으로 필터
 *  - detached: 해당 agent_name 의 윈도우만 send. 매핑이 없으면 무시 + 로그
 */
export function routeAgentEvent(active: ActiveWindows, payload: Payload): void {
  // unified
  if (active.unified && !active.unified.isDestroyed()) {
    active.unified.webContents.send('agent:event', payload);
    return;
  }

  // detached
  const win = active.perAgent.get(payload.agent_name);
  if (!win) {
    console.warn(
      `[router] no window for agent "${payload.agent_name}" — drop. ` +
        `등록된 agents: [${[...active.perAgent.keys()].join(', ')}]`,
    );
    return;
  }
  if (!win.isDestroyed()) {
    win.webContents.send('agent:event', payload);
  }
}
