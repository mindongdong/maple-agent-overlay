import { useEffect, useRef, type ReactNode } from 'react';

const DEBOUNCE_MS = 16; // 마우스 이동 시 IPC 폭주 방지 (한 프레임 budget)

interface Props {
  children: ReactNode;
}

/**
 * 자식이 차지하는 영역 위에 마우스가 들어오면 click-through 를 끄고,
 * 벗어나면 다시 켠다. 디바운스로 IPC 폭주 방지.
 *
 * 보이는 영역만 감싸야 한다. 투명 배경에 적용하면 위젯이 작업을 방해한다.
 */
export function HitZone({ children }: Props): JSX.Element {
  const timer = useRef<number | null>(null);
  const last = useRef<boolean | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const set = (ignore: boolean): void => {
    if (last.current === ignore) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      last.current = ignore;
      window.overlay.setMouseIgnore(ignore);
    }, DEBOUNCE_MS);
  };

  return (
    <div
      onMouseEnter={() => set(false)}
      onMouseLeave={() => set(true)}
      className="contents"
    >
      {children}
    </div>
  );
}
