import os
import json
import time

OMNI_DIR = os.path.expanduser("~/.omni")

def train_network():
    weights_file = os.path.join(OMNI_DIR, "neural_weights.json")
    weights = {"delta_threshold": 1.0, "kelly_multiplier": 1.0, "confidence_score": 0.85}
    
    if os.path.exists(weights_file):
        with open(weights_file, 'r') as f:
            try:
                weights = json.load(f)
            except:
                pass
    else:
        os.makedirs(OMNI_DIR, exist_ok=True)
    
    raw_results = os.path.join(os.path.dirname(__file__), "raw_results.txt")
    if os.path.exists(raw_results):
        with open(raw_results, 'r') as f:
            data = f.read()
            hit_count = data.count("SUPER-EDGE") + data.count("HOT HIT")
            
            if hit_count > 0:
                old = dict(weights)
                weights["delta_threshold"] = max(0.5, weights["delta_threshold"] * 0.98)
                weights["kelly_multiplier"] = min(2.0, weights["kelly_multiplier"] * 1.05)
                weights["confidence_score"] = min(0.99, weights["confidence_score"] + 0.01)
                print(f"[NEURAL-FEEDBACK] Backpropagation uitgevoerd: {hit_count} hits verwerkt")
                print(f"[NEURAL-FEEDBACK] delta: {old['delta_threshold']:.3f} -> {weights['delta_threshold']:.3f}")
                print(f"[NEURAL-FEEDBACK] kelly:  {old['kelly_multiplier']:.3f} -> {weights['kelly_multiplier']:.3f}")
                print(f"[NEURAL-FEEDBACK] conf:   {old['confidence_score']:.3f} -> {weights['confidence_score']:.3f}")
    
    with open(weights_file, 'w') as f:
        json.dump(weights, f)
    print(f"[NEURAL-FEEDBACK] Weights opgeslagen naar {weights_file}")

if __name__ == "__main__":
    train_network()
