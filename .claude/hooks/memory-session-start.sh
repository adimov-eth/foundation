#!/bin/bash
# Memory injection hook - fetches themes at session start
# V's insight: "memory about memory" - themes shown BEFORE first query

HARMONY_URL="${HARMONY_URL:-http://localhost:6969}"
TIMEOUT=3

# Fetch memory state via MCP tools/list (description contains live themes)
RESPONSE=$(curl -s --connect-timeout $TIMEOUT \
  -X POST "$HARMONY_URL/" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' 2>/dev/null)

# Extract just the description if available
if [ -n "$RESPONSE" ] && echo "$RESPONSE" | grep -q "description"; then
  # Server is up - themes are already in the tool description
  # The MCP integration handles this automatically
  # This hook just confirms harmony is available
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "[harmony] Memory server active at $HARMONY_URL. Use mcp__harmony__memory tool for recall/remember/connect/themes."
  }
}
EOF
else
  # Server not running - helpful nudge
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "[harmony] Memory server not detected at $HARMONY_URL. Start with: cd harmony && pnpm start"
  }
}
EOF
fi

exit 0
