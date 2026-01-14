import paho.mqtt.client as mqtt
import serial
import time
import ssl
import re

import os
from dotenv import load_dotenv
load_dotenv() 

from python.fluctusDecoder import decodeFluctusData

MQTT_TOPIC = "telemetry/fluctus"

def on_connect(client, userdata, flags, rc):
    if rc == 0: print("Connected to MQTT broker")
    else:       print(f"Failed to connect, rc={rc}")

HARDWARE = False

init = False
command = None

startRegex = re.compile('start\d\d\d[A-Za-z]{7}')

def on_message(client, userdata, msg):
    global init, command

    payload = msg.payload.decode()
    print(f"{msg.topic} - {payload}")

    if startRegex.match(payload):
        command = startRegex.search(payload)[0]
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

    if HARDWARE:
        # Open example file for testing
        while True:
            if init:
                file = open("exampleFluctusEncode.txt", "r")
                # Read a line
                for line in file:
                    # Decode it
                    decoded_data = decodeFluctusData(line)

                    if decoded_data is not None:
                        # Send each field as a separate MQTT thread
                        for key, value in decoded_data.items():
                            if key == "status" or key == "pyroStates" or key == "message":
                                value = value["raw"]

                            client.publish(f"{MQTT_TOPIC}/{key}", value)
                        time.sleep(1/50)
                        
                    if command is not None:
                        print(command)

                file.close()
                init = False

    else:
        ser = serial.Serial('/dev/ttyACM3', 9600, timeout=1)
        while ser.is_open:
            line = ser.readline().decode('utf-8').strip()
            print(line)
            decoded_data = decodeFluctusData(line)

            if decoded_data is not None:            
                # Send each field as a separate MQTT thread
                for key, value in decoded_data.items():
                    if key == "status" or key == "pyroStates" or key == "message":
                        value = value["raw"]

                    client.publish(f"{MQTT_TOPIC}/{key}", value)

            if command is not None:
                ser.write((command + "\n").encode())
                command = None


    client.loop_stop()
    client.disconnect()