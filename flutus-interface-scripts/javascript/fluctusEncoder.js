const fs = require("fs");

/**
 * Convert a number to a little-endian hex string
 */
function toHexByte(value, bytes, signed = false) {
    const buffer = Buffer.alloc(bytes);

    if (signed) {
        buffer.writeIntLE(value, 0, bytes);
    } else {
        buffer.writeUIntLE(value, 0, bytes);
    }

    return buffer.toString("hex").toUpperCase();
}

function dataToEncodedString(
    uid, fw, rx, timeMPU, status, altitude,
    speedVert, accel, angle, battVoltage, time,
    pyroStates, logStatus, gpsLat, gpsLng, gpsState,
    warnCode, message, userIn1, userIn2, rssi, snr
) {
    let encodedString = "FB";

    encodedString += toHexByte(uid,                     2, true);
    encodedString += toHexByte(fw,                      2, true);
    encodedString += toHexByte(rx,                      1, true);
    encodedString += toHexByte(timeMPU,                 4, false);
    encodedString += toHexByte(status,                  1, false);
    encodedString += toHexByte(altitude,                3, true);
    encodedString += toHexByte(speedVert,               2, false);
    encodedString += toHexByte(Math.trunc(accel * 10),  2, false);
    encodedString += toHexByte(angle,                   1, false);
    encodedString += toHexByte(Math.trunc(battVoltage * 1000), 2, false);
    encodedString += toHexByte(Math.trunc(time * 10),   2, false);
    encodedString += toHexByte(pyroStates,              1, false);
    encodedString += toHexByte(logStatus,               1, false);
    encodedString += toHexByte(Math.trunc(gpsLat * 1_000_000), 4, true);
    encodedString += toHexByte(Math.trunc(gpsLng * 1_000_000), 4, true);
    encodedString += toHexByte(gpsState,                1, false);
    encodedString += toHexByte(warnCode,                1, false);
    encodedString += toHexByte((message >> 24) & 0xFF,  1, false);
    encodedString += toHexByte(message & 0x00FFFFFF,    3, false);

    if (userIn1 !== null && userIn2 !== null) {
        encodedString += toHexByte(userIn1, 4, false);
        encodedString += toHexByte(userIn2, 2, false);
    }

    encodedString += `|Grssi${rssi}/Gsnr${snr}`;

    return encodedString;
}

/* -------------------------
   Main CSV processing
-------------------------- */

const lines = fs.readFileSync("../exampleFluctusData.csv", "utf8").split("\n");

for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("time (ms)")) continue;

    const fields = trimmed.split(",");
    if (fields.length < 22) continue;

    const uid         = 62;
    const fw          = 262;
    const timeMPU     = parseInt(fields[0], 10);
    const status      = parseInt(fields[2], 10);
    const altitude    = Math.trunc(parseFloat(fields[3]));
    const speedVert   = Math.trunc(parseFloat(fields[4]) * 100);
    const angle       = Math.trunc(parseFloat(fields[5]));
    const accel       = parseFloat(fields[8]);
    const battVoltage = parseFloat(fields[12]) / 1000.0;
    const timeSec     = parseInt(fields[0], 10) / 1000.0;

    const pyroStates =
        (parseInt(fields[13]) & 0x01) |
        ((parseInt(fields[14]) & 0x01) << 1) |
        ((parseInt(fields[15]) & 0x01) << 2);

    const logStatus   = 0;
    const gpsLat      = parseFloat(fields[19]);
    const gpsLng      = parseFloat(fields[20]);
    const gpsState    = parseInt(fields[22], 10);
    const warnCode    = 0;
    const message     = 0;
    const userIn1     = null;
    const userIn2     = null;

    const encoded = dataToEncodedString(
        uid, fw, 0, timeMPU, status, altitude,
        speedVert, accel, angle, battVoltage, timeSec,
        pyroStates, logStatus, gpsLat, gpsLng, gpsState,
        warnCode, message, userIn1, userIn2, -65, 6
    );

    fs.appendFileSync("exampleFluctusEncode.txt", encoded + "\n");
}
