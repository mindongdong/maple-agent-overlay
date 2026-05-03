interface Props {
  message: string;
}

/**
 * 캐릭터 머리 위 말풍선.
 *
 * - 빈 메시지면 렌더링 자체를 건너뜀 (호출 측에서 분기 권장)
 * - max-w 로 가로 제한 + truncate. 호버 시 전체 표시는 Phase 4 예정
 * - app-region: no-drag 로 드래그 영역과 분리 (메시지가 길어질 경우 클릭 선택 가능)
 */
export function SpeechBubble({ message }: Props): JSX.Element | null {
  if (!message) return null;
  return (
    <div
      className="max-w-[200px] truncate rounded-lg border border-amber-300 bg-amber-50/95 px-2.5 py-1 text-xs text-amber-900 shadow-sm"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      title={message}
    >
      {message}
    </div>
  );
}
