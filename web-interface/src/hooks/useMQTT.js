
import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useTelemetry } from '../contexts/TelemetryContext';
import { parseTelemetry, getStatusString, decodePyro } from '../lib/parser';
import { ConstructionIcon } from 'lucide-react';

export function useMQTT() {
    const { updateTelemetry, addLog, setConnectionStatus, setIsHost, clearSources, updatePath } = useTelemetry();
    const [client, setClient] = useState(null);
    const [status, setStatus] = useState('Disconnected');
    const [devices, setDevices] = useState([]);
    const [gpsLocations, setGPSLocation] = useState({});

    const [baseTopic, setTopic] = useState(null);
    
    const connectMQTT = (url, username, password, topic) => {
        setConnectionStatus('Connecting MQTT...');
        addLog(`Connecting to MQTT broker at ${url} on topic ${topic}...`);

        // Force WS protocol if not specified, since browser can only do WS/WSS
        // But users might verify "ws://..."

        setTopic(topic.replace('/#', ''));

        const options = {
            username,
            password,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
        };

        try {
            const mqttClient = mqtt.connect(url, options);

            mqttClient.on('connect', () => {
                setConnectionStatus('MQTT Connected');
                addLog('MQTT Connected');
                setStatus('Connected');
                // Assume we are the source if we are connecting to MQTT
                setIsHost(true);

                mqttClient.subscribe(topic, (err) => {
                    if (err) {
                        addLog(`Failed to subscribe to ${topic}: ${err.message}`, 'error');
                    } else {
                        addLog(`Subscribed to topic: ${topic}`);
                    }
                });

                mqttClient.subscribe("telemetry/devices", (err) => {
                    if (err) {
                        addLog(`Failed to subscribe to ${topic}: ${err.message}`, 'error');
                    } else {
                        addLog(`Subscribed to topic: ${topic}`);
                    }
                });

                mqttClient.publish("telemetry/devices", "list");
            });

            mqttClient.on('message', (topic, message) => {
                const msgStr = message.toString();

                if (topic == "telemetry/devices") {
                    if (msgStr == "list") return;

                    if (!devices.includes(msgStr)) {
                        devices.push(msgStr);
                        console.log(`New Device ${msgStr}`);

                        gpsLocations[msgStr] = {
                            "latitude": 0.0000,
                            "longitude": 0.0000,
                            "alt": 0.0,
                        }
                    }

                    return;
                }

                // 1. Try to parse as JSON (Object or Scalar)
                let parsedJSON = undefined;
                try {
                    parsedJSON = JSON.parse(msgStr);
                } catch (e) {
                    // Not JSON
                }

                let device = topic.split('/')[1];

                if (!devices.includes(device)) {
                    devices.push(device);
                    console.log(`New Device ${device}`);

                    gpsLocations[device] = {
                        "latitude": 0.0000,
                        "longitude": 0.0000,
                        "alt": 0.0,
                    }
                }

                let dataType = topic.split('/')[2];
                
                // If the topic ends with a known key, update that key
                let keyToUpdate = null
                let valToUpdate = (parsedJSON !== undefined) ? parsedJSON : msgStr;

                if (device == "fluctus") {
                    switch (dataType) {
                        case 'speedVert':   keyToUpdate = 'speedVert'; break;
                        case 'accel':       keyToUpdate = 'accel'; break;
                        case 'battVoltage': keyToUpdate = 'battVoltage'; break;
                        case 'time':        keyToUpdate = 'flightTime'; break; // Mapping "time" -> "flightTime"
                        case 'gpsState':    keyToUpdate = 'gpsState'; break;
                        case 'angle':       keyToUpdate = 'angle'; break;

                        case 'altitude':
                            keyToUpdate = 'altitude';
                            gpsLocations[device]["altitude"] = valToUpdate;
                            break;

                        case 'gpsLat':
                            keyToUpdate = 'latitude';
                            gpsLocations[device]["latitude"] = valToUpdate;
                            break;
                        
                        case 'gpsLng': 
                            keyToUpdate = 'longitude';
                            gpsLocations[device]["longitude"] = valToUpdate;
                            break;

                        case 'status':
                            // Handle status: update both code and string
                            const code = parseInt(valToUpdate);
                            updateTelemetry('statusCode', code, device);
                            updateTelemetry('status', getStatusString(code), device);
                            return; // Done

                        case 'pyroStates':
                            // Handle pyro: decode byte
                            const pyroVal = parseInt(valToUpdate);
                            const pyroObj = decodePyro(pyroVal);
                            updateTelemetry('pyro', pyroObj, device);
                            return; // Done

                        default:
                            // Check if it matches other direct keys
                            if (['statusCode', 'flightTime', 'message'].includes(dataType)) {
                                keyToUpdate = dataType;
                            }
                            break;
                    }
                } else if (device == "ptrTracker") {
                    switch (dataType) {
                        case "altitude":
                            keyToUpdate = 'altitude';
                            break

                        case "latitude":
                            keyToUpdate = 'latitude';
                            gpsLocations[device]["latitude"] = valToUpdate;
                            break

                        case "longitude":
                            keyToUpdate = 'longitude';
                            gpsLocations[device]["longitude"] = valToUpdate;
                            break
                    }
                }

                if ((gpsLocations[device]["latitude"] != 0) && (gpsLocations[device]["longitude"] != 0)) {
                    updatePath(device, gpsLocations[device]["latitude"], gpsLocations[device]["longitude"], gpsLocations[device]["altitude"])

                    gpsLocations[device]["latitude"]  = 0;
                    gpsLocations[device]["longitude"] = 0;
                }

                // console.log(gpsLocations);

                if (keyToUpdate) {
                    // console.log(`[MQTT] Mapping topic "${lastPart}" -> "${keyToUpdate}":`, valToUpdate);
                    updateTelemetry(keyToUpdate, valToUpdate, device);
                    return;
                }

            });

            mqttClient.on('error', (err) => {
                addLog(`MQTT Error: ${err.message}`, 'error');
                setConnectionStatus('MQTT Error');
                setStatus('Error');
            });

            mqttClient.on('offline', () => {
                setStatus('Offline');
                setConnectionStatus('MQTT Offline');
            });

            mqttClient.on('close', () => {
                if (status === 'Connected') { // Only log if we were connected
                    addLog('MQTT Connection Closed');
                }
                setConnectionStatus('Disconnected');
                setStatus('Disconnected');
                clearSources();
            });

            setClient(mqttClient);

        } catch (error) {
            addLog(`MQTT Setup Error: ${error.message}`, 'error');
            setConnectionStatus('Connection Failed');
        }
    };

    const disconnectMQTT = () => {
        if (client) {
            client.end();
            setClient(null);
            setStatus('Disconnected');
            setConnectionStatus('Disconnected');
            addLog('MQTT Disconnected by user');
            clearSources();
        }
    };

    const sendMQTTCommand = (topic, command) => {
        client.publish(topic, command);
    }

    // Auto cleanup
    useEffect(() => {
        return () => {
            if (client) {
                console.log("Cleaning up MQTT client");
                client.end();
            }
        };
    }, [client]);

    return { connectMQTT, disconnectMQTT, sendMQTTCommand, mqttStatus: status };
}
