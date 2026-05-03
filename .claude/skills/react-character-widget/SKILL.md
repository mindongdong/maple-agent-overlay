---
name: react-character-widget
description: React + Tailwind + CSS 애니메이션으로 메이플스토리 캐릭터 위젯을 렌더링하고 5상태(idle/working/pending_approval/done/error)를 시각화한다. 캐릭터 둥둥 모션, 상태 진입 아이콘 + fade-out → 말풍선 전이, hit-zone 마우스 추적, 효과음 재생, agent_name 라우팅이 필요할 때 반드시 이 스킬을 사용할 것. 정적 PNG 이미지에 CSS keyframe으로 모션을 흉내내는 것이 핵심 기법. 후속 작업(새 상태 추가, 톤 조정, 새 레이아웃 모드)도 이 스킬로 처리.
---

# React Character Widget

## 언제 이 스킬을 쓰는가

- 캐릭터 PNG 이미지 위에 5상태 진입 효과를 합성할 때
- `idle / working / pending_approval / done / error` 상태 전이 로직이 필요할 때
- 말풍선 표시, 위치 자동 조정, truncate 처리할 때
- 마우스 hit-zone 진입/이탈을 감지하여 click-through 토글 IPC를 발사할 때
- agent_name 라우팅 (어떤 캐릭터에게 이벤트가 가야 하는지) 처리할 때

## 핵심 컴포넌트 구조

```
src/renderer/
├── App.tsx                   # 레이아웃(가로/세로/Detached 모드 분기) + agent 라우팅
├── components/
│   ├── Character.tsx         # 단일 캐릭터 (이미지 + 상태 아이콘 + 말풍선)
│   ├── StateIcon.tsx         # 5상태 아이콘 (전구/책/?/도장/!)
│   ├── SpeechBubble.tsx      # 말풍선
│   └── HitZone.tsx           # 캐릭터 + 말풍선을 감싸 mouseenter/leave 추적
├── hooks/
│   ├── useAgentState.ts      # agent_name별 state/message 관리
│   ├── useMouseIgnore.ts     # hit-zone 진입 → IPC 토글
│   └── useSound.ts           # 효과음 재생 (mute 상태 반영)
└── assets/
    ├── icons/                # idle.png, working.png, pending.png, done.png, error.png
    └── sounds/               # done.mp3, error.mp3, notification.mp3
```

## 5상태 정의 + 시각 효과

| State | 진입 효과 (0~2초) | 이후 (2초 후) | 사운드 | 자동 복귀 |
|-------|-----------------|-------------|------|----------|
| `idle` | 퀘스트 전구 깜빡임 | 전구 fade-out, 캐릭터 정적 | - | - |
| `working` | 퀘스트 책 + 둥둥 애니메이션 | 책 fade-out, 둥둥 지속 + message 말풍선 | - | - |
| `pending_approval` | `?` 말풍선 깜빡임 | message 말풍선 | (mute 아니면) 알림음 | - |
| `done` | 퀘스트 완료 도장 | message 말풍선 | 완료 효과음 | 5초 후 idle |
| `error` | 붉은 `!` 아이콘 | message 말풍선 | 피격 효과음 | 5초 후 idle |

## CSS 애니메이션 패턴

**둥둥 (working 모션):**
```css
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.character-floating { animation: float 1.5s ease-in-out infinite; }
```

**아이콘 깜빡임:**
```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.icon-blink { animation: blink 0.8s ease-in-out infinite; }
```

**아이콘 fade-out (2초 후):**
```css
.icon-fade { animation: fadeOut 0.3s ease-out 2s forwards; }
@keyframes fadeOut { to { opacity: 0; visibility: hidden; } }
```

Canvas/WebGL 사용 금지 — 저리소스 우선. CSS 애니메이션이 충분.

## 상태 전이 훅

```ts
function useAgentState(agentName: string) {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');
  const autoIdleTimer = useRef<number>();

  useEffect(() => {
    return window.overlay.onAgentEvent((payload) => {
      if (payload.agent_name !== agentName) return;
      setState(payload.state);
      setMessage(payload.message);

      // done/error → 5초 후 idle 자동 복귀
      clearTimeout(autoIdleTimer.current);
      if (payload.state === 'done' || payload.state === 'error') {
        autoIdleTimer.current = window.setTimeout(() => setState('idle'), 5000);
      }
    });
  }, [agentName]);

  return { state, message };
}
```

## Hit-Zone (Click-through 토글)

```ts
function HitZone({ children }: { children: React.ReactNode }) {
  return (
    <div
      onMouseEnter={() => window.overlay.setMouseIgnore(false)}
      onMouseLeave={() => window.overlay.setMouseIgnore(true)}
    >
      {children}
    </div>
  );
}
```

**디바운싱:** 빠른 진입/이탈 반복으로 IPC 폭주를 막으려면 16ms debounce.

**중요:** 보이는 영역(이미지 + 말풍선)만 hit-zone에 포함. 투명 배경은 click-through 유지해야 위젯이 작업 방해 안 함.

## 말풍선 위치 자동 조정

캐릭터가 화면 우측 하단에 있을 때, 말풍선이 화면 밖으로 나가지 않게:
```ts
// 캐릭터의 boundingRect 기준으로 말풍선 위치 결정
// 우측 끝에서 N px 이내면 좌측에 붙임, 하단 끝에서 N px 이내면 위쪽에 붙임
```

## 효과음

```ts
function useSound(soundFile: string, isMuted: boolean) {
  const audio = useMemo(() => new Audio(soundFile), [soundFile]);
  return useCallback(() => {
    if (isMuted) return;
    audio.currentTime = 0;
    audio.play().catch(() => {/* best-effort */});
  }, [audio, isMuted]);
}
```

mute 상태는 메인이 `tray:mute` IPC로 전달하면 store에 반영.

## agent_name 라우팅

여러 캐릭터가 있을 때, `agent:event`가 도착하면 `payload.agent_name`과 매핑된 캐릭터만 업데이트한다. 매핑 정보는 api-integrator가 관리하는 `agent-character-map.json`을 IPC로 받아 store에 보관.

## 페이로드 검증

받은 IPC 페이로드는 zod 등으로 검증한다 (외부 입력의 연장선이므로):
```ts
const PayloadSchema = z.object({
  agent_name: z.string(),
  state: z.enum(['idle', 'working', 'pending_approval', 'done', 'error']),
  message: z.string().default(''),
});
```

알 수 없는 state는 `idle`로 폴백 + console.warn (silent fail 금지).

## 톤 가이드

- 픽셀 아트 스타일 유지 — 이미지 보간 `image-rendering: pixelated`
- 노란/베이지 톤 말풍선 (메이플 UI 느낌)
- 효과음은 짧고 만족스럽게 (200~400ms)

## 후속 작업 시

- 새 상태 추가: 위 표 행 추가 + StateIcon 자산 + zod schema 갱신 + adapter-engineer에게 매핑 요청 SendMessage
- 톤 변경: assets/ 교체, CSS 변수로 색상 통일 관리
- 레이아웃 모드 추가: App.tsx 분기 + electron-architect의 윈도우 생성 로직 동기 수정
