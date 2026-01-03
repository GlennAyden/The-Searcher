import json
import pprint

def inspect():
    with open('raw_ws_dump.json', 'r') as f:
        frames = json.load(f)
    
    api_frames = [x for x in frames if x.get('dir') == 'API']
    
    print(f"Found {len(api_frames)} API frames.")
    for i, frame in enumerate(api_frames):
        print(f"\n--- API FRAME {i+1} ---")
        try:
            data = frame.get('data')
            if isinstance(data, str):
                data = json.loads(data)
            
            print(f"URL: {frame.get('url')}")
            if 'data' in data and isinstance(data['data'], list):
                print("Sample Item from data['data']:")
                pprint.pprint(data['data'][0])
            elif 'result' in data and isinstance(data['result'], list):
                print("Sample Item from data['result']:")
                pprint.pprint(data['result'][0])
            elif 'data' in data and 'result' in data['data']:
                 print("Sample Item from data['data']['result']:")
                 pprint.pprint(data['data']['result'][0])
            else:
                print("Structure unknown, printing keys:")
                pprint.pprint(data.keys())
        except Exception as e:
            print(f"Error printing data: {e}")

if __name__ == "__main__":
    inspect()
