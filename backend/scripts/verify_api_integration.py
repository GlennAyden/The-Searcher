import subprocess
import time
import requests
import sys
import os

# Ensure backend dir is in path? Not needed for requests.
# But we need to run main.py

def run_verification():
    print("[*] Starting Backend Server (backend/main.py)...")
    # Start server in background
    server_process = subprocess.Popen(
        [sys.executable, "backend/main.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=os.getcwd()
    )
    
    try:
        # Wait for server startup
        print("    Waiting for server to be ready (45s)...")
        time.sleep(45) 
        
        base_url = "http://localhost:8000/api"
        
        # Check if server is up
        try:
            health = requests.get("http://localhost:8000/")
            print(f"    Health Check: {health.status_code}")
        except:
            print("    Health Check: Failed to connect")

        # 1. Start Stream
        print("\n[*] Testing POST /api/rt/start")
        try:
            resp = requests.post(f"{base_url}/rt/start?headless=false") 
            print(f"    Status: {resp.status_code}")
            print(f"    Response: {resp.json()}")
        except Exception as e:
            print(f"    Failed to start stream: {e}")

        # 2. Poll Data
        print("\n[*] Polling /api/rt/stream for 15 seconds...")
        for i in range(5):
            time.sleep(3)
            try:
                resp = requests.get(f"{base_url}/rt/stream?ticker=BBCA")
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"    [Tick {i+1}] Net Vol: {data.get('net_vol', 0)}, Last Price: {data.get('last_price')}, New Trades: {data.get('new_trades_count')}")
                else:
                    print(f"    [Tick {i+1}] Error {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                print(f"    [Tick {i+1}] Request failed: {e}")

        # 3. Stop Stream
        print("\n[*] Testing POST /api/rt/stop")
        try:
            resp = requests.post(f"{base_url}/rt/stop")
            print(f"    Status: {resp.status_code}")
            print(f"    Response: {resp.json()}")
        except Exception as e:
            print(f"    Failed to stop stream: {e}")

    finally:
        print("\n[*] Killing Server...")
        server_process.kill()
        outs, errs = server_process.communicate()
        print("\n[Server STDOUT]:")
        if outs: print(outs.decode('utf-8', errors='ignore')[-2000:])
        print("\n[Server STDERR]:")
        if errs: print(errs.decode('utf-8', errors='ignore')[-2000:])
        
if __name__ == "__main__":
    run_verification()
