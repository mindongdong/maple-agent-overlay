import { contextBridge, ipcRenderer } from 'electron';
import type { Payload } from '../shared/payload';
import type { Layout } from '../shared/layout';
import type { AgentImageMap } from '../shared/character';

/**
 * 렌더러에 노출되는 안전한 API 표면.
 *
 * 노출 원칙: 필요한 함수만, 인자 검증은 메인 IPC 핸들러에서 한 번 더 수행.
 * ipcRenderer 자체를 노출하지 않는다.
 */
const overlay = {
  /** hit-zone 진입/이탈 토글. */
  setMouseIgnore: (ignore: boolean): void => {
    ipcRenderer.send('mouse:set-ignore', ignore);
  },

  /** 어댑터 페이로드 수신. unsubscribe 함수 반환. */
  onAgentEvent: (cb: (payload: Payload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: Payload): void => cb(payload);
    ipcRenderer.on('agent:event', handler);
    return () => ipcRenderer.removeListener('agent:event', handler);
  },

  /** 레이아웃 전환 요청 (트레이 + dev). */
  setLayout: (layout: Layout): void => {
    ipcRenderer.send('layout:set', layout);
  },

  /** agent_name → 캐시된 캐릭터 이미지 URL 매핑. 부팅 시 1회 + 변경 알림 시 재호출. */
  getCharacterMap: (): Promise<AgentImageMap> => ipcRenderer.invoke('characters:get'),

  /** 매핑 변경 알림. unsubscribe 반환. */
  onCharacterMapChanged: (cb: (map: AgentImageMap) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, map: AgentImageMap): void => cb(map);
    ipcRenderer.on('characters:changed', handler);
    return () => ipcRenderer.removeListener('characters:changed', handler);
  },

  /** Mute 상태 변경 알림 (트레이 → 메인 → 렌더러). */
  onMuteChanged: (cb: (mute: boolean) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, mute: boolean): void => cb(mute);
    ipcRenderer.on('tray:mute', handler);
    return () => ipcRenderer.removeListener('tray:mute', handler);
  },

  /** 부팅 시 1회 mute 초기값 조회. */
  getMute: (): Promise<boolean> => ipcRenderer.invoke('tray:get-mute'),
};

contextBridge.exposeInMainWorld('overlay', overlay);

export type OverlayBridge = typeof overlay;
