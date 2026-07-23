import os
import time
import base64
import urllib.request
import urllib.error
import random
import sys
import socket
import ctypes

try:
    libc = ctypes.CDLL('libc.so.6')
except Exception:
    pass

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1.2 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
]

def kelly_criterion(edge, win_prob):
    if win_prob <= 0: return 0
    stake_fraction = edge / (2.5 - 1.0)
    return max(0, min(1.0, stake_fraction))

pre_connections = []

def pre_connect():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2.0)
        s.connect(('localhost', 8080))
        pre_connections.append(s)
    except Exception:
        pass

# Profit capping global state
TOTAL_PROFIT_TODAY = 0.0
PROFIT_LIMIT = 5000.0  # Limit per day
LAST_RESET_DAY = time.localtime().tm_yday

def nuclear_clean_sweep():
    print("[NUCLEAR] Initiating Clean Sweep...")
    files_to_burn = [
        "/data/data/com.termux/files/home/.omni/super_edges.bin",
        "/data/data/com.termux/files/home/.omni/pre_connect.bin",
        "/data/data/com.termux/files/home/.omni/silent_alerts.log"
    ]
    for f in files_to_burn:
        if os.path.exists(f):
            # Overwrite with random bytes
            size = os.path.getsize(f)
            with open(f, "wb") as bf:
                bf.write(os.urandom(size))
            os.remove(f)
    sys.exit(0)

def execute_action(decoded_msg):
    global TOTAL_PROFIT_TODAY, LAST_RESET_DAY
    
    current_day = time.localtime().tm_yday
    if current_day != LAST_RESET_DAY:
        TOTAL_PROFIT_TODAY = 0.0
        LAST_RESET_DAY = current_day

    # Turing-Masking: 5% chance to simulate a dumb human bet (low edge)
    is_turing_mask = random.random() < 0.05
    
    edge_value = 0.15
    if "SUPER-EDGE" in decoded_msg:
        edge_value = 0.15
        
    if is_turing_mask:
        edge_value = 0.02 # Sub-optimal play
        
    stake_pct = kelly_criterion(edge_value, 0.45)
    
    # Dynamic Profit-Capping
    if TOTAL_PROFIT_TODAY > PROFIT_LIMIT:
        # Low-Profile Mode: reduce stake drastically
        stake_pct *= 0.10
        
    estimated_profit = stake_pct * 1000.0 * edge_value # Mock estimation
    TOTAL_PROFIT_TODAY += estimated_profit

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "X-Request-Id": os.urandom(8).hex(),
        "Accept": "application/json"
    }
    
    msg_payload = "EXECUTE_TURING_MASK" if is_turing_mask else "EXECUTE_SUPER_EDGE"
    
    if pre_connections:
        s = pre_connections.pop(0)
        try:
            req = f"POST /api/omni/chat HTTP/1.1\r\nHost: localhost:8080\r\nUser-Agent: {headers['User-Agent']}\r\nX-Request-Id: {headers['X-Request-Id']}\r\nAccept: {headers['Accept']}\r\nContent-Length: {len(msg_payload) + 15}\r\n\r\n{{\"message\": \"{msg_payload}\"}}"
            s.sendall(req.encode())
            # Read response to check for 403 Nuclear trigger
            resp = s.recv(1024).decode()
            if "403 Forbidden" in resp or "401 Unauthorized" in resp:
                nuclear_clean_sweep()
            s.close()
            return
        except Exception:
            pass

    req = urllib.request.Request("http://localhost:8080/api/omni/chat", data=f'{{"message": "{msg_payload}"}}'.encode(), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            pass
    except urllib.error.HTTPError as e:
        if e.code in [401, 403]:
            nuclear_clean_sweep()
    except Exception:
        pass

def trigger_bridge():
    bin_file = "/data/data/com.termux/files/home/.omni/super_edges.bin"
    pre_connect_file = "/data/data/com.termux/files/home/.omni/pre_connect.bin"
    
    for f_path in [bin_file, pre_connect_file]:
        if not os.path.exists(f_path):
            os.makedirs(os.path.dirname(f_path), exist_ok=True)
            open(f_path, 'a').close()
            
    f_edge = open(bin_file, "rb")
    f_edge.seek(0, os.SEEK_END)
    
    f_pre = open(pre_connect_file, "rb")
    f_pre.seek(0, os.SEEK_END)
    
    while True:
        line_pre = f_pre.readline()
        if line_pre:
            try:
                base64.b64decode(line_pre.strip()).decode()
                pre_connect()
            except Exception:
                pass
                
        line_edge = f_edge.readline()
        if not line_edge:
            time.sleep(0.001)
            continue
        try:
            decoded = base64.b64decode(line_edge.strip()).decode()
            execute_action(decoded)
        except Exception:
            pass

if __name__ == "__main__":
    trigger_bridge()
