
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

    const [baseTopic, setTopic] = useState(null);

    let lastGps = useRef({ lat: null, lng: null, alt: null, updatedLat: false, updatedLong: false });

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
                    console.log(msgStr)
                    if (msgStr == "list") return;

                    if (!devices.includes(msgStr)) {
                        setDevices([...devices, msgStr]);
                        console.log(`New Device ${msgStr}`);
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
                            lastGps.current.alt = valToUpdate;
                            break;

                        case 'gpsLat':
                            keyToUpdate = 'latitude';
                            lastGps.current.lat = valToUpdate;
                            lastGps.current.latUpdated = true;
                            break;
                        
                        case 'gpsLng': 
                            keyToUpdate = 'longitude';
                            lastGps.current.long = valToUpdate;
                            lastGps.current.longUpdated = true;
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
                            lastGps.current.lat = valToUpdate;
                            lastGps.current.latUpdated = true;
                            break

                        case "longitude":
                            keyToUpdate = 'longitude';
                            lastGps.current.long = valToUpdate;
                            lastGps.current.longUpdated = true;
                            break
                    }
                }

                if (lastGps.current.latUpdated && lastGps.current.longUpdated) {
                    updatePath(device, lastGps.current.lat, lastGps.current.long, lastGps.current.alt)

                    lastGps.current.latUpdated = false;
                    lastGps.current.longUpdated = false;
                }

                if (keyToUpdate) {
                    // console.log(`[MQTT] Mapping topic "${lastPart}" -> "${keyToUpdate}":`, valToUpdate);
                    updateTelemetry(keyToUpdate, valToUpdate, device);
                    return;
                }

                // 3. Fallback to Serial-style parser (for "F B" packets)
                try {
                    const data = parseTelemetry(msgStr);
                    if (data.type === 'telemetry') {
                        // Mark all keys as MQTT source
                        Object.entries(data).forEach(([k, v]) => {
                            if (k !== 'type' && k !== 'raw') {
                                updateTelemetry(k, v, device);
                            }
                        });

                    } else if (data.type === 'other' && data.raw.trim().length > 0) {
                        // Only log if not handled above to avoid noise
                        // addLog(`RX: ${data.raw.substring(0, 50)}`);
                    }
                } catch (e) {
                    // ignore
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
