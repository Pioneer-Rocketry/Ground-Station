import paho.mqtt.client as mqtt
import argparse
import serial
import json
import time
import ssl

import os
from dotenv import load_dotenv
load_dotenv()

# File args
parser = argparse.ArgumentParser()
parser.add_argument("comport", help='The serial port that the device is conencted to')
parser.add_argument('--name', default='ptrTracker', help='Devices name')
parser.add_argument('--mqttTopicBase', default='telemetry', help='The base MQTT topic')
parser.add_argument('--telemetryFile', default=None, help='The path to a file containing test packets')

args = parser.parse_args()

# MQTT topic paths
MQTT_BASE   = args.mqttTopicBase
DEVICE_NAME = args.name
MQTT_TOPIC  = f"{MQTT_BASE}/{DEVICE_NAME}"
MQTT_CONTROL_TOPIC  = f"{MQTT_BASE}/{DEVICE_NAME}/control"

HARDWARE = args.telemetryFile is None

run = False
command = None

# MQTT Callbacks
def onConnect(client, userdata, flags, rc):
    if rc == 0: print("Connected to MQTT broker")
    else:       print(f"Failed to connect, rc={rc}")

def onMessage(client, userdata, msg):
    global run, command

    topic = msg.topic
    payload = msg.payload.decode()

    if topic == MQTT_CONTROL_TOPIC:
        pass

    elif topic == f"{MQTT_BASE}/devices":
        if "list" in payload:
            client.publish(f"{MQTT_BASE}/devices", DEVICE_NAME)

def sendData(client, data):
    if data is not None:
        # Send each field as a separate MQTT thread
        for key, value in data.items():
            if key == "status" or key == "pyroStates" or key == "message":
                value = value["raw"]

            client.publish(f"{MQTT_TOPIC}/{key}", value)

client = mqtt.Client(client_id=f"{DEVICE_NAME}_telemetry", transport="websockets")
client.on_connect = onConnect
client.on_message = onMessage
client.tls_set(cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLS_CLIENT)
client.username_pw_set(os.getenv("USERNAME"), os.getenv("PASSWORD"))
client.connect(os.getenv("MQTT_BROKER"), int(os.getenv("MQTT_PORT")), keepalive=60)
client.loop_start()


if not HARDWARE:
    while True:
        file = open("examplePTR.txt", "r")
        for line in file:
            decodedData = json.loads(line)
            sendData(client, decodedData)

            time.sleep(1)

        file.close()
        run = False
else:
    ser = serial.Serial(args.comport, timeout=1)

    while ser.is_open:
        line = ser.readline().decode('utf-8').strip()
        decodedData = json.loads(line)
        sendData(client, decodedData)

        if command is not None:
            ser.write((command + "\n").encode())
            command = None

client.loop_stop()
client.disconnect()