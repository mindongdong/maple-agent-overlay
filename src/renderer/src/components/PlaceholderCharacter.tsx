/**
 * Phase 1 임시 캐릭터.
 * Phase 4 에서 Nexon API 가 받아온 PNG 로 대체된다.
 *
 * SVG 픽셀 아트 — 노란 모자 + 베이지 얼굴, 메이플 톤 흉내.
 */
export function PlaceholderCharacter(): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="h-32 w-32 select-none"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden
    >
      {/* 모자 */}
      <rect x="5" y="2" width="6" height="1" fill="#f59e0b" />
      <rect x="4" y="3" width="8" height="2" fill="#f59e0b" />
      <rect x="3" y="5" width="10" height="1" fill="#f59e0b" />
      {/* 얼굴 */}
      <rect x="5" y="6" width="6" height="3" fill="#fde68a" />
      {/* 눈 */}
      <rect x="6" y="7" width="1" height="1" fill="#1f2937" />
      <rect x="9" y="7" width="1" height="1" fill="#1f2937" />
      {/* 입 */}
      <rect x="7" y="8" width="2" height="1" fill="#b45309" />
      {/* 몸 */}
      <rect x="5" y="9" width="6" height="3" fill="#3b82f6" />
      {/* 팔 */}
      <rect x="4" y="9" width="1" height="3" fill="#fde68a" />
      <rect x="11" y="9" width="1" height="3" fill="#fde68a" />
      {/* 다리 */}
      <rect x="6" y="12" width="2" height="2" fill="#1e3a8a" />
      <rect x="8" y="12" width="2" height="2" fill="#1e3a8a" />
      {/* 신발 */}
      <rect x="5" y="14" width="3" height="1" fill="#1f2937" />
      <rect x="8" y="14" width="3" height="1" fill="#1f2937" />
    </svg>
  );
}
