import struct

def decode_varint(data, pos):
    res = 0
    shift = 0
    while pos < len(data):
        b = data[pos]
        res |= (b & 0x7f) << shift
        pos += 1
        if not (b & 0x80):
            return res, pos
        shift += 7
    return res, pos

def analyze_proto(hex_data):
    data = bytes.fromhex(hex_data)
    pos = 0
    fields = {}
    while pos < len(data):
        print(f"  Loop: pos={pos}/{len(data)}")
        tag_raw, pos = decode_varint(data, pos)
        field_num = tag_raw >> 3
        wire_type = tag_raw & 0x07
        print(f"    Tag: {tag_raw} (Field: {field_num}, Wire: {wire_type})")
        
        if wire_type == 0: # Varint
            val, pos = decode_varint(data, pos)
            fields[field_num] = val
            print(f"    Varint: {val}")
        elif wire_type == 1: # Fixed64
            val = struct.unpack('<d', data[pos:pos+8])[0]
            fields[field_num] = val
            pos += 8
            print(f"    Fixed64: {val}")
        elif wire_type == 2: # Length-delimited
            length, pos = decode_varint(data, pos)
            val = data[pos:pos+length]
            try:
                fields[field_num] = val.decode('utf-8')
            except:
                fields[field_num] = val.hex()
            pos += length
            print(f"    String/Bytes: {fields[field_num]}")
        else:
            print(f"    Unsupported Wire Type: {wire_type}")
            break
    return fields

# Test with a known string
test_hex = "0a0449485347110000000000407a40"
print(f"Analyzing {test_hex}")
f = analyze_proto(test_hex)
print(f"Result: {f}")
