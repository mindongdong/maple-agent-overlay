import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Nexon Open API 키를 Electron safeStorage 로 암호화하여 저장.
 *
 * 평문 저장 절대 금지. safeStorage 미지원 환경(드물게 Linux 일부) 에서는 저장 거부.
 */

function keyPath(): string {
  return path.join(app.getPath('userData'), 'nexon-key.bin');
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function saveApiKey(key: string): void {
  if (!isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available on this platform');
  }
  if (!key || key.length < 8) throw new Error('invalid key');

  const encrypted = safeStorage.encryptString(key);
  const file = keyPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encrypted, { mode: 0o600 });
}

export function loadApiKey(): string | null {
  const file = keyPath();
  if (!fs.existsSync(file)) return null;
  if (!isEncryptionAvailable()) return null;
  try {
    const buf = fs.readFileSync(file);
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.warn('[keystore] decrypt failed:', err);
    return null;
  }
}

export function deleteApiKey(): void {
  const file = keyPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
