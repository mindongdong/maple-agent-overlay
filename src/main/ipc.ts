import { ipcMain, BrowserWindow } from 'electron';
import { LayoutSchema, type Layout } from '../shared/layout';
import {
  buildCharacterUrl,
  type AgentImageMap,
} from '../shared/character';
import { readAgentMap, hasImage } from './nexon/cache';

/**
 * 렌더러 → 메인 IPC 등록.
 *
 * 채널 명세는 _workspace/electron-architect/ipc-contract.md 가 단일 출처.
 */
export function registerIpc(opts: {
  onSetLayout: (layout: Layout) => void;
  getMute: () => boolean;
}): void {
  // mouse:set-ignore — 보낸 윈도우의 click-through 토글 (Detached 다중 윈도우 독립)
  ipcMain.on('mouse:set-ignore', (event, ignore: unknown) => {
    if (typeof ignore !== 'boolean') return;
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    win.setIgnoreMouseEvents(ignore, { forward: true });
  });

  // layout:set — Phase 4 tray + dev preload 양쪽에서 호출
  ipcMain.on('layout:set', (_event, layout: unknown) => {
    const parsed = LayoutSchema.safeParse(layout);
    if (!parsed.success) {
      console.warn('[ipc] invalid layout:set payload:', layout);
      return;
    }
    opts.onSetLayout(parsed.data);
  });

  // characters:get — 렌더러가 부팅 시 호출. agent_name → 이미지 URL 매핑 반환
  ipcMain.handle('characters:get', () => buildAgentImageMap());

  // tray:get-mute — 부팅 시 mute 초기값 조회
  ipcMain.handle('tray:get-mute', () => opts.getMute());
}

/**
 * 캐시된 PNG 가 실제로 존재하는 매핑만 반환 → 렌더러는 이 키에 없는 agent 는 placeholder 사용.
 */
export function buildAgentImageMap(): AgentImageMap {
  const result: AgentImageMap = {};
  const map = readAgentMap();
  for (const [agent, ocid] of Object.entries(map)) {
    if (typeof ocid === 'string' && hasImage(ocid)) {
      result[agent] = buildCharacterUrl(ocid);
    }
  }
  return result;
}
