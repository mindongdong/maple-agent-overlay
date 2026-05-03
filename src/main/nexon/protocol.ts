import { protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { app } from 'electron';
import { CHARACTER_PROTOCOL } from '../../shared/character';

/**
 * 캐시된 캐릭터 PNG 를 안전하게 렌더러로 노출하는 커스텀 프로토콜.
 *
 *  maple-character://{ocid}.png  →  userData/character-cache/{ocid}.png
 *
 * file:// 직접 노출 회피. sandbox 안전. 외부 URL 로드 불가능.
 *
 * privileged scheme 등록은 app.whenReady() 이전에 호출되어야 한다 (registerSchemesAsPrivileged).
 */

export function registerCharacterScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CHARACTER_PROTOCOL,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        bypassCSP: false,
        corsEnabled: false,
      },
    },
  ]);
}

export function handleCharacterScheme(): void {
  const cacheDir = path.join(app.getPath('userData'), 'character-cache');

  protocol.handle(CHARACTER_PROTOCOL, async (request) => {
    const url = new URL(request.url);
    // host 부분에 ocid 가 들어옴 (maple-character://OCID.png)
    const filename = decodeURIComponent(url.host) + url.pathname; // host + path 합쳐서 검사
    const justName = path.basename(filename);

    // path traversal 방어: basename 만 사용, 영숫자/하이픈/언더스코어/마침표만 허용
    if (!/^[a-zA-Z0-9_\-.]+\.png$/.test(justName)) {
      return new Response('forbidden', { status: 403 });
    }

    const filePath = path.join(cacheDir, justName);
    // resolved 가 cacheDir 내부에 있는지 재확인
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(cacheDir) + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }

    return net.fetch(pathToFileURL(resolved).toString());
  });
}
