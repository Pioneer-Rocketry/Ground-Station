/**
 * Fluctus Telemetry Parser (Browser Version)
 * Implements protocol version 1.7b
 */

export function parseTelemetry(line) {
  // 1. Trim and Validate
  line = line.trim();
  const pipeIndex = line.indexOf('|');
  let hexPart = line;
  let diagPart = '';
  
  if (pipeIndex !== -1) {
    hexPart = line.substring(0, pipeIndex);
    diagPart = line.substring(pipeIndex + 1);
  }

  // Check for "F B" header
  if (!hexPart.startsWith('F B') && !hexPart.startsWith('FB')) {
     return { type: 'other', raw: line };
  }

  // Strip "F B"
  let cleanHex = hexPart.replace(/\s/g, ''); 
  if (cleanHex.startsWith('FB')) {
      cleanHex = cleanHex.substring(2);
  }

  // Convert hex string to Uint8Array instead of Buffer
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  
  const view = new DataView(bytes.buffer);

  // Fields Mapping (Little Endian)
  try {
    const data = {};
    let offset = 0;

    // Helper to read fields
    const readI8 = () => { const v = view.getInt8(offset); offset+=1; return v; };
    const readU8 = () => { const v = view.getUint8(offset); offset+=1; return v; };
    const readI16 = () => { const v = view.getInt16(offset, true); offset+=2; return v; };
    const readI32 = () => { const v = view.getInt32(offset, true); offset+=4; return v; };
    
    // Custom 24-bit reader (Little Endian)
    const readI24 = () => {
        // DataView doesn't have int24. We read 3 bytes.
        // Byte order Little Endian: [LOW, MID, HIGH]
        const b0 = view.getUint8(offset);
        const b1 = view.getUint8(offset+1);
        const b2 = view.getUint8(offset+2);
        offset += 3;
        
        let val = b0 | (b1 << 8) | (b2 << 16);
        // Sign extend 24th bit
        if ((val & 0x800000) !== 0) {
            val |= 0xFF000000;
        }
        return val;
    };

    data.type = 'telemetry';
    data.raw = line;
    data.diagnostics = diagPart;

    // Field 0: uid (i16) - 2 bytes
    data.uid = readI16();

    // Field 1: fw (i16) - 2 bytes
    data.fw = readI16();

    // Field 2: rx (i8) - 1 byte
    data.packetCount = readI8();

    // Field 3: timeMPU (i32) - 4 bytes - ms
    data.timeMPU = readI32();

    // Field 4: status (i8) - 1 byte
    const statusCode = readI8();
    data.status = getStatusString(statusCode);
    data.statusCode = statusCode;

    // Field 5: altitude (i24) - 3 bytes - m
    data.altitude = readI24();

    // Field 6: speedVert (i16) - 2 bytes - m/s
    data.speedVert = readI16();

    // Field 7: accel (f16) - 2 bytes - m/s^2 (div 10)
    data.accel = readI16() / 10.0;

    // Field 8: angle (ui8) - 1 byte - deg
    data.angle = readU8();

    // Field 9: battVoltage (i16) - 2 bytes - mV
    data.battVoltage = readI16();

    // Field 10: time (f16) - 2 bytes - s (div 10)
    data.flightTime = readI16() / 10.0;

    // Field 11: pyroStates (i8) - 1 byte
    const pyroRaw = readI8();
    data.pyro = decodePyro(pyroRaw);

    // Field 12: logStatus (i8) - 1 byte
    data.logStatus = readI8(); 

    // Field 13: gpsLat (gps) - 4 bytes - div 1,000,000
    data.gpsLat = readI32() / 1000000.0;

    // Field 14: gpsLng (gps) - 4 bytes - div 1,000,000
    data.gpsLng = readI32() / 1000000.0;

    // Field 15: gpsState (i8) - 1 byte
    data.gpsState = readI8();

    // Field 16: warnCode (i8) - 1 byte
    data.warnCode = readI8();

    // Field 17: message (msg 4 bytes)
    const msgId = String.fromCharCode(view.getUint8(offset)); // Byte 0
    // Bytes 1,2,3 are the int24 value
    // Manually read these 3 bytes starting from offset+1
    const m0 = view.getUint8(offset+1);
    const m1 = view.getUint8(offset+2);
    const m2 = view.getUint8(offset+3);
    
    let msgVal = m0 | (m1 << 8) | (m2 << 16);
    if ((msgVal & 0x800000) !== 0) msgVal |= 0xFF000000;
    
    offset += 4;

    data.message = {
        id: msgId,
        value: msgVal,
        decodedValue: msgVal / 10.0 // Assuming same logic
    };
    
    if (msgId === 'A') data.stats = { type: 'Max Altitude', val: msgVal }; 

    // Optional Fields (if bytes remain)
    // view.byteLength is total bytes
    if (view.byteLength >= offset + 4) {
        data.userIn1 = readI16(); 
        data.userIn2 = readI16();
    }

    return data;

  } catch (e) {
    console.error("Error parsing telemetry frame", e);
    return { type: 'error', error: e.message, raw: line };
  }
}

function getStatusString(code) {
    const states = [
        "IDLE", "ARMED", "COUNTDOWN ENGAGED", "WAITING FOR LAUNCH",
        "ASCENT", "DESCENT", "TOUCHDOWN"
    ];
    return states[code] || "UNKNOWN";
}

function decodePyro(byte) {
    const decode = (val) => {
        if(val === 0) return 'DISABLED';
        if(val === 1) return 'CONTINUITY';
        if(val === 3) return 'FIRED';
        return 'UNKNOWN';
    };
    return {
        A: decode(byte & 0x03),
        B: decode((byte >> 2) & 0x03),
        C: decode((byte >> 4) & 0x03)
    };
}
