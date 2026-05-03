import { Character } from './components/Character';
import { useInitialContext } from './hooks/useInitialContext';

export default function App(): JSX.Element {
  const ctx = useInitialContext();

  if (ctx.mode === 'detached') {
    // 단일 캐릭터 윈도우 — 메인이 윈도우당 하나의 agent 만 라우팅
    return (
      <div className="h-screen w-screen overflow-hidden">
        <Character agentName={ctx.agent} />
      </div>
    );
  }

  // horizontal / vertical: 단일 윈도우에 N 캐릭터 + flex
  const flexDir = ctx.mode === 'horizontal' ? 'flex-row' : 'flex-col';
  return (
    <div className="h-screen w-screen overflow-hidden p-3">
      <div className={`flex h-full w-full items-end justify-end gap-3 ${flexDir}`}>
        {ctx.agents.map((agent) => (
          <div key={agent} className="h-60 w-60 shrink-0">
            <Character agentName={agent} />
          </div>
        ))}
      </div>
    </div>
  );
}
