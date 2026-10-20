#!/usr/bin/env bash
# End-to-end API smoke test: health → availability → booking, and asserts the
# booked instant is rendered correctly in BOTH the parent and mentor timezones.
#
# Usage:  BASE_URL=http://localhost:4000 ./scripts/smoke-test.sh
# Requires: a running API + seeded mentors, curl, python3.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
TZ_PARENT="America/New_York"
DATE="$(date -u -v+1d +%Y-%m-%d 2>/dev/null || date -u -d '+1 day' +%Y-%m-%d)"

echo "→ health"
curl -fsS "$BASE_URL/api/health" | python3 -m json.tool

echo "→ availability ($TZ_PARENT, $DATE)"
AVAIL="$(curl -fsS "$BASE_URL/api/availability?timezone=$TZ_PARENT&date=$DATE")"
SLOT="$(echo "$AVAIL" | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((s['startUtc'] for s in d['slots'] if s['isAvailable']),''))")"
[ -n "$SLOT" ] || { echo "No available slot found"; exit 1; }
echo "  first available slot: $SLOT"

echo "→ booking"
curl -fsS -X POST "$BASE_URL/api/bookings" \
  -H 'Content-Type: application/json' \
  -d "{\"parentName\":\"Smoke Test\",\"parentEmail\":\"smoke@example.com\",\"parentTimezone\":\"$TZ_PARENT\",\"slotStartUtc\":\"$SLOT\"}" \
  | python3 -c "
import sys,json
b=json.load(sys.stdin)
p=b['parentView']['start']; m=b['mentorView']['start']
assert p['iso']==m['iso'], 'parent/mentor instants differ!'
print(f\"  mentor: {b['mentor']['name']}\")
print(f\"  parent sees: {p['full']}\")
print(f\"  mentor sees: {m['full']}\")
print(f\"  link: {b['classLink']}\")
print('  OK: same instant in both timezones')
"
echo "✓ smoke test passed"
