import { useEffect, useState } from 'react';

/**
 * 메인(트레이) 의 mute 상태를 추적.
 *
 * 부팅 시 1회 getMute() 로 초기값 받고, 이후 onMuteChanged 로 푸시 수신.
 */
export function useMute(): boolean {
  const [mute, setMute] = useState(false);

  useEffect(() => {
    let active = true;
    void window.overlay.getMute().then((m) => {
      if (active) setMute(m);
    });
    const unsubscribe = window.overlay.onMuteChanged((m) => setMute(m));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return mute;
}
