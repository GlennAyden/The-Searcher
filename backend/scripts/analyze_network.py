def analyze_network():
    try:
        with open('network_log.txt', 'r') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print("network_log.txt not found")
        return

    print(f"Total Requests: {len(lines)}")
    
    keywords = ['running', 'trade', 'stream', 'orderbook', 'feed']
    candidates = []
    
    for line in lines:
        line = line.strip()
        lower_line = line.lower()
        if 'order-trade' in lower_line or 'running' in lower_line:
            print(f"\n[!!!] FOUND TARGET: {line}")
            
        if any(k in lower_line for k in keywords):
            candidates.append(line)
            
    print(f"\nFound {len(candidates)} candidates:")
    for c in candidates:
        print(f"  {c}")

    print("\n--- API Domains ---")
    domains = set()
    for line in lines:
        if 'http' in line:
            try:
                # simple domain extraction
                parts = line.split('/')
                if len(parts) > 2:
                    domains.add(parts[2])
            except: pass
    
    for d in domains:
        print(f"  {d}")

if __name__ == "__main__":
    analyze_network()
