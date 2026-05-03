import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';
import {
  buildInitialContextSearch,
  type InitialContext,
} from '../shared/layout';

export interface OverlaySize {
  width: number;
  height: number;
}

export interface OverlayPosition {
  x: number;
  y: number;
}

interface CreateOpts {
  size: OverlaySize;
  position: OverlayPosition;
  context: InitialContext;
}

/**
 * 오버레이용 BrowserWindow 1개 생성 — 보안/투명/click-through 기본값을 한 곳에서 관리.
 *
 * 레이아웃별 사이즈/위치는 호출자가 결정. URL 쿼리로 InitialContext 전달.
 */
export function createOverlayWindow({ size, position, context }: CreateOpts): BrowserWindow {
  const win = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,

    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    focusable: false,

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }
  win.setIgnoreMouseEvents(true, { forward: true });

  win.once('ready-to-show', () => win.show());

  const search = buildInitialContextSearch(context);
  const isDev = !app.isPackaged;
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${search}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), {
      search: search.startsWith('?') ? search.slice(1) : search,
    });
  }

  return win;
}
