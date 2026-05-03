import { useEffect, useState } from 'react';
import type { AgentImageMap } from '../../../shared/character';

/**
 * agent_name → 캐릭터 이미지 URL (maple-character://...) 매핑.
 *
 * 부팅 시 1회 fetch. 이후 메인이 onCharacterMapChanged 로 푸시.
 */
export function useCharacterMap(): AgentImageMap {
  const [map, setMap] = useState<AgentImageMap>({});

  useEffect(() => {
    let active = true;
    void window.overlay.getCharacterMap().then((m) => {
      if (active) setMap(m);
    });
    const unsubscribe = window.overlay.onCharacterMapChanged((m) => setMap(m));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return map;
}
