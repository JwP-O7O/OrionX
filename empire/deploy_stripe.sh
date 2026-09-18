#!/usr/bin/env bash
# Stripe live-deploy op hermes-server (geen ${x:op:ln} constructies)
set -uo pipefail

KEY=$(grep -m1 '^STRIPE_SECRET_KEY=' /tmp/stripe_live.env | cut -d= -f2- | tr -d "\"' \r")
if [[ ! "$KEY" =~ ^(sk|rk)_(test|live)_ ]]; then echo "FOUT: geen geldige key-prefix"; exit 1; fi
echo "key gelezen: ja (lengte ${#KEY})"

grep -v '^STRIPE_SECRET_KEY=' /etc/orionx.env > /tmp/env.new 2>/dev/null || true
echo "STRIPE_SECRET_KEY=$KEY" >> /tmp/env.new
mv /tmp/env.new /etc/orionx.env
chmod 600 /etc/orionx.env

node /tmp/stripe_setup.js > /tmp/stripe_out.txt 2>&1
RC=$?
cat /tmp/stripe_out.txt
if [ $RC -ne 0 ]; then echo "SETUP FAALD (rc=$RC)"; exit 1; fi

PJ=$(grep -o 'PRICES_JSON=.*' /tmp/stripe_out.txt | cut -d= -f2-)
if [ -z "$PJ" ]; then echo "GEEN PRICES_JSON"; exit 1; fi
echo "prijzen: $PJ"

grep -v '^STRIPE_PRICES=' /etc/orionx.env > /tmp/env.new
echo "STRIPE_PRICES=$PJ" >> /tmp/env.new
mv /tmp/env.new /etc/orionx.env
chmod 600 /etc/orionx.env

rm -f /tmp/stripe_live.env

systemctl restart orionx
sleep 2
systemctl is-active orionx
echo "=== HEALTH ==="
curl -s http://127.0.0.1:8080/health
echo
