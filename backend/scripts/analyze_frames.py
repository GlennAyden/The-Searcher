import json
import struct
from collections import Counter

def decode_double(hex_str):
    try:
        return struct.unpack('<d', bytes.fromhex(hex_str))[0]
    except:
        return None

def decode_varint(data, pos):
    res = 0
    shift = 0
    while True:
        b = data[pos]
        res |= (b & 0x7f) << shift
        pos += 1
        if not (b & 0x80):
            return res, pos
        shift += 7

def analyze_proto(hex_data):
    if len(hex_data) % 2 != 0:
        hex_data = hex_data[:-1]
    
    try:
        data = bytes.fromhex(hex_data)
    except ValueError:
        return {}

    pos = 0
    fields = {}
    while pos < len(data):
        try:
            tag_raw, pos = decode_varint(data, pos)
            field_num = tag_raw >> 3
            wire_type = tag_raw & 0x07
            
            if wire_type == 0: # Varint
                if pos >= len(data): break
                val, pos = decode_varint(data, pos)
                fields[field_num] = val
            elif wire_type == 1: # Fixed64
                if pos + 8 > len(data): break
                val = struct.unpack('<d', data[pos:pos+8])[0]
                fields[field_num] = val
                pos += 8
            elif wire_type == 2: # Length-delimited
                if pos >= len(data): break
                length, pos = decode_varint(data, pos)
                if pos + length > len(data): break
                val = data[pos:pos+length]
                # Try to decode as string
                try:
                    fields[field_num] = val.decode('utf-8')
                except:
                    fields[field_num] = val.hex()
                pos += length
            elif wire_type == 5: # Fixed32
                if pos + 4 > len(data): break
                val = struct.unpack('<f', data[pos:pos+4])[0]
                fields[field_num] = val
                pos += 4
            else:
                break # Unknown wire type
        except Exception as e:
            print(f"Error at pos {pos}: {e}")
            break
    return fields

def analyze():
    try:
        with open('raw_ws_dump.json', 'r') as f:
            frames = json.load(f)
    except FileNotFoundError:
        print("raw_ws_dump.json not found")
        return

    ticker_data = {}
    subscriptions = []

    for i, item in enumerate(frames):
        direction = item.get("dir", "IN")
        content = item.get("data", "")
        
        if direction == "OUT":
            if "subscribe" in content.lower() or "sub" in content.lower():
                subscriptions.append(content)
            continue

        if not isinstance(content, str) or not content.startswith('BINARY:'):
            continue
        
        hex_data = content[7:]
        idx = hex_data.find('0a')
        if idx == -1: continue
        
        proto_hex = hex_data[idx:]
        fields = analyze_proto(proto_hex)
        
        if i < 10:
            print(f"DEBUG [{i}] hex:{hex_data[:20]} idx:{idx} fields:{fields}")

        if 1 in fields and isinstance(fields[1], str):
            ticker = fields[1]
            if ticker not in ticker_data:
                ticker_data[ticker] = []
            ticker_data[ticker].append(fields)

    print(f"\nSubscriptions Found: {len(subscriptions)}")
    for sub in subscriptions[:5]:
        print(f"  {sub}")

    print(f"\nTotal Tickers Found: {len(ticker_data)}")
    for ticker, data in ticker_data.items():
        print(f"  {ticker}: {len(data)}")

    print("\nDetailed Analysis for GOTO:")
    if 'GOTO' in ticker_data:
        # Sort by number of fields to find the most "informative" ones
        sorted_goto = sorted(ticker_data['GOTO'], key=lambda x: len(x), reverse=True)
        for i, fields in enumerate(sorted_goto[:10]):
            print(f"  [{i}] Fields: {fields}")

    print("\n--- OUTGOING FRAMES (First 10) ---")
    out_count = 0
    for item in frames:
        if item.get("dir") == "OUT":
            print(f"  {item.get('data')[:100]}...")
            out_count += 1
            if out_count >= 10: break

    print("\n--- TEXT BASED FRAMES ANALYSIS (UNFILTERED) ---")
    prefixes = Counter()
    samples = {}
    
    for item in frames:
        if item.get("dir") == "OUT": continue
        content = item.get("data", "")
        if not isinstance(content, str) or not content.startswith('BINARY:'):
            continue
            
        hex_data = content[7:]
        idx = hex_data.find('0a')
        if idx == -1: continue
        
        proto_hex = hex_data[idx:]
        fields = analyze_proto(proto_hex)
        
        # Check ALL fields for string data with pipe
        for f_id, val in fields.items():
            if isinstance(val, str) and '|' in val:
                txt = val
                prefix = txt.split('|')[0]
                prefixes[prefix] += 1
                if prefix not in samples:
                    samples[prefix] = []
                if len(samples[prefix]) < 3:
                    samples[prefix].append(txt)

    print("\nPrefix Counts (Global Unfiltered):")
    for p, c in prefixes.most_common():
        print(f"  {p}: {c}")

    print("\nSamples by Prefix:")
    for p, s_list in samples.items():
        print(f"\n  Prefix: {p}")
        for s in s_list:
            print(f"    {s[:150]}...")

if __name__ == "__main__":
    analyze()
