
import sys
import os
import asyncio
import uvicorn

# Ensure we are in the correct directory (backend)
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

def main():
    """
    Robust server launcher to ensure Windows Event Loop Policy is applied correctly.
    """
    # 1. Force Proactor Policy on Windows (Critical for Playwright)
    if sys.platform == "win32":
        try:
            policy = asyncio.WindowsProactorEventLoopPolicy()
            asyncio.set_event_loop_policy(policy)
            print(f"[*] Applied WindowsProactorEventLoopPolicy: {policy}")
        except Exception as e:
            print(f"[!] Failed to set Proactor policy: {e}")

    # 2. Run Uvicorn with specific loop configuration
    # loop="asyncio" forces Uvicorn to use the standard asyncio event loop
    # (which we just configured to be Proactor).
    # NOTE: "reload=True" is disabled to prevent subprocess spawning issues 
    # that reset the Event Loop Policy to Selector (default).
    print(f"[*] Active Event Loop Policy: {asyncio.get_event_loop_policy()}")
    print("[*] Starting Uvicorn server (port 8000)...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disabled for stability with Windows Proactor Pattern
        loop="asyncio" 
    )

if __name__ == "__main__":
    main()
