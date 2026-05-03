import type { State } from '../../../shared/payload';

const ICON: Record<State, { glyph: string; label: string; color: string }> = {
  idle: { glyph: '💡', label: '대기', color: 'bg-amber-100 border-amber-300' },
  working: { glyph: '📖', label: '작업 중', color: 'bg-sky-100 border-sky-300' },
  pending_approval: { glyph: '❓', label: '승인 대기', color: 'bg-yellow-100 border-yellow-400' },
  done: { glyph: '✅', label: '완료', color: 'bg-emerald-100 border-emerald-300' },
  error: { glyph: '❗', label: '오류', color: 'bg-rose-100 border-rose-400' },
};

interface Props {
  state: State;
  /** 진입 효과(깜빡임) 적용 여부 */
  blink: boolean;
}

/**
 * 5상태 진입 효과 아이콘. 캐릭터 머리 위에 떠 있는 작은 배지.
 *
 * blink=true: 깜빡임 애니메이션 (idle/pending 의 진입 0~2초)
 * blink=false: fade-out 후 사라짐
 */
export function StateIcon({ state, blink }: Props): JSX.Element {
  const info = ICON[state];
  const blinkClass = blink ? 'icon-blink' : 'icon-fade-after-entry';

  return (
    <div
      className={`pointer-events-none flex h-7 w-7 items-center justify-center rounded-full border text-sm shadow-sm ${info.color} ${blinkClass}`}
      aria-label={info.label}
      title={info.label}
    >
      <span aria-hidden>{info.glyph}</span>
    </div>
  );
}
