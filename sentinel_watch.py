import os
import time
import re
import subprocess
import sys

def watch():
    alert_file = "/data/data/com.termux/files/home/.omni/silent_alerts.log"
    hot_file = "/data/data/com.termux/files/home/.omni/HOT_HIT.txt"
    
    if not os.path.exists(alert_file):
        os.makedirs(os.path.dirname(alert_file), exist_ok=True)
        open(alert_file, 'a').close()
        
    f = open(alert_file, "r")
    f.seek(0, os.SEEK_END)
    
    while True:
        line = f.readline()
        if not line:
            time.sleep(5.0)
            continue
            
        edge_val = 0.0
        edge_match = re.search(r"Edge: ([\d\.]+)%", line)
        if edge_match:
            edge_val = float(edge_match.group(1))
        elif "Greenwheels" in line:
            dist_match = re.search(r"at ([\d\.]+)m", line)
            if dist_match:
                dist = float(dist_match.group(1))
                if dist > 0:
                    edge_val = min(50.0, (30.0 / dist) * 100)
                    
        if edge_val > 20.0:
            stream_target = "http://localhost:8080/api/sniper/livescores"
            if "Solana" in line:
                stream_target = "http://localhost:8080/api/solana/positions"
            elif "Greenwheels" in line:
                stream_target = "http://localhost:8080/api/greenwheels/cars"
                
            try:
                subprocess.Popen([sys.executable, "/data/data/com.termux/files/home/agy_tools/edge_harvester.py", stream_target])
            except Exception:
                pass
            
            with open(hot_file, "a") as hf:
                hf.write(f"HOT HIT [{edge_val:.2f}%]: {line.strip()}\n")

if __name__ == "__main__":
    watch()
