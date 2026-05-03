---
name: webhook-server
description: Electron 메인 프로세스에 내장되는 로컬 HTTP 웹훅 서버를 구축한다. 127.0.0.1 loopback-only 바인딩(외부 접근 차단), 포트 40429부터 자동 fallback(40430, 40431...), POST /event 엔드포인트, 옵션 토큰 헤더 인증, 어댑터 페이로드를 IPC `agent:event`로 라우팅한다. 보안(loopback bind 절대 위반 금지), 포트 충돌 처리, 트레이 메뉴 포트 표시 동기화가 필요하면 반드시 이 스킬을 사용할 것.
---

# Webhook Server

## 언제 이 스킬을 쓰는가

- Electron 메인 프로세스 내부에 로컬 HTTP 서버를 띄울 때
- `POST /event`로 어댑터 페이로드를 수신하여 IPC로 라우팅할 때
- 포트 충돌 시 자동 fallback 정책을 구현할 때
- 보안: loopback-only 바인딩, 옵션 토큰 인증을 적용할 때

## 핵심 요구사항 (PRD 명시)

- **기본 포트:** `40429`
- **사용 중이면:** `40430`, `40431`, ... 자동 fallback (최대 N회 시도)
- **바인딩:** `127.0.0.1`만 허용. 외부 IP(0.0.0.0) 절대 금지
- **엔드포인트:** `POST /event`
- **옵션:** 토큰 헤더 (`Authorization: Bearer ...`)
- **트레이 표시:** 현재 포트를 메뉴에 노출

## 구현 (Node.js `http` 모듈)

가벼운 의존성을 위해 Express 대신 표준 `http` 사용.

```ts
import http from 'node:http';
import { EventEmitter } from 'node:events';

const PORT_BASE = 40429;
const MAX_FALLBACK = 10;

export class WebhookServer extends EventEmitter {
  private server?: http.Server;
  public port?: number;

  constructor(private token?: string) { super(); }

  async start(): Promise<number> {
    for (let i = 0; i < MAX_FALLBACK; i++) {
      const port = PORT_BASE + i;
      try {
        await this.listen(port);
        this.port = port;
        this.emit('port-changed', port);
        return port;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw e;
      }
    }
    throw new Error(`No available port in ${PORT_BASE}..${PORT_BASE + MAX_FALLBACK - 1}`);
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => this.handle(req, res));
      srv.once('error', reject);
      // 반드시 127.0.0.1 명시. 0.0.0.0/외부 IP 절대 금지
      srv.listen(port, '127.0.0.1', () => {
        this.server = srv;
        srv.removeListener('error', reject);
        resolve();
      });
    });
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404); res.end(); return;
    }

    // 옵션 토큰 검증
    if (this.token) {
      const auth = req.headers['authorization'];
      if (auth !== `Bearer ${this.token}`) {
        res.writeHead(401); res.end(); return;
      }
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // 페이로드 크기 제한 (10KB)
      if (body.length > 10_000) {
        res.writeHead(413); res.end(); req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        this.emit('event', payload);   // 메인이 IPC로 라우팅
        res.writeHead(204); res.end();
      } catch {
        res.writeHead(400); res.end('invalid json');
      }
    });
  }

  async restart() {
    await this.stop();
    return this.start();
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }
}
```

## 메인 프로세스 통합

```ts
const server = new WebhookServer(/* token? */);
server.on('event', (raw) => {
  // adapter-engineer의 매핑 로직 호출
  const payload = adaptIncoming(raw);
  if (!payload) return;  // 알 수 없는 hook은 무시 또는 working 폴백
  mainWindow.webContents.send('agent:event', payload);
});
server.on('port-changed', (port) => {
  updateTrayMenu({ port });
});
await server.start();
```

## 어댑터 변환 레이어

원시 페이로드(예: Claude Code hook payload)를 통일 페이로드로 변환:
```ts
function adaptIncoming(raw: any): Payload | null {
  // raw.hook_event_name이 있으면 Claude Code 형식
  if (raw.hook_event_name) return mapClaudeCodeHook(raw);
  // raw.agent_name + state 가 있으면 wrapper에서 직접 보낸 통일 형식
  if (raw.agent_name && raw.state) return validatePayload(raw);
  return null;
}
```

상세 매핑 로직은 `agent-adapter` 스킬 참조.

## 보안 원칙 (절대 불변)

| 항목 | 규칙 | 위반 시 결과 |
|------|------|------------|
| 바인딩 주소 | `127.0.0.1`만 | 외부 네트워크가 위젯 조작 가능 (시각/사운드 트롤링) |
| CORS | 사용 안 함 (loopback이라 무관) | - |
| Methods | POST만 허용, 나머지 404 | - |
| Body 크기 | 10KB 상한 | DoS 방지 |
| JSON 파싱 | try/catch 필수 | 잘못된 입력으로 크래시 방지 |
| 토큰 (옵션) | `Authorization: Bearer ...` | 같은 머신의 다른 사용자 격리 |

**0.0.0.0 또는 외부 IP에 바인딩하는 코드를 작성하지 말 것.** integration-qa가 이 항목을 HIGH 우선순위로 검사한다.

## 트레이 메뉴 동기화

포트 변경(시작 시 fallback) 후 즉시 트레이 갱신:
```ts
server.on('port-changed', (port) => {
  tray.setToolTip(`Maple Overlay (port ${port})`);
  rebuildMenu({ ...state, port });
});
```

또한 "Copy hooks config" 메뉴 항목으로 현재 포트가 적용된 `~/.claude/settings.json` snippet을 클립보드에 복사해주면 사용자 편의성 +α.

## 재시작

설정에서 토큰 변경, 포트 base 변경 등 사유로 재시작이 필요하면 `server.restart()` 사용. 재시작 중 짧은 다운타임 동안 들어온 webhook은 손실되지만 어댑터 측이 silent fail이므로 사용자 영향 최소.

## 페이로드 검증

webhook은 외부 입력 경계면이다. 받은 페이로드는 zod로 validate:
```ts
const PayloadSchema = z.object({
  agent_name: z.string().min(1).max(50),
  state: z.enum(['idle', 'working', 'pending_approval', 'done', 'error']),
  message: z.string().max(500).default(''),
});
```

검증 실패 시 400 응답 + 로그.

## 로깅

- 받은 모든 페이로드는 메인 프로세스 로그에 기록 (개발 모드 한정)
- 검증 실패는 항상 로그 (사용자가 어댑터 디버깅에 활용)
- 민감 정보(토큰)는 절대 로그 X

## 후속 작업 시

- 새 엔드포인트 추가 (예: `/health`): handle 라우팅 분기 추가, 보안 원칙 동일 적용
- 토큰 회전: restart로 처리, 새 토큰을 사용자에게 표시 후 어댑터 측 재설정 안내
