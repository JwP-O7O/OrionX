import time
import subprocess
import random
import sys

def is_alive(script_name):
    try:
        res = subprocess.run(["pgrep", "-f", script_name], capture_output=True)
        return res.returncode == 0
    except Exception:
        return False

def check_and_resurrect():
    while True:
        manager_alive = is_alive("empire_manager.py")
        sentinel_alive = is_alive("sentinel_watch.py")
        
        soft_start_delay = random.uniform(25.0, 35.0)
        
        if not manager_alive:
            subprocess.Popen([sys.executable, "/data/data/com.termux/files/home/agy_tools/empire_manager.py"])
            if not sentinel_alive:
                time.sleep(soft_start_delay)
                
        if not sentinel_alive:
            if not is_alive("sentinel_watch.py"):
                subprocess.Popen([sys.executable, "/data/data/com.termux/files/home/agy_tools/sentinel_watch.py"])
        
        jitter = random.uniform(17.0, 53.0)
        time.sleep(jitter)

if __name__ == "__main__":
    check_and_resurrect()
