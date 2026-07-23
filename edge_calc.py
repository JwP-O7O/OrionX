import math

def poisson_prob(lmbda, k):
    return (math.exp(-lmbda) * pow(lmbda, k)) / math.factorial(k)

def calculate_kelly(edge, odds):
    # edge = (true_prob * odds) - 1
    return edge / (odds - 1)

if __name__ == "__main__":
    # Simpel voorbeeld: python3 edge_calc.py 0.35 2.5 (TrueProb 35%, Odds 2.5)
    import sys
    if len(sys.argv) > 2:
        tp = float(sys.argv[1])
        odds = float(sys.argv[2])
        edge = (tp * odds) - 1
        print(f"Edge: {edge:.2%}, Kelly Stake: {calculate_kelly(edge, odds):.2%}")
    else:
        print("Usage: python edge_calc.py <true_prob> <odds>")
