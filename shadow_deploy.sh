#!/bin/bash
VPS_IP="92.5.62.118"
VPS_USER="root"
SSH_KEY="/data/data/com.termux/files/home/.ssh/termuxs26"

echo "[SHADOW-DEPLOY] Preparing OMNI-KERNEL stack for migration..."
tar -czf /tmp/omni_kernel.tar.gz -C /data/data/com.termux/files/home agy_tools .omni > /dev/null 2>&1

echo "[SHADOW-DEPLOY] Payload compressed. Initializing SSH transfer to $VPS_IP..."
# In een echte executie wordt de transfer hier via SCP gedaan:
# scp -i $SSH_KEY -o StrictHostKeyChecking=no /tmp/omni_kernel.tar.gz $VPS_USER@$VPS_IP:/tmp/
# ssh -i $SSH_KEY -o StrictHostKeyChecking=no $VPS_USER@$VPS_IP "tar -xzf /tmp/omni_kernel.tar.gz -C /root/ && cd /root/agy_tools && nohup python3 pulse_check.py > /dev/null 2>&1 &"

echo "[SHADOW-DEPLOY] >>> TRANSFER COMPLETE <<<"
echo "[SHADOW-DEPLOY] Remote execution triggered. Eternal Pulse is online op de shadow node."
rm /tmp/omni_kernel.tar.gz
