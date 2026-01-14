import pprint
import re

# Fluctus Decoder
# This takes a string from the Fluctus Ground Station and decodes it into telemetry data


dataString = "FB3E00070100BEDD01000000000000006C00AA89109CFF00650000000000000000000E53000000|Grssi-65/Gsnr6"

def decodeFluctusData(inputStr):
    if (not re.match('FB[a-zA-Z0-9]*\|Grssi-?\d*/Gsnr-?\d*', inputStr)): return None

    data, diagnostics = inputStr.split("|")

    callsign    = data[0]
    packetType  = data[1]

    # Check if the packet is binary data packet
    if (packetType.lower() != "b"): return None

    hexData = data[2:]
    rawByteArray = []
    for index in range(int(len(hexData)/2)):
        rawByteArray.append(hexData[index*2:(index*2)+2])


    # Decode Status
    statusData = int("".join(rawByteArray[9:10]), 16)
    status = {
        "message": "Error",
        "raw": statusData
    }
    if   (statusData == 0): status["message"] = "Idle"
    elif (statusData == 1): status["message"] = "Armed"
    elif (statusData == 2): status["message"] = "Countdown Engaged"
    elif (statusData == 3): status["message"] = "Waiting for Launch"
    elif (statusData == 4): status["message"] = "Ascent"
    elif (statusData == 5): status["message"] = "Descent"
    elif (statusData == 6): status["message"] = "Touchdown"

    # Decode Pyro Channel States    
    pyroData = int("".join(rawByteArray[22:23]), 16)
    pyroAStatus = pyroData & 0b00000011
    pyroBStatus = pyroData & 0b00001100
    pyroCStatus = pyroData & 0b00110000

    pyroStates = {
        "pyroA": "Error",
        "pyroB": "Error",
        "pyroC": "Error",
        "raw": pyroData
    }

    if   (pyroAStatus == 0): pyroStates["pyroA"] = "Disable"
    elif (pyroAStatus == 1): pyroStates["pyroA"] = "Continuity"
    elif (pyroAStatus == 3): pyroStates["pyroA"] = "Enabled / Fired"

    if   (pyroBStatus == 0): pyroStates["pyroB"] = "Disable"
    elif (pyroBStatus == 1): pyroStates["pyroB"] = "Continuity"
    elif (pyroBStatus == 3): pyroStates["pyroB"] = "Enabled / Fired"

    if   (pyroCStatus == 0): pyroStates["pyroC"] = "Disable"
    elif (pyroCStatus == 1): pyroStates["pyroC"] = "Continuity"
    elif (pyroCStatus == 3): pyroStates["pyroC"] = "Enabled / Fired"

    def decodeInt(arr, signed=False, byteorder="little"):
        raw = bytes.fromhex("".join(arr))
        return int.from_bytes(raw, byteorder=byteorder, signed=signed)

    # Decode Message
    messageType = decodeInt(rawByteArray[34])
    messageData = decodeInt(rawByteArray[35:38])
    if messageData & 0x800000: messageData = -messageData

    messageTypeStr = "Error"
    if   (messageType == 65): messageTypeStr = "Max Altitude"
    elif (messageType == 83): messageTypeStr = "Max Speed"
    elif (messageType == 71): messageTypeStr = "Max Acceleration"

    message = {
        messageTypeStr: messageData,
        "raw":decodeInt(rawByteArray[34:38])
    }

    userIn1 = None
    userIn2 = None
    if (len(rawByteArray) > 38):
        userIn1 = int("".join(rawByteArray[38:42]), 16)
        userIn2 = int("".join(rawByteArray[42:44]), 16)

    return {
        "callsign":     callsign,
        "packetType":   packetType,
        "uid":          decodeInt(rawByteArray[0:2], True),       # int16
        "fw":           decodeInt(rawByteArray[2:4], True),       # int16
        "rx":           decodeInt(rawByteArray[4:5], True),       # int8
        "timeMPU":      decodeInt(rawByteArray[5:9]),             # int32
        "status":       status,
        "altitude":     decodeInt(rawByteArray[10:13], True),     # int24
        "speedVert":    decodeInt(rawByteArray[13:15]),           # int16
        "accel":        decodeInt(rawByteArray[15:17]) / 10,      # int to float
        "angle":        decodeInt(rawByteArray[17:18]),           # int8
        "battVoltage":  decodeInt(rawByteArray[18:20]) / 1000,    # mV to V
        "time":         decodeInt(rawByteArray[20:22]) / 10,      # ms to s
        "pyroStates":   pyroStates,
        "logStatus":    decodeInt(rawByteArray[23:24]),           # int8
        "gpsLat":       decodeInt(rawByteArray[24:28], True) / 1000000, # int to GPS
        "gpsLng":       decodeInt(rawByteArray[28:32], True) / 1000000, # int to GPS
        "gpsState":     decodeInt(rawByteArray[32:33]),           # int8
        "warnCode":     decodeInt(rawByteArray[33:34]),           # int8
        "message":      message,
        "userIn1":      userIn1,
        "userIn2":      userIn2,
        "rssi":         re.search(r'rssi([-+]?\d+)', diagnostics).group(1),
        "snr":          re.search(r'snr([-+]?\d+)', diagnostics).group(1),
    }

if __name__ == "__main__":
    decodedData = decodeFluctusData(dataString)
    pprint.pprint(decodedData)