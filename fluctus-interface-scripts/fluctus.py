import paho.mqtt.client as mqtt
import serial
import time

import os
from dotenv import load_dotenv
load_dotenv() 

from python.fluctusDecoder import decodeFluctusData

MQTT_TOPIC = "telemetry/fluctus/"

def on_connect(client, userdata, flags, rc):
    if rc == 0: print("Connected to MQTT broker")
    else:       print(f"Failed to connect, rc={rc}")

if __name__ == "__main__":
    client = mqtt.Client(client_id="fluctus_telemetry", transport="websockets")
    client.on_connect = on_connect
    client.username_pw_set(os.getenv("USERNAME"), os.getenv("PASSWORD"))
    client.connect(os.getenv("MQTT_BROKER"), int(os.getenv("MQTT_PORT")), keepalive=60)
    client.loop_start()

    # ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=1)
    # while ser.is_open:

    # Open example file for testing
    while True:
        file = open("exampleFluctusEncode.txt", "r")
        # Read a line
        # line = ser.readline().decode('utf-8').strip()
        for line in file:
        # if line:
            # Decode it
            decoded_data = decodeFluctusData(line)
            # Send each field as a separate MQTT thread
            for key, value in decoded_data.items():
                if key == "status" or key == "pyroStates" or key == "message":
                    value = value["raw"]

                client.publish(f"{MQTT_TOPIC}{key}", value)
                print(f"{MQTT_TOPIC}{key} -> {value}")
            time.sleep(1)

        file.close()

    client.loop_stop()
    client.disconnect()