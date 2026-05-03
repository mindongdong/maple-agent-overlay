#!/usr/bin/env node
/**
 * Phase 0 PoC — Claude Code hook payload 캡처 도구.
 *
 * PRD는 `nc -l 40429`를 제안하지만, nc는 HTTP 응답을 돌려주지 못해
 * Claude Code가 hook timeout으로 처리할 수 있다. 이 스크립트는 동일한 역할을 하면서
 *  - 200 응답을 정상 반환
 *  - 모든 페이로드를 _workspace/captures/ 로 dump
 *  - 콘솔에 한 줄 요약 출력
 * 한다.
 *
 * 사용법:
 *   1) node scripts/capture-hooks.mjs
 *   2) ~/.claude/settings.json 의 hooks 가 http://127.0.0.1:40429/event 로 향하도록 설정
 *   3) 다른 터미널에서 Claude Code 작업 실행
 *   4) Ctrl+C 로 종료. 캡처 결과를 _workspace/captures/ 와
 *      _workspace/adapter-engineer/payload-samples.jsonl 에서 확인
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CAPTURES_DIR = path.join(ROOT, '_workspace', 'captures');
const SAMPLES_FILE = path.join(ROOT, '_workspace', 'adapter-engineer', 'payload-samples.jsonl');

fs.mkdirSync(CAPTURES_DIR, { recursive: true });
fs.mkdirSync(path.dirname(SAMPLES_FILE), { recursive: true });

const PORT_BASE = 40429;
const MAX_FALLBACK = 10;
const MAX_BODY = 100_000; // 100KB 상한

let captureCount = 0;

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function summarize(payload) {
  const event = payload?.hook_event_name ?? payload?.state ?? '?';
  const tool = payload?.tool_name ?? '';
  const matcher = payload?.matcher ?? '';
  return [event, tool, matcher].filter(Boolean).join(' / ');
}

function handle(req, res) {
  if (req.method !== 'POST' || req.url !== '/event') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  let aborted = false;

  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) {
      aborted = true;
      res.writeHead(413);
      res.end('payload too large');
      req.destroy();
    }
  });

  req.on('end', () => {
    if (aborted) return;

    captureCount += 1;
    const ts = timestamp();
    const headersFile = path.join(CAPTURES_DIR, `${ts}-${captureCount}.headers.json`);
    const bodyFile = path.join(CAPTURES_DIR, `${ts}-${captureCount}.body.txt`);

    fs.writeFileSync(headersFile, JSON.stringify(req.headers, null, 2));
    fs.writeFileSync(bodyFile, body);

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = { __raw: body };
    }

    fs.appendFileSync(
      SAMPLES_FILE,
      JSON.stringify({ at: new Date().toISOString(), payload: parsed }) + '\n',
    );

    const summary = summarize(parsed);
    console.log(`[${captureCount}] ${ts}  ${summary}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  req.on('error', (err) => {
    console.error('request error:', err.message);
  });
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handle);
    server.once('error', reject);
    // 반드시 127.0.0.1 명시. 외부 IP 절대 금지 (보안)
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

async function start() {
  for (let i = 0; i < MAX_FALLBACK; i++) {
    const port = PORT_BASE + i;
    try {
      await listen(port);
      console.log('============================================================');
      console.log(`  Maple Overlay — Phase 0 hook capture`);
      console.log(`  Listening on http://127.0.0.1:${port}/event`);
      console.log(`  Captures   : ${path.relative(ROOT, CAPTURES_DIR)}/`);
      console.log(`  Samples    : ${path.relative(ROOT, SAMPLES_FILE)}`);
      console.log('============================================================');
      console.log('Tip: ~/.claude/settings.json hooks 의 url 을 위 주소로 맞춰주세요.');
      console.log('Ctrl+C 로 종료.');
      return;
    } catch (e) {
      if (e.code === 'EADDRINUSE') {
        console.warn(`port ${port} in use, trying next...`);
        continue;
      }
      throw e;
    }
  }
  console.error(`No available port in ${PORT_BASE}..${PORT_BASE + MAX_FALLBACK - 1}`);
  process.exit(1);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n총 ${captureCount}건 캡처. 종료.`);
  process.exit(0);
});
