from tqdm import tqdm

def dataToEncodedString(uid, fw, rx, timeMPU, status, altitude, 
                        speedVert, accel, angle, battVoltage, time,
                        pyroStates, logStatus, gpsLat, gpsLng, gpsState,
                        warnCode, message, userIn1, userIn2, rssi, snr):
    encodedString = "FB"

    def toHexByte(value, bytes, signed=False):
        return value.to_bytes(bytes, byteorder="little", signed=signed).hex().upper()

    encodedString += toHexByte(uid,                     2, True)
    encodedString += toHexByte(fw,                      2, True)
    encodedString += toHexByte(rx,                      1, True)
    encodedString += toHexByte(timeMPU,                 4, False)
    encodedString += toHexByte(status,                  1, False)
    encodedString += toHexByte(altitude,                3, True)
    encodedString += toHexByte(speedVert,               2, False)
    encodedString += toHexByte(int(accel * 10),         2, False)
    encodedString += toHexByte(angle,                   1, False)
    encodedString += toHexByte(int(battVoltage * 1000), 2, False)
    encodedString += toHexByte(int(time * 10),          2, False)
    encodedString += toHexByte(pyroStates,              1, False)
    encodedString += toHexByte(logStatus,               1, False)
    encodedString += toHexByte(int(gpsLat * 1000000),   4, True)
    encodedString += toHexByte(int(gpsLng * 1000000),   4, True)
    encodedString += toHexByte(gpsState,                1, False)
    encodedString += toHexByte(warnCode,                1, False)
    encodedString += toHexByte(message >> 24,           1, False)
    encodedString += toHexByte(message & 0x00FFFFFF,    3, False)
    if userIn1 is not None and userIn2 is not None:
        encodedString += toHexByte(userIn1, 4)
        encodedString += toHexByte(userIn2, 2)

    encodedString += f"|Grssi{rssi}/Gsnr{snr}"

    return encodedString


if __name__ == "__main__":
    # Read exampleFluctusData.csv line by line and encode each line
    with open("../exampleFluctusData.csv", "r") as f:
        total_lines = sum(1 for _ in f)

    with open("../exampleFluctusData.csv", "r") as f:
        with open("exampleFluctusEncode.txt", "w") as outFile:
            for line in tqdm(f, total=total_lines):
                line = line.strip()
                if line == "":
                    continue

                # Skip header line
                if line.startswith("time (ms)"):
                    continue

                # Its a CSV with the following fields:
                # time (ms),deltaTime (ms),status,baro-altitude (m),dedrck-v-speed (m/s),angle (deg),roll-rate (deg/s),vert-accel (m/s2),accel (m/s2),dedrck-alti (m),baro-speed (m/s),amb-temp (deg c),batt-voltage (mV),P1-state,P2-state,P3-state,analog1 (mV),analog2 (mV),inFreefall,gpsLat,gpsLng,gpsAltMSL,gpsState,gpsSats
                fields = line.split(",")
                if len(fields) < 22:
                    continue

                uid         = 62
                fw          = 262
                timeMPU     = int(fields[0])
                status      = int(fields[2])
                altitude    = int(float(fields[3]))
                speedVert   = int(float(fields[4]) * 100)
                angle       = int(float(fields[5]))
                accel       = float(fields[8])
                battVoltage = float(fields[12]) / 1000.0
                timeSec     = int(fields[0]) / 1000.0
                pyroStates  = (int(fields[13]) & 0x01) | ((int(fields[14]) & 0x01) << 1) | ((int(fields[15]) & 0x01) << 2)
                logStatus   = 0
                gpsLat      = float(fields[19])
                gpsLng      = float(fields[20])
                gpsState    = int(fields[22])
                warnCode    = 0
                message     = 0
                userIn1     = None
                userIn2     = None

                encoded = dataToEncodedString(uid, fw, 0, timeMPU, status, altitude,
                                            speedVert, accel, angle, battVoltage, timeSec,
                                            pyroStates, logStatus, gpsLat, gpsLng, gpsState,
                                            warnCode, message, userIn1, userIn2, -65, 6)
                
                # Save to file
                outFile.write(encoded + "\n")

                # Decode and compare to original values
                from fluctusDecoder import decodeFluctusData
                decoded = decodeFluctusData(encoded)

                assert decoded["uid"] == uid
                assert decoded["fw"] == fw
                assert decoded["timeMPU"] == timeMPU
                assert decoded["status"]["raw"] == status
                assert decoded["altitude"] == altitude
                assert decoded["speedVert"] == speedVert
                assert abs(decoded["accel"] - accel) < 0.1
                assert decoded["angle"] == angle
                assert abs(decoded["battVoltage"] - battVoltage) < 0.01
                assert abs(decoded["time"] - timeSec) < 0.1
                assert decoded["pyroStates"]["raw"] == pyroStates
                assert decoded["logStatus"] == logStatus
                assert abs(decoded["gpsLat"] - gpsLat) < 0.0001
                assert abs(decoded["gpsLng"] - gpsLng) < 0.0001
                assert decoded["gpsState"] == gpsState
                assert decoded["warnCode"] == warnCode
                assert decoded["message"]["raw"] == message