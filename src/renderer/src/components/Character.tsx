import { useEffect, useRef } from 'react';
import { useAgentState } from '../hooks/useAgentState';
import { useMute } from '../hooks/useMute';
import { useSound } from '../hooks/useSound';
import { useCharacterMap } from '../hooks/useCharacterMap';
import { PlaceholderCharacter } from './PlaceholderCharacter';
import { HitZone } from './HitZone';
import { StateIcon } from './StateIcon';
import { SpeechBubble } from './SpeechBubble';
import type { State } from '../../../shared/payload';

interface Props {
  agentName?: string;
}

export function Character({ agentName = 'claude_code' }: Props): JSX.Element {
  const { state, message, entryActive } = useAgentState(agentName);
  const muted = useMute();
  const { play } = useSound(muted);
  const characterMap = useCharacterMap();
  const lastSoundedState = useRef<State | null>(null);

  // 상태가 바뀐 직후 한 번만 사운드 재생 (entry 시점)
  useEffect(() => {
    if (entryActive && state !== lastSoundedState.current) {
      play(state);
      lastSoundedState.current = state;
    }
    if (!entryActive) lastSoundedState.current = null;
  }, [state, entryActive, play]);

  const showFloat = state === 'working';
  const showBubble = !entryActive && message.length > 0;
  const imageUrl = characterMap[agentName];

  return (
    <HitZone>
      <div className="flex h-full w-full flex-col items-center justify-end gap-1 pb-1">
        <div className="min-h-[20px]">{showBubble ? <SpeechBubble message={message} /> : null}</div>

        <div className="relative">
          <div className="absolute -top-2 -right-2 z-10">
            <StateIcon state={state} blink={entryActive} />
          </div>
          <div className={`character-drag ${showFloat ? 'character-float' : ''}`}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={agentName}
                className="h-32 w-32 select-none object-contain"
                style={{ imageRendering: 'pixelated' }}
                draggable={false}
              />
            ) : (
              <PlaceholderCharacter />
            )}
          </div>
        </div>
      </div>
    </HitZone>
  );
}
