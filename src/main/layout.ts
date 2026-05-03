import { BrowserWindow, screen, dialog } from 'electron';
import { createOverlayWindow } from './window';
import { MAX_DETACHED_WINDOWS, type Layout } from '../shared/layout';

const CELL_W = 240;
const CELL_H = 240;
const GAP = 12;
const PAD = 12;
const EDGE_MARGIN = 24;

/**
 * 활성 오버레이 윈도우들. 레이아웃마다 의미가 다르다:
 *  - horizontal/vertical: `unified` 에 단일 윈도우, `perAgent` 비어있음
 *  - detached: `unified` 비어있음, `perAgent` 에 agent_name → 윈도우 매핑
 */
export interface ActiveWindows {
  unified: BrowserWindow | null;
  perAgent: Map<string, BrowserWindow>;
}

export function emptyActiveWindows(): ActiveWindows {
  return { unified: null, perAgent: new Map() };
}

/**
 * 현재 활성 윈도우들을 모두 정리. 레이아웃 전환/종료 시 호출.
 */
export function destroyAll(active: ActiveWindows): void {
  if (active.unified && !active.unified.isDestroyed()) {
    active.unified.close();
  }
  for (const win of active.perAgent.values()) {
    if (!win.isDestroyed()) win.close();
  }
  active.unified = null;
  active.perAgent.clear();
}

/**
 * 새 레이아웃에 맞춰 윈도우 생성. 기존 윈도우는 미리 destroyAll 로 정리한 뒤 호출.
 *
 * 반환된 ActiveWindows 는 router 가 agent_name 기반 라우팅에 사용한다.
 */
export function createForLayout(
  layout: Layout,
  agents: string[],
): ActiveWindows {
  const active = emptyActiveWindows();
  if (agents.length === 0) return active;

  if (layout === 'detached') {
    if (agents.length > MAX_DETACHED_WINDOWS) {
      // 5개 초과면 경고 + 5개로 제한 (PRD §2.2 + §5)
      void dialog.showMessageBox({
        type: 'warning',
        title: 'Maple Agent Overlay',
        message: `Detached 모드는 최대 ${MAX_DETACHED_WINDOWS}개 윈도우까지 지원합니다.`,
        detail: `${agents.length}개 요청 → 처음 ${MAX_DETACHED_WINDOWS}개만 표시합니다.`,
        buttons: ['확인'],
      });
      agents = agents.slice(0, MAX_DETACHED_WINDOWS);
    }

    agents.forEach((agent, idx) => {
      const position = detachedPosition(idx);
      const win = createOverlayWindow({
        size: { width: CELL_W, height: CELL_H },
        position,
        context: { mode: 'detached', agent },
      });
      active.perAgent.set(agent, win);
    });
    return active;
  }

  // horizontal / vertical: 단일 윈도우 + flex
  const size = unifiedSize(layout, agents.length);
  const position = unifiedPosition(size);
  active.unified = createOverlayWindow({
    size,
    position,
    context: { mode: layout, agents },
  });
  return active;
}

/* --------------------------------------------------------------- */
/* sizing / positioning                                            */
/* --------------------------------------------------------------- */

function unifiedSize(layout: Exclude<Layout, 'detached'>, n: number): {
  width: number;
  height: number;
} {
  if (layout === 'horizontal') {
    return {
      width: CELL_W * n + GAP * Math.max(n - 1, 0) + PAD * 2,
      height: CELL_H + PAD * 2,
    };
  }
  return {
    width: CELL_W + PAD * 2,
    height: CELL_H * n + GAP * Math.max(n - 1, 0) + PAD * 2,
  };
}

function unifiedPosition(size: { width: number; height: number }): {
  x: number;
  y: number;
} {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - size.width - EDGE_MARGIN,
    y: workArea.y + workArea.height - size.height - EDGE_MARGIN,
  };
}

/**
 * Detached N번째 윈도우 위치. 우측 하단부터 좌측으로 stagger.
 * 윈도우끼리 GAP 만큼 겹치지 않게 수평 간격을 둔다.
 */
function detachedPosition(idx: number): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  const stride = CELL_W + GAP;
  return {
    x: workArea.x + workArea.width - CELL_W - EDGE_MARGIN - stride * idx,
    y: workArea.y + workArea.height - CELL_H - EDGE_MARGIN,
  };
}
