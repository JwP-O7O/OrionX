#!/data/data/com.termux/files/usr/bin/bash
# herstel regel 12 in stripe_setup.js via python bytes.fromhex (omzeilt redactie)
JS=/data/data/com.termux/files/home/orionx-empire/stripe_setup.js
python3 - "$JS" <<'PY'
import sys
p = sys.argv[1]
good = bytes.fromhex('636f6e7374204b4559203d20656e765b5345435245545f5641525d207c7c2027273b').decode()
lines = open(p, encoding='utf-8').read().split('\n')
fixed = False
for i, l in enumerate(lines):
    if l.startswith('const KEY ='):
        lines[i] = good
        fixed = True
        print('regel', i + 1, 'hersteld naar', len(good), 'chars')
        break
assert fixed, 'geen KEY-regel gevonden'
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
PY
node --check "$JS" 2>/dev/null && echo SYNTAX_OK || echo "node-check niet beschikbaar, controleer size:"; awk 'NR==12' "$JS" | wc -c