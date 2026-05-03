#!/usr/bin/env node
/**
 * Maple Overlay — Nexon 캐릭터 CLI 온보딩.
 *
 *   API key 입력 → safeStorage 로 암호화 저장
 *   캐릭터명 입력 → OCID 조회 → 이미지 다운로드 → userData/character-cache/ 저장
 *   (선택) agent_name 매핑
 *
 * 메인 프로세스의 Nexon 모듈을 직접 import 하기 위해 Electron 컨텍스트에서 실행한다.
 * 사용:
 *   npm run onboard  ← 인터랙티브
 *   npm run onboard -- --key=KEY --name=NICK [--agent=claude_code] [--force]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Electron 바이너리는 node_modules/.bin/electron 으로 노출됨
const electronBin = path.join(ROOT, 'node_modules', '.bin', 'electron');

// 메인 프로세스에서 실행될 작업 entry
const ENTRY = path.join(__dirname, 'onboard-runner.cjs');

const proc = spawn(electronBin, [ENTRY, ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
});
proc.on('exit', (code) => process.exit(code ?? 0));
