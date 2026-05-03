import { useMemo } from 'react';
import {
  parseInitialContextFromSearch,
  type InitialContext,
} from '../../../shared/layout';

/**
 * 메인이 윈도우 URL 쿼리로 전달한 초기 컨텍스트를 동기 파싱.
 *
 * 페인트 전 한 번만 결정되며 변하지 않는다. 레이아웃 전환은 메인이
 * 새 윈도우를 생성하므로 이 훅의 반환값은 윈도우 lifetime 동안 불변.
 */
export function useInitialContext(): InitialContext {
  return useMemo(() => parseInitialContextFromSearch(window.location.search), []);
}
