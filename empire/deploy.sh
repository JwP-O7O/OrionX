#!/usr/bin/env bash
# OrionX Empire deploy — draait op de server zelf (sudo)
set -euxo pipefail

APP=/opt/orionx
mkdir -p "$APP/web" "$APP/data"
chown -R u0_a382:u0_a382 "$APP"

# admin-token alleen aanmaken als er nog geen env bestaat
if [ ! -f /etc/orionx.env ]; then
  TOK=$(openssl rand -hex 24)
  cat > /etc/orionx.env <<EOF
ORIONX_ADMIN=$TOK
SITE_URL=http://34.90.77.106
PORT=8080
GEMINI_MODEL=gemini-2.5-flash
# Stripe (vul in na aanmaken Stripe-account):
# STRIPE_SECRET_KEY=***
# STRIPE_WEBHOOK_SECRET=***
# STRIPE_PRICES={"starter":"price_...","pro":"price_...","scale":"price_..."}
# Resend e-mail (optioneel):
# RESEND_KEY=***
# EMAIL_FROM=OrionX <info@orionx.ai>
EOF
  chmod 600 /etc/orionx.env
  echo "ADMIN_TOKEN=$TOK" > "$APP/data/admin_token.txt"
  chmod 600 "$APP/data/admin_token.txt"
fi

# systemd service
cat > /etc/systemd/system/orionx.service <<'EOF'
[Unit]
Description=OrionX-AI Empire Kernel
After=network.target

[Service]
Type=simple
EnvironmentFile=/etc/orionx.env
WorkingDirectory=/opt/orionx
ExecStart=/usr/bin/node /opt/orionx/server.js
Restart=always
RestartSec=3
User=u0_a382
Group=u0_a382
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/opt/orionx/data

[Install]
WantedBy=multi-user.target
EOF

# nginx reverse proxy
cat > /etc/nginx/sites-available/orionx <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 120s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/orionx /etc/nginx/sites-enabled/orionx
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

systemctl daemon-reload
systemctl enable --now orionx
sleep 2
systemctl --no-pager status orionx | head -6
echo "=== HEALTH ==="
curl -s http://127.0.0.1:8080/health
echo
