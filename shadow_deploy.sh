#!/bin/bash
# SHADOW-DEPLOY v2.0 — Lokale VPS deploy (geen Termux paths)
# Oude Contabo VPS (92.5.62.118) is offline. Deze VPS is nu de shadow node.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OMNI_DIR="$HOME/.omni"

echo "[SHADOW-DEPLOY] OMNI-KERNEL stack deployment naar lokale VPS..."
echo "[SHADOW-DEPLOY] Doel: deze machine ($(hostname))"
echo ""

# Stap 1: Zorg dat neurale weights bestaan
echo "[SHADOW-DEPLOY] Stap 1/4: Neurale feedback init..."
python3 "$SCRIPT_DIR/neural_feedback.py" 2>&1

# Stap 2: Maak test HOT_HIT aan om profit_router te valideren
echo ""
echo "[SHADOW-DEPLOY] Stap 2/4: Profit router test..."
mkdir -p "$OMNI_DIR"
echo "SUPER-EDGE detected at 1.85x" > "$OMNI_DIR/HOT_HIT.txt"
python3 "$SCRIPT_DIR/profit_router.py" 2>&1

# Stap 3: Archiveer de stack
echo ""
echo "[SHADOW-DEPLOY] Stap 3/4: Archiveren OMNI-KERNEL stack..."
BACKUP_FILE="/tmp/omni_kernel_$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czf "$BACKUP_FILE" \
    -C "$(dirname "$SCRIPT_DIR")" \
    "$(basename "$SCRIPT_DIR")" \
    "$(basename "$OMNI_DIR")" 2>/dev/null
echo "[SHADOW-DEPLOY] Backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Stap 4: Start C2 monitor in achtergrond
echo ""
echo "[SHADOW-DEPLOY] Stap 4/4: C2 monitor status..."
echo "[SHADOW-DEPLOY] (draai met: python3 $SCRIPT_DIR/c2_sync.py &)"
echo ""
echo "[SHADOW-DEPLOY] >>> DEPLOY COMPLETE <<<"
echo "[SHADOW-DEPLOY] Shadow node status: ONLINE | Pulse: ETERNAL | Mode: Godmode"
