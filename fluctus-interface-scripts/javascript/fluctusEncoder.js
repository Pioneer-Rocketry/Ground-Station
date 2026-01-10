var fluctusDecoder = require('./fluctusDecoder.js');

// Fluctus Encoder
// This encodes telemetry data into a string for the Fluctus Ground Station

function dataToEncodedString(uid, fw, rx, timeMPU, status, altitude, 
                            speedVert, accel, angle, battVoltage, time,
                            pyroStates, logStatus, gpsLat, gpsLng, gpsState,
                            warnCode, message, userIn1, userIn2, rssi, snr) {
    let encodedString = "FB";

    function toHexByte(value, bytes, signed = false) {
        // Handle negative numbers for signed values
        if (signed && value < 0) {
            const max = Math.pow(2, bytes * 8);
            value = max + value;
        }
        
        // Convert to hex bytes in little-endian order
        const hexBytes = [];
        for (let i = 0; i < bytes; i++) {
            hexBytes.push(((value >> (i * 8)) & 0xFF).toString(16).padStart(2, '0').toUpperCase());
        }
        
        return hexBytes.join('');
    }

    encodedString += toHexByte(uid,                     2, true);
    encodedString += toHexByte(fw,                      2, true);
    encodedString += toHexByte(rx,                      1, true);
    encodedString += toHexByte(timeMPU,                 4, false);
    encodedString += toHexByte(status,                  1, false);
    encodedString += toHexByte(altitude,                3, true);
    encodedString += toHexByte(speedVert,               2, false);
    encodedString += toHexByte(Math.floor(accel * 10),  2, false);
    encodedString += toHexByte(angle,                   1, false);
    encodedString += toHexByte(Math.floor(battVoltage * 1000), 2, false);
    encodedString += toHexByte(Math.floor(time * 10),   2, false);
    encodedString += toHexByte(pyroStates,              1, false);
    encodedString += toHexByte(logStatus,               1, false);
    encodedString += toHexByte(Math.floor(gpsLat * 1000000),   4, true);
    encodedString += toHexByte(Math.floor(gpsLng * 1000000),   4, true);
    encodedString += toHexByte(gpsState,                1, false);
    encodedString += toHexByte(warnCode,                1, false);
    encodedString += toHexByte(message >> 24,           1, false);
    encodedString += toHexByte(message & 0x00FFFFFF,    3, false);
    
    if (userIn1 !== null && userIn2 !== null) {
        encodedString += toHexByte(userIn1, 4);
        encodedString += toHexByte(userIn2, 2);
    }

    encodedString += `|Grssi${rssi}/Gsnr${snr}`;

    return encodedString;
}

// Example usage with CSV processing (Node.js environment)
// Uncomment the following code if you want to process CSV files in Node.js

const fs = require('fs');
const readline = require('readline');

async function processCSV() {
    const fileStream = fs.createReadStream('../exampleFluctusData.csv');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputLines = [];

    for await (const line of rl) {
        const trimmedLine = line.trim();
        
        if (trimmedLine === "" || trimmedLine.startsWith("time (ms)")) {
            continue;
        }

        const fields = trimmedLine.split(",");
        if (fields.length < 22) {
            continue;
        }

        const uid         = 62;
        const fw          = 262;
        const timeMPU     = parseInt(fields[0]);
        const status      = parseInt(fields[2]);
        const altitude    = Math.floor(parseFloat(fields[3]));
        const speedVert   = Math.floor(parseFloat(fields[4]) * 100);
        const angle       = Math.floor(parseFloat(fields[5]));
        const accel       = parseFloat(fields[8]);
        const battVoltage = parseFloat(fields[12]) / 1000.0;
        const timeSec     = parseInt(fields[0]) / 1000.0;
        const pyroStates  = (parseInt(fields[13]) & 0x01) | 
                           ((parseInt(fields[14]) & 0x01) << 1) | 
                           ((parseInt(fields[15]) & 0x01) << 2);
        const logStatus   = 0;
        const gpsLat      = parseFloat(fields[19]);
        const gpsLng      = parseFloat(fields[20]);
        const gpsState    = parseInt(fields[22]);
        const warnCode    = 0;
        const message     = 0;
        const userIn1     = null;
        const userIn2     = null;

        const encoded = dataToEncodedString(uid, fw, 0, timeMPU, status, altitude,
                                          speedVert, accel, angle, battVoltage, timeSec,
                                          pyroStates, logStatus, gpsLat, gpsLng, gpsState,
                                          warnCode, message, userIn1, userIn2, -65, 6);
        
        outputLines.push(encoded);

        const decoded = fluctusDecoder.decodeFluctusData(encoded);
        console.assert(         decoded["uid"] === uid,                         `UID mismatch: ${decoded["uid"]} != ${uid}`);
        console.assert(         decoded["fw"] === fw,                           `FW mismatch: ${decoded["fw"]} != ${fw}`);
        console.assert(         decoded["timeMPU"] === timeMPU,                 `timeMPU mismatch: ${decoded["timeMPU"]} != ${timeMPU}`);
        console.assert(         decoded["status"]["raw"] === status,            `status mismatch: ${decoded["status"]["raw"]} != ${status}`);
        console.assert(         decoded["altitude"] === altitude,               `altitude mismatch: ${decoded["altitude"]} != ${altitude}`);
        console.assert(         decoded["speedVert"] === speedVert,             `speedVert mismatch: ${decoded["speedVert"]} != ${speedVert}`);
        console.assert(Math.abs(decoded["accel"] - accel) < 0.1,                `accel mismatch: ${decoded["accel"]} != ${accel}`);
        console.assert(         decoded["angle"] === angle,                     `angle mismatch: ${decoded["angle"]} != ${angle}`);
        console.assert(Math.abs(decoded["battVoltage"] - battVoltage) < 0.01,   `battVoltage mismatch: ${decoded["battVoltage"]} != ${battVoltage}`);
        console.assert(Math.abs(decoded["time"] - timeSec) < 0.1,               `time mismatch: ${decoded["time"]} != ${timeSec}`);
        console.assert(         decoded["pyroStates"]["raw"] == pyroStates,     `pyroStates mismatch: ${decoded["pyroStates"]["raw"]} != ${pyroStates}`);
        console.assert(         decoded["logStatus"] === logStatus,             `logStatus mismatch: ${decoded["logStatus"]} != ${logStatus}`);
        console.assert(Math.abs(decoded["gpsLat"] - gpsLat) < 0.0001,           `gpsLat mismatch: ${decoded["gpsLat"]} != ${gpsLat}`);
        console.assert(Math.abs(decoded["gpsLng"] - gpsLng) < 0.0001,           `gpsLng mismatch: ${decoded["gpsLng"]} != ${gpsLng}`);
        console.assert(         decoded["gpsState"] === gpsState,               `gpsState mismatch: ${decoded["gpsState"]} != ${gpsState}`);
        console.assert(         decoded["warnCode"] === warnCode,               `warnCode mismatch: ${decoded["warnCode"]} != ${warnCode}`);
        console.assert(         decoded["message"]["raw"] === message,          `message mismatch: ${decoded["message"]["raw"]} != ${message}`);

    }

    fs.writeFileSync('exampleFluctusEncode.txt', outputLines.join('\n'));
    console.log(`Processed ${outputLines.length} lines`);
}

processCSV().catch(console.error);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { dataToEncodedString };
}