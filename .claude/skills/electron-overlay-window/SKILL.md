---
name: electron-overlay-window
description: Electron으로 투명/프레임리스/항상-위 오버레이 위젯 윈도우를 만들고, click-through 토글 + 멀티 윈도우(가로/세로/Detached 레이아웃) + 시스템 트레이를 구성한다. BrowserWindow 옵션, macOS 풀스크린 호환, IPC를 통한 hit-zone 토글, 트레이 메뉴(Mute/Hide/Layout/Quit)를 다뤄야 할 때 반드시 이 스킬을 사용할 것. transparent + frameless + alwaysOnTop 조합, screen-saver 레벨, visibleOnAllWorkspaces, setIgnoreMouseEvents 같은 키워드가 등장하면 트리거. 후속 작업(레이아웃 추가, 트레이 메뉴 수정, IPC 추가)도 이 스킬로 처리.
---

# Electron Overlay Window

## 언제 이 스킬을 쓰는가

- 투명 배경 + 프레임 없는 + 항상 위 표시되는 위젯 창을 만들 때
- 마우스 이벤트를 위젯이 가로채지 않도록 click-through를 구성할 때
- 가로/세로 정렬 (단일 창) 또는 Detached (창 여러 개) 레이아웃을 토글할 때
- 시스템 트레이 메뉴(Mute, Hide, Layout 전환, 포트 표시, Quit)를 구성할 때

## BrowserWindow 핵심 옵션

```js
new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  resizable: false,
  skipTaskbar: true,           // Windows: 작업표시줄 숨김
  hasShadow: false,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    preload: path.join(__dirname, 'preload.js'),
  },
});
win.setAlwaysOnTop(true, 'screen-saver');  // 가장 높은 레벨
```

**macOS 추가 설정 (다른 데스크탑/풀스크린에서도 보이게):**
```js
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
```

**풀스크린 게임/비디오 한계:** OS가 일부 풀스크린 컨텍스트에서는 alwaysOnTop을 무시한다. 이는 OS 한계이며 Electron으로 우회 불가. 사용자에게 README와 트레이 툴팁으로 명시하라.

## Click-Through 토글 패턴

기본은 클릭 통과. 캐릭터/말풍선 영역에 마우스가 들어오면 차단 해제.

**메인 프로세스:**
```js
ipcMain.on('mouse:set-ignore', (_, ignore) => {
  win.setIgnoreMouseEvents(ignore, { forward: true });
});

// 초기 상태
win.setIgnoreMouseEvents(true, { forward: true });
```

**preload.js:**
```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overlay', {
  setMouseIgnore: (ignore) => ipcRenderer.send('mouse:set-ignore', ignore),
  onAgentEvent: (cb) => ipcRenderer.on('agent:event', (_, payload) => cb(payload)),
});
```

**렌더러 (React 측 책임은 react-character-widget 스킬):** `mousemove`로 hit-zone 진입 감지, 디바운싱 후 `window.overlay.setMouseIgnore(false/true)`.

## 멀티 윈도우 레이아웃

### 가로/세로 (단일 BrowserWindow)
- 창 하나에 여러 캐릭터를 flexbox로 배치
- 창 크기 = `(캐릭터수 × 캐릭터폭) + 여백`. 캐릭터 추가/제거 시 `win.setSize()`로 동적 조절
- 화면 우측 하단 기준 위치 계산: `screen.getPrimaryDisplay().workAreaSize`

### Detached (캐릭터당 별도 창)
- 한 캐릭터당 BrowserWindow 인스턴스 1개
- 5개 초과 시 `dialog.showMessageBox`로 경고 + 강제 제한
- 각 창에 query param 또는 IPC로 `agent_name` 전달하여 어떤 캐릭터를 렌더링할지 알림

### 레이아웃 전환
- 가장 단순: 모든 창 destroy → 새 모드로 재생성
- 사용자 위치는 `userData/window-positions.json`에 보존하여 복원

## System Tray

```js
const tray = new Tray(iconPath);
const updateMenu = (port, isMuted, isHidden, layout) => {
  const menu = Menu.buildFromTemplate([
    { label: `Port: ${port}`, enabled: false },
    { type: 'separator' },
    { label: 'Mute Sounds', type: 'checkbox', checked: isMuted, click: () => /* IPC */ },
    { label: 'Hide Widget', type: 'checkbox', checked: isHidden, click: () => /* IPC */ },
    { type: 'separator' },
    { label: 'Layout', submenu: [
      { label: 'Horizontal', type: 'radio', checked: layout === 'horizontal' },
      { label: 'Vertical', type: 'radio', checked: layout === 'vertical' },
      { label: 'Detached', type: 'radio', checked: layout === 'detached' },
    ]},
    { label: 'Restart Webhook Server', click: () => /* call webhook-server.restart() */ },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
};
```

**Hide Widget**: 위젯 숨김. **백그라운드 webhook 서버는 계속 동작**한다 (PRD 명시 사항).

## IPC 채널 명세 (이 프로젝트 표준)

| 채널 | 방향 | 페이로드 | 용도 |
|------|------|----------|------|
| `agent:event` | 메인→렌더러 | `{agent_name, state, message}` | 어댑터 페이로드 라우팅 |
| `mouse:set-ignore` | 렌더러→메인 | `boolean` | hit-zone 토글 |
| `tray:layout` | 메인→렌더러 | `'horizontal' \| 'vertical' \| 'detached'` | 레이아웃 변경 |
| `tray:mute` | 메인→렌더러 | `boolean` | 음소거 |
| `tray:hide` | 메인→렌더러 | `boolean` | 위젯 숨김 |
| `webhook:port-changed` | 메인 내부 | `number` | 포트 fallback 결과 |
| `config:read`, `config:update` | 양방향 | `object` | userData 영속화 |

새 IPC 추가 시 이 표를 갱신하고, electron-architect → renderer-engineer 양쪽에 SendMessage로 통보.

## 보안 원칙 (NEVER 위반)

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- preload에서 노출하는 API는 최소 필요 함수만
- 외부 URL 절대 로드 금지 (`webContents.on('will-navigate')` 차단)

## 후속 작업 시

- 새 IPC 추가: 위 표에 행 추가 + preload + 양쪽 핸들러 동시 작업
- 레이아웃 추가: 가로/세로/Detached 외 새 모드는 트레이 메뉴 + 윈도우 생성 로직 + 렌더러 모드 동시 수정
- 트레이 메뉴 항목 추가: 토글 상태를 userData에 영속화

## 산출물 디렉토리

```
src/main/
├── main.ts          # app lifecycle
├── windows.ts       # BrowserWindow 생성/관리 + 레이아웃 전환
├── tray.ts          # 트레이 메뉴
├── ipc.ts           # IPC 핸들러 등록
└── preload.ts       # contextBridge 노출 API
```
