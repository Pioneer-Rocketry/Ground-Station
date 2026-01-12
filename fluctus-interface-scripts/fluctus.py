import paho.mqtt.client as mqtt
import serial
import time
import ssl

import os
from dotenv import load_dotenv
load_dotenv() 

from python.fluctusDecoder import decodeFluctusData

MQTT_TOPIC = "telemetry/fluctus"

def on_connect(client, userdata, flags, rc):
    if rc == 0: print("Connected to MQTT broker")
    else:       print(f"Failed to connect, rc={rc}")

init = False

def on_message(client, userdata, msg):
    global init

    payload = msg.payload.decode()

    if "start" in payload:
        init = True

    elif "arm" in payload:
        print("ARMING")

    elif "ping" in payload:
        print("pong")

if __name__ == "__main__":
    client = mqtt.Client(client_id="fluctus_telemetry", transport="websockets")
    client.on_connect = on_connect
    client.on_message = on_message
    client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)
    client.username_pw_set(os.getenv("USERNAME"), os.getenv("PASSWORD"))
    client.connect(os.getenv("MQTT_BROKER"), int(os.getenv("MQTT_PORT")), keepalive=60)
    client.loop_start()

    client.subscribe(f"{MQTT_TOPIC}/control")
    print(f"{MQTT_TOPIC}/control")

    # ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=1)
    # while ser.is_open:

    # Open example file for testing
    while True:
        if init:
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

                    client.publish(f"{MQTT_TOPIC}/{key}", value)
                    # print(f"{MQTT_TOPIC}{key} -> {value}")
                time.sleep(1/50)

            file.close()
            init = False

    client.loop_stop()
    client.disconnect()