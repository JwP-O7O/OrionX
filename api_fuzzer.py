import requests
import random
import string

def fuzz_endpoint(url):
    chars = string.ascii_letters + string.digits
    for _ in range(100):
        param = ''.join(random.choices(chars, k=10))
        try:
            r = requests.get(f"{url}?{param}={param}")
            if r.status_code != 200:
                print(f"Potential Leak/Error: {param} -> {r.status_code}")
        except: pass

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        fuzz_endpoint(sys.argv[1])
    else:
        print("Usage: python api_fuzzer.py <url>")
