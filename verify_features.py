import sys
import os
import json

# Add current dir to path to allow imports from root
sys.path.append(os.getcwd())

try:
    from backend.db.done_detail_repository import DoneDetailRepository
except ImportError:
    # Try adding backend to path directly if running from inside backend
    sys.path.append(os.path.join(os.getcwd(), 'backend'))
    from db.done_detail_repository import DoneDetailRepository

def test_features():
    print("=== STARTING VERIFICATION ===")
    repo = DoneDetailRepository()
    
    # 1. Check Data
    print("\n[1] Checking Database for Data...")
    try:
        conn = repo._get_conn()
        cursor = conn.execute("SELECT ticker, trade_date, COUNT(*) FROM done_detail_records GROUP BY ticker, trade_date ORDER BY trade_date DESC LIMIT 1")
        row = cursor.fetchone()
        conn.close()
    except Exception as e:
        print(f"❌ DB Connection Error: {e}")
        return
    
    if not row:
        print("❌ No data found in done_detail_records! Please paste data via frontend first.")
        # Try to seed data if needed or just message user
        return

    ticker, date, count = row
    print(f"✅ Found data: {ticker} on {date} ({count} records)")
    
    # 2. Test Combined Analysis (Phase 1-3)
    print(f"\n[2] Testing Combined Analysis for {ticker}...")
    target_broker = None
    try:
        combined = repo.get_combined_analysis(ticker, date, date)
        signal = combined.get('signal', {})
        metrics = combined.get('key_metrics', {})
        impostor = combined.get('impostor_flow', {})
        
        print(f"✅ Combined Analysis Success!")
        print(f"   Signal: {signal.get('direction')} ({signal.get('description')}, {signal.get('confidence')}%)")
        print(f"   Impostor Flow: {impostor.get('net_value', 0):,} ({impostor.get('buy_pct', 0)}% Buy)")
        print(f"   Burst Events: {metrics.get('burst_count')}")
        print(f"   Power Brokers: {len(combined.get('power_brokers', []))}")
        
        if combined.get('power_brokers'):
            target_broker = combined['power_brokers'][0]['broker_code']
            print(f"   -> Found Power Broker: {target_broker}")
            
    except Exception as e:
        print(f"❌ Analysis Failed: {e}")
        import traceback
        traceback.print_exc()
        return

    # 3. Test Broker Profile (Phase 4)
    if not target_broker: 
        target_broker = 'CC' # Default check
        
    print(f"\n[3] Testing Broker Profile for {target_broker}...")
    try:
        profile = repo.get_broker_profile(ticker, target_broker, date, date)
        
        if profile.get('found'):
            print(f"✅ Broker Profile Success!")
            print(f"   Name: {profile.get('name')}")
            print(f"   Net Value: {profile['summary'].get('net_value', 0):,}")
            print(f"   Hourly Stats: {len(profile['hourly_stats'])} hours")
            print(f"   Top Counterparties: {len(profile['counterparties']['top_sellers'])} Sellers, {len(profile['counterparties']['top_buyers'])} Buyers")
            print(f"   Recent Trades: {len(profile['recent_trades'])}")
        else:
            print(f"⚠️ Broker {target_broker} not found in trades (might be inactive).")
            
    except Exception as e:
        print(f"❌ Broker Profile Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_features()
