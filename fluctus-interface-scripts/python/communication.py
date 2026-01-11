import serial
import time

ser = None
# ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=1)

def sendStart(band: int, channel: int, device: str) -> bool:
    if band != 0 and band != 1:
        raise ValueError("Band must be 0 or 1")
    
    if not (0 <= channel <= 25):
        raise ValueError("Channel must be between 0 and 25")
    
    if len(device) > 7:
        raise ValueError("Device name must be 7 characters or fewer")


    command = f"start{band}{channel:02}{device}\n"
    
    # Send command to the serial port
    if ser is not None: ser.write(command.encode())
    print(command)

    # Wait for acknowledgment
    if ser is not None: response = ser.readline().decode().strip()
    else: response = input()

    if "startok" in response:
        return True
    return False

def sendPing():
    command = "ping\n"


    if ser is not None: ser.write(command.encode())
    print(command)

    # Start ping timer
    startTime = time.time()

    # Wait for acknowledgment
    if ser is not None: response = ser.readline().decode().strip()
    else: response = input()

    if response.lower() == "fcpong":
        pingTime = (time.time() - startTime) * 1000  # Convert to milliseconds
        print(f"Ping time: {pingTime:.2f} ms")
        return pingTime
    
    else:
        raise RuntimeError("No pong received")


sendStart(1, 5, "Fluctus")  # Example usage
sendPing()  # Example usage