#!/usr/bin/env bash
# Run every test in tools/tests/*.js sequentially. Exit non-zero on any FAIL.

set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=0

for f in "$SCRIPT_DIR"/tests/*.js; do
    echo
    echo "=== $(basename "$f" .js) ==="
    if ! node "$f"; then
        FAILED=$((FAILED + 1))
    fi
done

echo
if [ "$FAILED" -gt 0 ]; then
    echo "SUITE FAIL: $FAILED test(s) failed."
    exit 1
else
    echo "SUITE PASS: all tests green."
    exit 0
fi
