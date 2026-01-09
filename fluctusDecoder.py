import pprint
import re

# Fluctus Decoder
# This takes a string from the Fluctus Ground Station and decodes it into telemetry data


dataString = "FB3E00070100BEDD01000000000000006C00AA89109CFF00650000000000000000000E53000000|Grssi-65/Gsnr6"

def decodeFluctusData(inputStr):
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
    statusData = int("".join(rawByteArray[9:10][::-1]), 16)
    status = "Error"
    if   (statusData == 0): status = "Idle"
    elif (statusData == 1): status = "Armed"
    elif (statusData == 2): status = "Countdown Engaged"
    elif (statusData == 3): status = "Waiting for Launch"
    elif (statusData == 4): status = "Ascent"
    elif (statusData == 5): status = "Descent"
    elif (statusData == 6): status = "Touchdown"

    # Decode Pyro Channel States    
    pyroData = int("".join(rawByteArray[22:23][::-1]), 16)
    pyroAStatus = pyroData & 0b00000011
    pyroBStatus = pyroData & 0b00001100
    pyroCStatus = pyroData & 0b00110000

    pyroStates = {
        "pyroA": "Error",
        "pyroB": "Error",
        "pyroC": "Error"
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

    # Decode Message
    messageType = int("".join(rawByteArray[34]), 16)
    messageData = int("".join(rawByteArray[35:38][::-1]), 16)
    if messageData & 0x800000: messageData = -messageData

    messageTypeStr = "Error"
    if   (messageType == 65): messageTypeStr = "Max Altitude"
    elif (messageType == 83): messageTypeStr = "Max Speed"
    elif (messageType == 71): messageTypeStr = "Max Acceleration"

    message = {
        messageTypeStr: messageData
    }

    userIn1 = None
    userIn2 = None
    if (len(rawByteArray) > 38):
        userIn1 = int("".join(rawByteArray[38:42][::-1]), 16)
        userIn2 = int("".join(rawByteArray[42:44][::-1]), 16)

    return {
        "callsign":     callsign,
        "packetType":   packetType,
        "uid":          int("".join(rawByteArray[0:2][::-1]),   16),            # int16
        "fw":           int("".join(rawByteArray[2:4][::-1]),   16),            # int16
        "rx":           int("".join(rawByteArray[4:5][::-1]),   16),            # int8
        "timeMPU":      int("".join(rawByteArray[5:9][::-1]),   16),            # int32
        "status":       status,
        "altitude":     int("".join(rawByteArray[10:13][::-1]), 16),            # int24
        "speedVert":    int("".join(rawByteArray[13:15][::-1]), 16),            # int16
        "accel":        int("".join(rawByteArray[15:17][::-1]), 16) / 10,       # int to float
        "angle":        int("".join(rawByteArray[17:18][::-1]), 16),            # int8
        "battVoltage":  int("".join(rawByteArray[18:20][::-1]), 16) / 1000,     # mV to V
        "time":         int("".join(rawByteArray[20:22][::-1]), 16) / 1000,     # ms to s
        "pyroStates":   pyroStates,
        "logStatus":    int("".join(rawByteArray[23:24][::-1]), 16),            # int8
        "gpsLat":       int("".join(rawByteArray[24:28][::-1]), 16) / 1000000,  # int to GPS
        "gpsLng":       int("".join(rawByteArray[28:32][::-1]), 16) / 1000000,  # int to GPS
        "gpsState":     int("".join(rawByteArray[32:33][::-1]), 16),            # int8
        "warnCode":     int("".join(rawByteArray[33:34][::-1]), 16),            # int8
        "message":      message,
        "userIn1":      userIn1,
        "userIn2":      userIn2,
        "rssi":         re.search(r'rssi([-+]?\d+)', diagnostics).group(1),
        "snr":          re.search(r'snr([-+]?\d+)', diagnostics).group(1),
    }

if __name__ == "__main__":
    decodedData = decodeFluctusData(dataString)
    pprint.pprint(decodedData)