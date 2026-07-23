import urllib.request
import urllib.error
import json
import math
import time
import sys
import os

def poisson(k, lamb):
    return (lamb**k * math.exp(-lamb)) / math.factorial(k)

def calculate_edge(h_alpha, a_alpha):
    home_exp = max(0.1, h_alpha * 1.05)
    away_exp = max(0.1, a_alpha * 1.05)
    p_home = sum(poisson(h, home_exp) * poisson(a, away_exp) for h in range(6) for a in range(6) if h > a)
    odds = 2.5
    edge = (p_home * odds) - 1.0
    return p_home, odds, edge

def silent_alert(message):
    alert_file = "/data/data/com.termux/files/home/.omni/silent_alerts.log"
    os.makedirs(os.path.dirname(alert_file), exist_ok=True)
    with open(alert_file, "a") as f:
        f.write(f"[{time.time()}] {message}\n")

# CHECK IF SUPER EDGE LOGIC IS ACTIVE BY CALLING THE SYNTHESIZER EXECUTABLE
def check_super_edge():
    # If the synthesizer has written to the bin file within the last 60 seconds, we treat edge as 15% instead of 5%.
    bin_file = "/data/data/com.termux/files/home/.omni/super_edges.bin"
    if os.path.exists(bin_file):
        mod_time = os.path.getmtime(bin_file)
        if time.time() - mod_time < 60:
            return True
    return False

def harvest(url):
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            
            is_super_edge_mode = check_super_edge()
            target_edge = 0.15 if is_super_edge_mode else 0.10
            
            # Sniper Stream
            if "sniper" in url:
                for m in data:
                    p_home, odds, edge = calculate_edge(m.get("home_alpha", 15), m.get("away_alpha", 12))
                    if edge > target_edge:
                        silent_alert(f"Extreme Edge: {m['home']} vs {m['away']} | Edge: {edge:.2%}")
            
            # Solana Stream
            elif "solana" in url:
                for pos in data:
                    edge = (pos.get("buy_price", 100) / 100.0) * 0.15
                    if edge > target_edge:
                        silent_alert(f"Solana Extreme Edge on {pos.get('token_address')}")
                        
            # Greenwheels Stream
            elif "greenwheels" in url:
                for car in data:
                    if car.get("distance_meters", 9999) < 200:
                        silent_alert(f"Greenwheels Car close: {car.get('license')} at {car.get('distance_meters')}m")

    except urllib.error.HTTPError as e:
        if e.code == 403 or e.code == 401:
            sys.exit(43)
    except Exception:
        pass

if __name__ == "__main__":
    target_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/api/sniper/livescores"
    for _ in range(5):
        harvest(target_url)
        time.sleep(0.05)
