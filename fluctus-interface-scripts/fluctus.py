import paho.mqtt.client as mqtt
import argparse
import serial
import time
import ssl
import re

import os
from dotenv import load_dotenv
load_dotenv() 

from python.fluctusDecoder import decodeFluctusData

# File args
parser = argparse.ArgumentParser()
parser.add_argument("comport", help='The serial port that the device is conencted to')
parser.add_argument('--name', default='fluctus', help='Devices name')
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

startRegex = re.compile('start\d\d\d[A-Za-z]{7}')

# MQTT Callbacks
def onConnect(client, userdata, flags, rc):
    if rc == 0: print("Connected to MQTT broker")
    else:       print(f"Failed to connect, rc={rc}")

def onMessage(client, userdata, msg):
    global run, command

    topic = msg.topic
    payload = msg.payload.decode()

    if topic == MQTT_CONTROL_TOPIC:
        if startRegex.match(payload):
            command = startRegex.search(payload)[0]
            run = True

        elif "arm" in payload:
            print("ARMING")

        elif "ping" in payload:
            print("pong")

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

client.subscribe(f"{MQTT_TOPIC}/control")
client.subscribe(f"{MQTT_BASE}/devices")

if not HARDWARE:
    while True:
        if run:
            file = open(args.telemetryFile, "r")
            for line in file:
                decodedData = decodeFluctusData(line)
                sendData(client, decodedData)
                time.sleep(1/50)
                    
                if command is not None:
                    print(command)
                    command = None

            file.close()
            run = False

else:
    ser = serial.Serial(args.comport, timeout=1)

    while ser.is_open:
        line = ser.readline().decode('utf-8').strip()
        decodedData = decodeFluctusData(line)
        sendData(client, decodedData)

        if command is not None:
            ser.write((command + "\n").encode())
            command = None

client.loop_stop()
client.disconnect()