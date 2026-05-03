import { z } from 'zod';
import { tryTake, dedup } from './ratelimit';

/**
 * Nexon MapleStory Open API 클라이언트.
 *
 *  - Base URL: https://open.api.nexon.com
 *  - 인증: x-nxopen-api-key 헤더
 *  - Rate Limit 안전장치: tryTake() 통과 시에만 fetch
 *  - 같은 OCID/캐릭명 동시 호출은 dedup
 *
 * 응답은 zod 로 검증. 외부 API 응답을 신뢰하지 않는다.
 */

const BASE_URL = 'https://open.api.nexon.com';

const OcidResponse = z.object({ ocid: z.string().min(1) });
type OcidResponse = z.infer<typeof OcidResponse>;

const BasicResponse = z.object({
  character_image: z.string().url(),
  character_name: z.string().min(1),
});
export type BasicResponse = z.infer<typeof BasicResponse>;

export class NexonApiError extends Error {
  constructor(
    public readonly kind: 'rate_limit' | 'auth' | 'not_found' | 'server' | 'network' | 'invalid_response',
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'NexonApiError';
  }
}

async function callJson(path: string, key: string): Promise<unknown> {
  if (!tryTake()) {
    throw new NexonApiError('rate_limit', 429, 'self-rate-limit reached (400/min)');
  }
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'x-nxopen-api-key': key },
    });
  } catch (err) {
    throw new NexonApiError('network', null, `network error: ${(err as Error).message}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new NexonApiError('auth', res.status, 'invalid api key');
  }
  if (res.status === 404) {
    throw new NexonApiError('not_found', 404, 'not found');
  }
  if (res.status === 429) {
    throw new NexonApiError('rate_limit', 429, 'nexon rate limit exceeded');
  }
  if (res.status >= 500) {
    throw new NexonApiError('server', res.status, `nexon server ${res.status}`);
  }
  if (!res.ok) {
    throw new NexonApiError('server', res.status, `unexpected ${res.status}`);
  }
  return res.json();
}

export async function fetchOcid(characterName: string, key: string): Promise<string> {
  return dedup(`ocid:${characterName}`, async () => {
    const params = new URLSearchParams({ character_name: characterName });
    const data = await callJson(`/maplestory/v1/id?${params}`, key);
    const parsed = OcidResponse.safeParse(data);
    if (!parsed.success) {
      throw new NexonApiError('invalid_response', null, 'unexpected ocid response shape');
    }
    return parsed.data.ocid;
  });
}

export async function fetchBasic(ocid: string, key: string): Promise<BasicResponse> {
  return dedup(`basic:${ocid}`, async () => {
    const params = new URLSearchParams({ ocid });
    const data = await callJson(`/maplestory/v1/character/basic?${params}`, key);
    const parsed = BasicResponse.safeParse(data);
    if (!parsed.success) {
      throw new NexonApiError('invalid_response', null, 'unexpected basic response shape');
    }
    return parsed.data;
  });
}

/** 이미지 URL 을 받아 PNG 버퍼로 다운로드 (Rate Limit 카운트 동일 적용). */
export async function fetchImage(url: string): Promise<Buffer> {
  if (!tryTake()) {
    throw new NexonApiError('rate_limit', 429, 'self-rate-limit reached (400/min)');
  }
  return dedup(`image:${url}`, async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new NexonApiError('server', res.status, `image fetch ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  });
}
