import subprocess
import sys
import time
import datetime

def is_sleeping_hours():
    h = datetime.datetime.now().hour
    # Slaapcyclus: tussen 02:00 en 07:00
    if 2 <= h < 7:
        return True
    return False

def start_empire():
    streams = [
        "http://localhost:8080/api/sniper/livescores",
        "http://localhost:8080/api/solana/positions",
        "http://localhost:8080/api/greenwheels/cars"
    ]
    
    processes = []
    
    def spawn_harvesters():
        return [subprocess.Popen([sys.executable, "/data/data/com.termux/files/home/agy_tools/edge_harvester.py", s]) for s in streams]
    
    processes = spawn_harvesters()
    print(f"Empire Manager gestart. {len(processes)} harvesters actief.")
    
    start_time = time.time()
    try:
        while time.time() - start_time < 5.0: # Simulerende loop duration
            
            # Circadiaanse Ritmiek check
            if is_sleeping_hours():
                if processes:
                    print("[Circadian] Slaapcyclus gedetecteerd. Harvesters gepauzeerd.")
                    [p.kill() for p in processes]
                    processes = []
            else:
                if not processes:
                    print("[Circadian] Vrije tijd gedetecteerd. Harvesters hervat.")
                    processes = spawn_harvesters()
            
            if processes:
                ret_codes = [p.poll() for p in processes]
                if 43 in ret_codes:
                    print("[FAILSAFE] Onverwachte status gedetecteerd. Initiating Kill-Switch...")
                    [p.kill() for p in processes]
                    sys.exit(1)
            
            time.sleep(0.01)
    except KeyboardInterrupt:
        pass
    finally:
        [p.terminate() for p in processes if p.poll() is None]

if __name__ == "__main__":
    start_empire()
