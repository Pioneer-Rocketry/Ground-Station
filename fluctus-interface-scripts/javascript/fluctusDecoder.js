// Fluctus Decoder
// This takes a string from the Fluctus Ground Station and decodes it into telemetry data

const dataString = "FB3E00070100BEDD01000000000000006C00AA89109CFF00650000000000000000000E53000000|Grssi-65/Gsnr6";

function decodeFluctusData(inputStr) {
    const [data, diagnostics] = inputStr.split("|");

    const callsign = data[0];
    const packetType = data[1];

    // Check if the packet is binary data packet
    if (packetType.toLowerCase() !== "b") return null;

    const hexData = data.slice(2);
    const rawByteArray = [];
    for (let index = 0; index < Math.floor(hexData.length / 2); index++) {
        rawByteArray.push(hexData.slice(index * 2, (index * 2) + 2));
    }

    // Decode Status
    const statusData = parseInt(rawByteArray.slice(9, 10).join(""), 16);
    const status = {
        message: "Error",
        raw: statusData
    };
    if      (statusData === 0) status.message = "Idle";
    else if (statusData === 1) status.message = "Armed";
    else if (statusData === 2) status.message = "Countdown Engaged";
    else if (statusData === 3) status.message = "Waiting for Launch";
    else if (statusData === 4) status.message = "Ascent";
    else if (statusData === 5) status.message = "Descent";
    else if (statusData === 6) status.message = "Touchdown";

    // Decode Pyro Channel States
    const pyroData = parseInt(rawByteArray.slice(22, 23).join(""), 16);
    const pyroAStatus = pyroData & 0b00000011;
    const pyroBStatus = pyroData & 0b00001100;
    const pyroCStatus = pyroData & 0b00110000;

    const pyroStates = {
        pyroA: "Error",
        pyroB: "Error",
        pyroC: "Error",
        raw: pyroData
    };

    if      (pyroAStatus === 0) pyroStates.pyroA = "Disable";
    else if (pyroAStatus === 1) pyroStates.pyroA = "Continuity";
    else if (pyroAStatus === 3) pyroStates.pyroA = "Enabled / Fired";

    if      (pyroBStatus === 0) pyroStates.pyroB = "Disable";
    else if (pyroBStatus === 1) pyroStates.pyroB = "Continuity";
    else if (pyroBStatus === 3) pyroStates.pyroB = "Enabled / Fired";

    if      (pyroCStatus === 0) pyroStates.pyroC = "Disable";
    else if (pyroCStatus === 1) pyroStates.pyroC = "Continuity";
    else if (pyroCStatus === 3) pyroStates.pyroC = "Enabled / Fired";

    function decodeInt(arr, signed = false, byteorder = "little") {
        const hexStr = arr.join("");
        const bytes = [];
        for (let i = 0; i < hexStr.length; i += 2) {
            bytes.push(parseInt(hexStr.substr(i, 2), 16));
        }
        
        if (byteorder === "big") {
            bytes.reverse();
        }
        
        let value = 0;
        for (let i = 0; i < bytes.length; i++) {
            value |= bytes[i] << (8 * i);
        }
        
        if (signed) {
            const bits = bytes.length * 8;
            const max = Math.pow(2, bits);
            if (value >= max / 2) {
                value -= max;
            }
        }
        
        return value;
    }

    // Decode Message
    const messageType = decodeInt(rawByteArray.slice(34, 35));
    let messageData = decodeInt(rawByteArray.slice(35, 38));
    if (messageData & 0x800000) messageData = -messageData;

    let messageTypeStr = "Error";
    if      (messageType === 65) messageTypeStr = "Max Altitude";
    else if (messageType === 83) messageTypeStr = "Max Speed";
    else if (messageType === 71) messageTypeStr = "Max Acceleration";

    const message = {
        [messageTypeStr]: messageData,
        raw: decodeInt(rawByteArray.slice(34, 38))
    };

    let userIn1 = null;
    let userIn2 = null;
    if (rawByteArray.length > 38) {
        userIn1 = parseInt(rawByteArray.slice(38, 42).reverse().join(""), 16);
        userIn2 = parseInt(rawByteArray.slice(42, 44).reverse().join(""), 16);
    }

    const rssiMatch = diagnostics.match(/rssi([-+]?\d+)/);
    const snrMatch = diagnostics.match(/snr([-+]?\d+)/);

    return {
        callsign:     callsign,
        packetType:   packetType,
        uid:          decodeInt(rawByteArray.slice(0, 2), true),        // int16
        fw:           decodeInt(rawByteArray.slice(2, 4), true),        // int16
        rx:           decodeInt(rawByteArray.slice(4, 5), true),        // int8
        timeMPU:      decodeInt(rawByteArray.slice(5, 9)),              // int32
        status:       status,
        altitude:     decodeInt(rawByteArray.slice(10, 13), true),      // int24
        speedVert:    decodeInt(rawByteArray.slice(13, 15)),            // int16
        accel:        decodeInt(rawByteArray.slice(15, 17)) / 10,       // int to float
        angle:        decodeInt(rawByteArray.slice(17, 18)),            // int8
        battVoltage:  decodeInt(rawByteArray.slice(18, 20)) / 1000,     // mV to V
        time:         decodeInt(rawByteArray.slice(20, 22)) / 10,       // ms to s
        pyroStates:   pyroStates,
        logStatus:    decodeInt(rawByteArray.slice(23, 24)),            // int8
        gpsLat:       decodeInt(rawByteArray.slice(24, 28), true) / 1000000,  // int to GPS
        gpsLng:       decodeInt(rawByteArray.slice(28, 32), true) / 1000000,  // int to GPS
        gpsState:     decodeInt(rawByteArray.slice(32, 33)),            // int8
        warnCode:     decodeInt(rawByteArray.slice(33, 34)),            // int8
        message:      message,
        userIn1:      userIn1,
        userIn2:      userIn2,
        rssi:         rssiMatch ? rssiMatch[1] : null,
        snr:          snrMatch ? snrMatch[1] : null,
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decodeFluctusData };
} else {
    // Example usage
    const decodedData = decodeFluctusData(dataString);
    console.log(decodedData);
}