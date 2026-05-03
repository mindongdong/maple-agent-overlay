import { app, BrowserWindow } from 'electron';
import { registerIpc, buildAgentImageMap } from './ipc';
import { WebhookServer } from './webhook';
import { createForLayout, destroyAll, type ActiveWindows } from './layout';
import { routeAgentEvent } from './router';
import { OverlayTray } from './tray';
import { readConfig, writeConfig, getConfig } from './config';
import { handleCharacterScheme, registerCharacterScheme } from './nexon/protocol';
import type { Layout } from '../shared/layout';

// privileged scheme 은 ready 이전에 등록되어야 한다
registerCharacterScheme();

const webhook = new WebhookServer();
const tray = new OverlayTray({
  onSetLayout: (layout) => applyLayout(layout),
  onToggleMute: () => toggleMute(),
  onToggleHide: () => toggleHide(),
  onRestartWebhook: () => void restartWebhook(),
});

let windows: ActiveWindows = { unified: null, perAgent: new Map() };

function applyLayout(layout: Layout): void {
  destroyAll(windows);
  const cfg = writeConfig({ layout });
  windows = createForLayout(layout, cfg.agents);
  if (cfg.hidden) hideAllWindows();
  tray.update({ layout });
  console.log(`[layout] applied "${layout}" with agents=[${cfg.agents.join(', ')}]`);
}

function toggleMute(): void {
  const next = !getConfig().mute;
  writeConfig({ mute: next });
  broadcastMute(next);
  tray.update({ mute: next });
}

function toggleHide(): void {
  const next = !getConfig().hidden;
  writeConfig({ hidden: next });
  if (next) hideAllWindows();
  else showAllWindows();
  tray.update({ hidden: next });
}

async function restartWebhook(): Promise<void> {
  try {
    const port = await webhook.restart();
    tray.update({ port });
    console.log(`[webhook] restarted on port ${port}`);
  } catch (err) {
    console.error('[webhook] restart failed:', err);
  }
}

function bootWindows(): void {
  const cfg = getConfig();
  windows = createForLayout(cfg.layout, cfg.agents);
  if (cfg.hidden) hideAllWindows();
}

function eachWindow(cb: (win: BrowserWindow) => void): void {
  if (windows.unified && !windows.unified.isDestroyed()) cb(windows.unified);
  for (const w of windows.perAgent.values()) {
    if (!w.isDestroyed()) cb(w);
  }
}

function hideAllWindows(): void {
  eachWindow((w) => w.hide());
}

function showAllWindows(): void {
  eachWindow((w) => w.show());
}

function broadcastMute(mute: boolean): void {
  eachWindow((w) => w.webContents.send('tray:mute', mute));
}

function broadcastCharacterMap(): void {
  const map = buildAgentImageMap();
  eachWindow((w) => w.webContents.send('characters:changed', map));
}

app.whenReady().then(async () => {
  // userData/config 읽기
  readConfig();

  // 커스텀 프로토콜: maple-character://
  handleCharacterScheme();

  registerIpc({
    onSetLayout: (layout) => applyLayout(layout),
    getMute: () => getConfig().mute,
  });

  webhook.on('payload', (payload) => routeAgentEvent(windows, payload));
  webhook.on('port-changed', (port) => {
    console.log(`[webhook] listening on http://127.0.0.1:${port}/event`);
    tray.update({ port });
  });

  try {
    await webhook.start();
  } catch (err) {
    console.error('[webhook] failed to start:', err);
  }

  const cfg = getConfig();
  tray.start({
    layout: cfg.layout,
    mute: cfg.mute,
    hidden: cfg.hidden,
    port: webhook.port ?? null,
  });

  bootWindows();

  // 윈도우 생성 후 캐릭터 매핑 전달 (캐시가 있으면)
  setImmediate(() => broadcastCharacterMap());

  app.on('activate', () => {
    if (windows.unified === null && windows.perAgent.size === 0) {
      bootWindows();
      setImmediate(() => broadcastCharacterMap());
    }
  });
});

app.on('window-all-closed', () => {
  // 트레이가 살아있으므로 macOS 외에서도 quit 안 함 (위젯이 hidden 일 때 백그라운드 webhook 동작)
});

app.on('before-quit', async () => {
  destroyAll(windows);
  tray.destroy();
  await webhook.stop();
});
