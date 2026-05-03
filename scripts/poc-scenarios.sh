#!/usr/bin/env bash
# Maple Overlay — Phase 0 PoC 자동 시나리오.
#
# 캡처 서버가 떠 있는 상태에서 본 스크립트 실행 → 새 claude 세션 N개 spawn,
# 각각이 특정 도구를 호출 → 다양한 hook payload 가 _workspace/captures/ 에 적재.
#
# 사용:
#   터미널 A:  npm run poc:capture        # 캡처 서버 시작
#   터미널 B:  bash scripts/poc-scenarios.sh
#
# 주의:
#   - hooks 는 _workspace/adapter-engineer/poc-hooks.json (격리 파일) 에 정의.
#     --settings 플래그로 명시적 로드해서 settings.local.json 의 자동-rewrite 영향 회피
#   - claude -p (--print) 는 비대화형 1-shot. 매 호출마다 SessionStart + 도구 호출들 + Stop fire
#   - --permission-mode bypassPermissions: 권한 프롬프트 우회 (시나리오 1~5 용)
#   - 6) Notification(permission_prompt), 7) SubagentStop 은 대화형으로 별도 trigger

set -u

PORT="${MAPLE_OVERLAY_PORT:-40429}"
WEBHOOK_URL="http://127.0.0.1:${PORT}/event"
HOOKS_FILE="_workspace/adapter-engineer/poc-hooks.json"

# ---- 사전 점검 ----------------------------------------------------------

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: 'claude' CLI not found in PATH"
  exit 1
fi

# 캡처 서버 살아있나? probe (자체 캡처 1건 발생 — 무시 가능)
PROBE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" -d '{"_probe":true}' --max-time 2 2>/dev/null || echo "000")
case "$PROBE_CODE" in
  204|200|400|422)
    echo "✓ Capture server alive (probe HTTP $PROBE_CODE) on port $PORT"
    ;;
  *)
    echo "ERROR: Capture server not responding on port $PORT (probe HTTP $PROBE_CODE)"
    echo "       다른 터미널에서 먼저: npm run poc:capture"
    exit 1
    ;;
esac

if [ ! -f "$HOOKS_FILE" ]; then
  echo "ERROR: $HOOKS_FILE 를 찾을 수 없습니다."
  exit 1
fi

if [ ! -f .claude/settings.local.json ]; then
  echo "ERROR: 본 스크립트는 프로젝트 루트에서 실행해야 합니다."
  echo "       cd /Users/dongmin/Documents/GitHub/maple-agent-overlay"
  exit 1
fi

# ---- 시나리오 실행 ------------------------------------------------------

run() {
  local label="$1" prompt="$2"
  echo ""
  echo "============================================================"
  echo "▶ $label"
  echo "  prompt: $prompt"
  echo "============================================================"
  # --settings 로 hooks 명시 로드 (settings.local.json 의 자동-rewrite 영향 회피)
  # bypassPermissions: 권한 프롬프트 없이 도구 실행
  claude -p \
    --settings "$HOOKS_FILE" \
    --permission-mode bypassPermissions \
    "$prompt" 2>&1 | sed -n '1,30p'
  sleep 1
}

echo ""
echo "############################################################"
echo "#  Maple Overlay — Claude Code hook PoC scenarios"
echo "#  포트: $PORT  /  hooks: $HOOKS_FILE"
echo "############################################################"

run "1) Read tool" \
  "Read PRD.md and tell me the title in one short sentence. Do not modify anything."

run "2) Bash tool" \
  "Run the shell command: echo hello-from-poc && date. Just run it once."

run "3) Glob tool" \
  "Use the Glob tool to list files matching '_workspace/**/*.md' and just print the count."

run "4) Grep tool" \
  "Use Grep to find lines containing 'Phase 0' in PRD.md. Just print the line numbers."

run "5) Multi-tool" \
  "Read package.json, then run 'echo' with the version field as argument. Two tool calls only."

# ---- 안내: 수동 시나리오 -----------------------------------------------

cat <<EOM

############################################################
완료. 캡처된 페이로드 확인:
  ls _workspace/captures/
  cat _workspace/adapter-engineer/payload-samples.jsonl | head -3

추가 시나리오 (대화형 필요 — 별도 터미널에서):

  6) Notification(permission_prompt)
       claude --settings _workspace/adapter-engineer/poc-hooks.json
     세션 시작 후 묻기:
       "rm /tmp/maple-test-file 명령을 실행해줘"
     → 권한 프롬프트가 뜨면 그 자체가 Notification(permission_prompt)
       hook trigger. 실제 실행 거절해도 됨.

  7) SubagentStop
       claude --settings _workspace/adapter-engineer/poc-hooks.json
     세션 시작 후:
       "Task tool 로 general-purpose 서브에이전트를 띄워서
        'list md files in this directory' 만 실행시키고 결과 알려줘"
     → 서브에이전트 종료 시 SubagentStop hook fire.

캡처가 충분히 모이면:
  jq -r '.payload.hook_event_name' \\
    _workspace/adapter-engineer/payload-samples.jsonl | sort | uniq -c
로 hook 종류별 빈도 확인 가능.
############################################################
EOM
