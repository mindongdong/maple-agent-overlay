import type { OverlayBridge } from '../../preload';

declare global {
  interface Window {
    overlay: OverlayBridge;
  }
}

export {};
