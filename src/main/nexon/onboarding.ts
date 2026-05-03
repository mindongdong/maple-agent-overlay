import { fetchOcid, fetchBasic, fetchImage, NexonApiError } from './client';
import { upsertEntry, writeImage, setMapping, hasImage } from './cache';
import { saveApiKey, loadApiKey } from './keystore';
import type { CharacterEntry } from '../../shared/character';

/**
 * 캐릭터 등록 + (선택적) agent 매핑.
 *
 * 절차:
 *   1. API 키 (저장된 것 또는 인자) 사용
 *   2. character_name → OCID
 *   3. OCID → basic (character_image url)
 *   4. PNG 다운로드 + 캐시 저장
 *   5. agent 매핑 (제공된 경우)
 *
 * 실패는 NexonApiError 를 throw. 호출자(CLI 또는 IPC) 가 사용자에게 메시지 변환.
 */
export interface OnboardOptions {
  apiKey?: string;
  characterName: string;
  agentName?: string;
  /** 이미 캐시가 있으면 강제 갱신할지 */
  force?: boolean;
}

export interface OnboardResult {
  entry: CharacterEntry;
  mapped: boolean;
}

export async function onboardCharacter(opts: OnboardOptions): Promise<OnboardResult> {
  const key = opts.apiKey ?? loadApiKey();
  if (!key) {
    throw new NexonApiError('auth', null, 'no api key configured. Provide one to save.');
  }
  if (opts.apiKey) {
    saveApiKey(opts.apiKey);
  }

  const ocid = await fetchOcid(opts.characterName, key);
  const basic = await fetchBasic(ocid, key);

  let downloaded = false;
  if (opts.force || !hasImage(ocid)) {
    const buf = await fetchImage(basic.character_image);
    writeImage(ocid, buf);
    downloaded = true;
  }

  const entry: CharacterEntry = {
    ocid,
    character_name: basic.character_name,
    file: `${ocid}.png`,
    cached_at: new Date().toISOString(),
  };
  upsertEntry(entry);

  let mapped = false;
  if (opts.agentName) {
    setMapping(opts.agentName, ocid);
    mapped = true;
  }

  console.log(
    `[onboard] ${entry.character_name} (ocid=${ocid.slice(0, 8)}…) ${
      downloaded ? 'downloaded' : 'cached'
    }${mapped ? `, mapped to ${opts.agentName}` : ''}`,
  );
  return { entry, mapped };
}
