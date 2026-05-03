// Electron 컨텍스트(headless)에서 실행되는 온보딩 러너.
//
// 메인 프로세스의 Nexon 모듈은 빌드된 out/main/index.js 안에 번들링되어 있어
// 직접 import 하기 어렵다. 따라서 본 러너는 Nexon API 클라이언트 로직을 직접
// 구현 — 빌드 산출물 의존성 없이 독립 실행. 핵심 규칙(safeStorage 암호화,
// loopback only X, Rate Limit) 은 src/main/nexon/ 와 동일하다.
//
// 빌드 산출물(out/) 을 읽도록 통합하는 것은 Phase 5 영역.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');

const args = parseArgs(process.argv.slice(2));

function parseArgs(argv) {
  const out = { force: false };
  for (const a of argv) {
    if (a === '--force') out.force = true;
    else if (a.startsWith('--key=')) out.key = a.slice(6);
    else if (a.startsWith('--name=')) out.name = a.slice(7);
    else if (a.startsWith('--agent=')) out.agent = a.slice(8);
  }
  return out;
}

function userDataDir() {
  return app.getPath('userData');
}
function keyPath() {
  return path.join(userDataDir(), 'nexon-key.bin');
}
function cacheDir() {
  return path.join(userDataDir(), 'character-cache');
}
function indexPath() {
  return path.join(cacheDir(), 'index.json');
}
function mapPath() {
  return path.join(userDataDir(), 'agent-character-map.json');
}

function saveKey(key) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption not available on this platform');
  }
  if (!key || key.length < 8) throw new Error('invalid api key');
  fs.mkdirSync(userDataDir(), { recursive: true });
  fs.writeFileSync(keyPath(), safeStorage.encryptString(key), { mode: 0o600 });
}

function loadKey() {
  if (!fs.existsSync(keyPath()) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(fs.readFileSync(keyPath()));
  } catch {
    return null;
  }
}

const BASE = 'https://open.api.nexon.com';

async function callJson(p, key) {
  const res = await fetch(`${BASE}${p}`, {
    headers: { 'x-nxopen-api-key': key },
  });
  if (res.status === 401 || res.status === 403) throw new Error('invalid api key (401/403)');
  if (res.status === 404) throw new Error('not found');
  if (res.status === 429) throw new Error('rate limit (429) — wait and retry');
  if (!res.ok) throw new Error(`nexon api ${res.status}`);
  return res.json();
}

async function fetchOcid(name, key) {
  const data = await callJson(`/maplestory/v1/id?character_name=${encodeURIComponent(name)}`, key);
  if (typeof data?.ocid !== 'string') throw new Error('invalid ocid response');
  return data.ocid;
}

async function fetchBasic(ocid, key) {
  const data = await callJson(`/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`, key);
  if (typeof data?.character_image !== 'string' || typeof data?.character_name !== 'string') {
    throw new Error('invalid basic response');
  }
  return data;
}

async function fetchImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function readIndex() {
  if (!fs.existsSync(indexPath())) return [];
  try {
    return JSON.parse(fs.readFileSync(indexPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function upsert(entry) {
  const idx = readIndex().filter((e) => e.ocid !== entry.ocid);
  idx.push(entry);
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(idx, null, 2));
}

function setMapping(agent, ocid) {
  let map = {};
  if (fs.existsSync(mapPath())) {
    try {
      map = JSON.parse(fs.readFileSync(mapPath(), 'utf-8'));
    } catch {
      map = {};
    }
  }
  map[agent] = ocid;
  fs.mkdirSync(userDataDir(), { recursive: true });
  fs.writeFileSync(mapPath(), JSON.stringify(map, null, 2));
}

function sanitize(ocid) {
  return ocid.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function run() {
  await app.whenReady();

  const rl = readline.createInterface({ input, output });

  console.log('============================================================');
  console.log('  Maple Overlay — Nexon 캐릭터 온보딩');
  console.log('============================================================');

  let key = args.key ?? loadKey();
  if (!key) {
    key = (await rl.question('Nexon Open API key: ')).trim();
  }
  if (!key) {
    console.error('아무 키도 입력되지 않았습니다.');
    process.exit(1);
  }

  // 키 저장 (이번 입력이 새 값일 수 있으므로 항상 갱신)
  try {
    saveKey(key);
    console.log(`✓ API key saved (encrypted): ${keyPath()}`);
  } catch (err) {
    console.error('API 키 저장 실패:', err.message);
    process.exit(1);
  }

  const name = args.name ?? (await rl.question('캐릭터명: ')).trim();
  if (!name) {
    console.error('캐릭터명이 필요합니다.');
    process.exit(1);
  }

  let agent = args.agent;
  if (agent === undefined) {
    const a = (await rl.question(`agent_name 매핑 (예: claude_code, 비우면 매핑 X): `)).trim();
    if (a) agent = a;
  }

  rl.close();

  try {
    console.log('OCID 조회 중...');
    const ocid = await fetchOcid(name, key);
    console.log(`✓ OCID: ${ocid.slice(0, 12)}…`);

    console.log('기본 정보 조회 중...');
    const basic = await fetchBasic(ocid, key);
    console.log(`✓ 캐릭터: ${basic.character_name}`);

    const file = path.join(cacheDir(), `${sanitize(ocid)}.png`);
    if (args.force || !fs.existsSync(file)) {
      console.log('이미지 다운로드 중...');
      const buf = await fetchImage(basic.character_image);
      fs.mkdirSync(cacheDir(), { recursive: true });
      fs.writeFileSync(file, buf);
      console.log(`✓ 이미지 저장: ${file}`);
    } else {
      console.log(`✓ 캐시 hit (재다운로드 X): ${file}`);
    }

    upsert({
      ocid,
      character_name: basic.character_name,
      file: `${sanitize(ocid)}.png`,
      cached_at: new Date().toISOString(),
    });

    if (agent) {
      setMapping(agent, ocid);
      console.log(`✓ 매핑 저장: ${agent} → ${basic.character_name}`);
    }

    console.log('완료. Maple Overlay 를 다시 시작하면 캐릭터가 적용됩니다.');
    process.exit(0);
  } catch (err) {
    console.error(`실패: ${err.message}`);
    process.exit(1);
  }
}

void run();
