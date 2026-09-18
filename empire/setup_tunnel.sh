#!/usr/bin/env bash
# Stap A1/A2: cloudflared tunnel + Stripe webhook registratie (op server, sudo)
set -uo pipefail

# --- cloudflared installeren ---
if ! command -v cloudflared >/dev/null 2>&1; then
  cd /tmp
  curl -sL -o cfx.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  dpkg -i cfx.deb >/dev/null 2>&1 || dpkg -i cfx.deb
  rm -f cfx.deb
fi
cloudflared --version

# --- tunnel als systemd service ---
cat > /etc/systemd/system/orionx-tunnel.service <<'EOF'
[Unit]
Description=OrionX Cloudflare quick tunnel -> kernel
After=network-online.target

[Service]
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now orionx-tunnel
sleep 14
TUNNEL_URL=$(journalctl -u orionx-tunnel --since '-3 min' -o cat | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
if [ -z "$TUNNEL_URL" ]; then echo "GEEN TUNNEL-URL GEVONDEN"; journalctl -u orionx-tunnel -n 10 -o cat; exit 1; fi
echo "TUNNEL=$TUNNEL_URL"
echo "$TUNNEL_URL" > /opt/orionx/data/tunnel_url.txt

# --- webhook registreren + secret direct in env (nooit echo) ---
node /tmp/stripe_webhook.js 2>&1 | sed 's/whsec_[A-Za-z0-9]*/whsec_REDACTED/g'
