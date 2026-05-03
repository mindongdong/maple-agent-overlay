import { useEffect, useRef, useState } from 'react';
import { PayloadSchema, type Payload, type State } from '../../../shared/payload';

const AUTO_IDLE_MS = 5_000; // done/error → 5초 후 idle 자동 복귀
const ENTRY_FX_MS = 2_000; // 진입 효과 (아이콘 깜빡임/도장) 표시 시간

interface AgentState {
  /** 현재 상태 */
  state: State;
  /** 현재 페이로드의 message (말풍선용) */
  message: string;
  /** 진입 효과(아이콘) 노출 중인지 — 진입 후 ENTRY_FX_MS 동안 true */
  entryActive: boolean;
}

/**
 * 특정 agent_name 의 상태를 추적.
 *
 *  - agent:event 수신 → 해당 agent_name 만 업데이트 (라우팅)
 *  - 진입 시 entryActive=true, ENTRY_FX_MS 후 false
 *  - done / error 진입 시 AUTO_IDLE_MS 후 idle 복귀
 *  - 새 이벤트가 오면 이전 타이머 cleanup
 */
export function useAgentState(agentName: string): AgentState {
  const [agentState, setAgentState] = useState<AgentState>({
    state: 'idle',
    message: '',
    entryActive: true, // 첫 idle 도 진입 효과 1회 표시
  });

  const entryTimer = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    const clearTimers = (): void => {
      if (entryTimer.current !== null) window.clearTimeout(entryTimer.current);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      entryTimer.current = null;
      idleTimer.current = null;
    };

    const apply = (next: Payload): void => {
      clearTimers();

      setAgentState({
        state: next.state,
        message: next.message,
        entryActive: true,
      });

      entryTimer.current = window.setTimeout(() => {
        setAgentState((s) => ({ ...s, entryActive: false }));
      }, ENTRY_FX_MS);

      if (next.state === 'done' || next.state === 'error') {
        idleTimer.current = window.setTimeout(() => {
          setAgentState({ state: 'idle', message: '', entryActive: true });
          entryTimer.current = window.setTimeout(() => {
            setAgentState((s) => ({ ...s, entryActive: false }));
          }, ENTRY_FX_MS);
        }, AUTO_IDLE_MS);
      }
    };

    const unsubscribe = window.overlay.onAgentEvent((raw) => {
      const parsed = PayloadSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn('[useAgentState] invalid payload', parsed.error.issues);
        return;
      }
      if (parsed.data.agent_name !== agentName) return;
      apply(parsed.data);
    });

    return () => {
      clearTimers();
      unsubscribe();
    };
  }, [agentName]);

  return agentState;
}
