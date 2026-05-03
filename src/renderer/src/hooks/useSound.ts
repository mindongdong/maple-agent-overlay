import { useCallback, useEffect, useRef } from 'react';
import type { State } from '../../../shared/payload';

/**
 * WebAudio 로 5상태 효과음 합성. .mp3 자산 없이 cross-platform 동작.
 *
 *  - done:   상승 분산화음 (success cue)
 *  - error:  하강 톤 (failure cue)
 *  - pending_approval: 부드러운 종 (notification)
 *  - idle / working: 사운드 없음
 *
 * mute 상태에서는 호출 자체를 무시 (AudioContext resume 도 건너뜀).
 */

interface SoundSpec {
  /** [Hz, durationMs][] — 순차 재생 */
  notes: Array<[number, number]>;
  type: OscillatorType;
  /** 피크 볼륨 (0..1). 환경 소음에서도 들리되 너무 크지 않게. */
  gain: number;
}

const SOUNDS: Partial<Record<State, SoundSpec>> = {
  done: {
    notes: [
      [523, 80],
      [659, 80],
      [784, 160],
    ],
    type: 'triangle',
    gain: 0.18,
  },
  error: {
    notes: [
      [330, 110],
      [220, 220],
    ],
    type: 'sawtooth',
    gain: 0.16,
  },
  pending_approval: {
    notes: [[880, 80], [880, 80]],
    type: 'sine',
    gain: 0.14,
  },
};

interface UseSoundResult {
  play: (state: State) => void;
}

export function useSound(muted: boolean): UseSoundResult {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      // 종료 시 정리
      if (ctxRef.current) void ctxRef.current.close();
      ctxRef.current = null;
    };
  }, []);

  const play = useCallback(
    (state: State) => {
      if (muted) return;
      const spec = SOUNDS[state];
      if (!spec) return;

      // lazy 초기화. 첫 사용자 인터랙션 후 호출되어 autoplay 정책 통과.
      if (!ctxRef.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') void ctx.resume();

      let t = ctx.currentTime;
      for (const [freq, durMs] of spec.notes) {
        const dur = durMs / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = spec.type;
        osc.frequency.setValueAtTime(freq, t);
        // ADSR 짧게 (클릭 노이즈 방지)
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(spec.gain, t + 0.005);
        gain.gain.linearRampToValueAtTime(0, t + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
        t += dur;
      }
    },
    [muted],
  );

  return { play };
}
