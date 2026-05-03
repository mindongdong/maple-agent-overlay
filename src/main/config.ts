import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { ConfigSchema, DEFAULT_CONFIG, type Config } from '../shared/config';

/**
 * userData/config.json 영속 저장.
 *
 * 동기 read/write — 파일이 작고 (수백 바이트) 부팅 + 설정 변경 시에만 호출.
 * zod 검증 실패 시 기본값으로 폴백 + 백업 저장 (config.json.bak) → 사용자가 수정 가능하게.
 */

let cached: Config | null = null;

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export function readConfig(): Config {
  if (cached) return cached;

  const file = configPath();
  if (!fs.existsSync(file)) {
    cached = { ...DEFAULT_CONFIG };
    return cached;
  }

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = ConfigSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.warn('[config] invalid config.json, backing up and using defaults');
      try {
        fs.copyFileSync(file, file + '.bak');
      } catch {
        /* best-effort */
      }
      cached = { ...DEFAULT_CONFIG };
      return cached;
    }
    cached = parsed.data;
    return cached;
  } catch (err) {
    console.warn('[config] failed to read config.json:', err);
    cached = { ...DEFAULT_CONFIG };
    return cached;
  }
}

export function writeConfig(patch: Partial<Config>): Config {
  const current = cached ?? readConfig();
  const next: Config = { ...current, ...patch };
  const validated = ConfigSchema.parse(next);

  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(validated, null, 2), 'utf-8');
  cached = validated;
  return validated;
}

/** 메모리 캐시만 반환 (read 호출 후). 검증 없이 빠르게. */
export function getConfig(): Config {
  return cached ?? readConfig();
}
