import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  AgentCharacterMapSchema,
  CharacterIndexSchema,
  type AgentCharacterMap,
  type CharacterEntry,
} from '../../shared/character';

/**
 * 캐릭터 이미지 영구 캐시 + agent_name ↔ ocid 매핑.
 *
 * userData/character-cache/index.json     — CharacterIndex
 * userData/character-cache/{ocid}.png     — PNG bytes
 * userData/agent-character-map.json       — AgentCharacterMap
 *
 * 캐시 hit 이면 외부 통신 0회. 사용자 명시 요청(refresh)에만 재다운로드.
 */

function cacheDir(): string {
  return path.join(app.getPath('userData'), 'character-cache');
}

function indexPath(): string {
  return path.join(cacheDir(), 'index.json');
}

function imagePath(ocid: string): string {
  return path.join(cacheDir(), `${sanitizeOcid(ocid)}.png`);
}

function mapPath(): string {
  return path.join(app.getPath('userData'), 'agent-character-map.json');
}

function sanitizeOcid(ocid: string): string {
  return ocid.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function readIndex(): CharacterEntry[] {
  const file = indexPath();
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = CharacterIndexSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf-8')));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export function writeIndex(index: CharacterEntry[]): void {
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(CharacterIndexSchema.parse(index), null, 2));
}

export function hasImage(ocid: string): boolean {
  return fs.existsSync(imagePath(ocid));
}

export function readImage(ocid: string): Buffer | null {
  const file = imagePath(ocid);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

export function writeImage(ocid: string, buf: Buffer): void {
  fs.mkdirSync(cacheDir(), { recursive: true });
  fs.writeFileSync(imagePath(ocid), buf);
}

export function upsertEntry(entry: CharacterEntry): void {
  const idx = readIndex();
  const filtered = idx.filter((e) => e.ocid !== entry.ocid);
  filtered.push(entry);
  writeIndex(filtered);
}

export function findByName(name: string): CharacterEntry | null {
  return readIndex().find((e) => e.character_name === name) ?? null;
}

export function findByOcid(ocid: string): CharacterEntry | null {
  return readIndex().find((e) => e.ocid === ocid) ?? null;
}

/* --------------------------------------------------------------- */
/* agent → character mapping                                       */
/* --------------------------------------------------------------- */

export function readAgentMap(): AgentCharacterMap {
  const file = mapPath();
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = AgentCharacterMapSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf-8')));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function writeAgentMap(map: AgentCharacterMap): void {
  const file = mapPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(AgentCharacterMapSchema.parse(map), null, 2));
}

export function setMapping(agentName: string, ocid: string): AgentCharacterMap {
  const map = readAgentMap();
  map[agentName] = ocid;
  writeAgentMap(map);
  return map;
}

export function clearMapping(agentName: string): AgentCharacterMap {
  const map = readAgentMap();
  delete map[agentName];
  writeAgentMap(map);
  return map;
}
