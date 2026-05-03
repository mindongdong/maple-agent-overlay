import { Tray, Menu, nativeImage, clipboard, app } from 'electron';
import path from 'node:path';
import { ALL_LAYOUTS, type Layout } from '../shared/layout';

interface TrayState {
  port: number | null;
  layout: Layout;
  mute: boolean;
  hidden: boolean;
}

interface TrayCallbacks {
  onSetLayout: (layout: Layout) => void;
  onToggleMute: () => void;
  onToggleHide: () => void;
  onRestartWebhook: () => void;
}

const ICON_DIR = path.join(__dirname, '../../resources/icons');

function loadIcon(): Electron.NativeImage {
  // macOS: template 이미지 사용 → dark/light 자동 적응
  const file =
    process.platform === 'darwin'
      ? path.join(ICON_DIR, 'trayTemplate.png')
      : path.join(ICON_DIR, 'tray.png');
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return nativeImage.createEmpty();
  if (process.platform === 'darwin') img.setTemplateImage(true);
  return img;
}

export class OverlayTray {
  private tray: Tray | null = null;
  private state: TrayState = { port: null, layout: 'horizontal', mute: false, hidden: false };

  constructor(private readonly cb: TrayCallbacks) {}

  start(initial: Partial<TrayState>): void {
    this.state = { ...this.state, ...initial };
    this.tray = new Tray(loadIcon());
    this.tray.setToolTip('Maple Agent Overlay');
    if (process.platform === 'darwin') this.tray.setTitle('🍁');
    this.rebuild();
  }

  update(patch: Partial<TrayState>): void {
    this.state = { ...this.state, ...patch };
    this.rebuild();
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }

  private rebuild(): void {
    if (!this.tray) return;

    const portLabel = this.state.port == null ? 'Port: (시작 중)' : `Port: ${this.state.port}`;
    const menu = Menu.buildFromTemplate([
      { label: portLabel, enabled: false },
      {
        label: 'Copy hooks config snippet',
        enabled: this.state.port != null,
        click: () => this.copyHooksSnippet(),
      },
      { type: 'separator' },
      {
        label: 'Mute sounds',
        type: 'checkbox',
        checked: this.state.mute,
        click: () => this.cb.onToggleMute(),
      },
      {
        label: 'Hide widget',
        type: 'checkbox',
        checked: this.state.hidden,
        click: () => this.cb.onToggleHide(),
      },
      { type: 'separator' },
      {
        label: 'Layout',
        submenu: ALL_LAYOUTS.map((l) => ({
          label: layoutLabel(l),
          type: 'radio' as const,
          checked: this.state.layout === l,
          click: () => this.cb.onSetLayout(l),
        })),
      },
      { type: 'separator' },
      { label: 'Restart webhook server', click: () => this.cb.onRestartWebhook() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    this.tray.setContextMenu(menu);
  }

  private copyHooksSnippet(): void {
    if (this.state.port == null) return;
    const snippet = JSON.stringify(
      {
        hooks: {
          PreToolUse: [{ hooks: [{ type: 'http', url: `http://127.0.0.1:${this.state.port}/event` }] }],
          PostToolUse: [{ hooks: [{ type: 'http', url: `http://127.0.0.1:${this.state.port}/event` }] }],
          Notification: [
            {
              matcher: 'permission_prompt',
              hooks: [{ type: 'http', url: `http://127.0.0.1:${this.state.port}/event` }],
            },
          ],
          Stop: [{ hooks: [{ type: 'http', url: `http://127.0.0.1:${this.state.port}/event` }] }],
          SessionStart: [{ hooks: [{ type: 'http', url: `http://127.0.0.1:${this.state.port}/event` }] }],
        },
      },
      null,
      2,
    );
    clipboard.writeText(snippet);
  }
}

function layoutLabel(layout: Layout): string {
  switch (layout) {
    case 'horizontal':
      return '가로 정렬';
    case 'vertical':
      return '세로 정렬';
    case 'detached':
      return 'Detached (분리)';
  }
}
