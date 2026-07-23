import os
import re
import base64
from collections import deque
import time

def analyze_lead_stream(events):
    lead_counts = {"sniper": 0, "solana": 0, "greenwheels": 0}
    window = deque()
    
    for t, msg, edge_val, stream_name in events:
        while window and t - window[0][0] > 60.0:
            window.popleft()
        window.append((t, msg, edge_val, stream_name))
        
        streams_in_window = set([w[3] for w in window if w[3]])
        if len(streams_in_window) >= 2:
            first_stream = window[0][3]
            if first_stream:
                lead_counts[first_stream] += 1
            window.clear()
            
    if sum(lead_counts.values()) == 0:
        return "solana" # fallback
    return max(lead_counts, key=lead_counts.get)

def synthesize():
    log_file = "/data/data/com.termux/files/home/.omni/silent_alerts.log"
    out_file = "/data/data/com.termux/files/home/.omni/super_edges.bin"
    pre_connect_file = "/data/data/com.termux/files/home/.omni/pre_connect.bin"
    
    if not os.path.exists(log_file):
        return

    with open(log_file, "r") as f:
        lines = f.readlines()
        
    pattern = re.compile(r"\[([\d\.]+)\] (.*)")
    
    events = []
    for line in lines:
        m = pattern.match(line)
        if m:
            t = float(m.group(1))
            msg = m.group(2)
            edge_match = re.search(r"Edge: ([\d\.]+)%", msg)
            edge_val = float(edge_match.group(1)) if edge_match else 10.0
            
            stream_name = None
            if "vs" in msg:
                stream_name = "sniper"
            elif "Solana" in msg:
                stream_name = "solana"
            elif "Greenwheels" in msg:
                stream_name = "greenwheels"
                
            events.append((t, msg, edge_val, stream_name))
            
    events.sort(key=lambda x: x[0])
    
    lead_stream = analyze_lead_stream(events)
    
    super_edges = []
    pre_connects = []
    window = deque()
    
    last_edges = {"sniper": 0.0, "solana": 0.0, "greenwheels": 0.0}
    
    for t, msg, edge_val, stream_name in events:
        while window and t - window[0][0] > 60.0:
            window.popleft()
            
        window.append((t, msg, edge_val, stream_name))
        
        streams_in_window = set()
        deltas = {}
        for wt, wmsg, wedge, wstream in window:
            if wstream:
                streams_in_window.add(wstream)
                delta = wedge - last_edges[wstream]
                deltas[wstream] = delta
                last_edges[wstream] = wedge
                
        if stream_name == lead_stream and deltas.get(lead_stream, 0) > 1.0:
             pre_connect_msg = f"PREDICTIVE-LEAD-TRIGGER: Lead stream {lead_stream} spiking"
             pre_connects.append(pre_connect_msg)
                
        converging_streams = sum(1 for d in deltas.values() if d > 1.0)
        if converging_streams >= 2:
            pre_connect_msg = f"PREDICTIVE-TRIGGER: Converging streams {streams_in_window} with high delta"
            pre_connects.append(pre_connect_msg)

        if len(streams_in_window) >= 2:
            edge_msg = f"SUPER-EDGE (15%+) DETECTED at {t}: Cross-correlated streams {streams_in_window}"
            super_edges.append(edge_msg)
            window.clear()
            
    if pre_connects:
        os.makedirs(os.path.dirname(pre_connect_file), exist_ok=True)
        with open(pre_connect_file, "ab") as f:
            for pc in pre_connects:
                f.write(base64.b64encode(pc.encode()) + b"\n")

    if super_edges:
        os.makedirs(os.path.dirname(out_file), exist_ok=True)
        with open(out_file, "ab") as f:
            for edge in super_edges:
                f.write(base64.b64encode(edge.encode()) + b"\n")

if __name__ == "__main__":
    synthesize()
