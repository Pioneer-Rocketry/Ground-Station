
import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useTelemetry } from '../contexts/TelemetryContext';
import { parseTelemetry, getStatusString, decodePyro } from '../lib/parser';

export function useMQTT() {
    const { setData, addLog, setConnectionStatus, setIsHost, setSource, updateSources, clearSources } = useTelemetry();
    const [client, setClient] = useState(null);
    const [status, setStatus] = useState('Disconnected');

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

        console.log(options);

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
            });

            mqttClient.on('message', (topic, message) => {
                const msgStr = message.toString();
                // console.log('[MQTT] RX Topic:', topic, 'Msg:', msgStr);

                // 1. Try to parse as JSON (Object or Scalar)
                let parsedJSON = undefined;
                try {
                    parsedJSON = JSON.parse(msgStr);
                } catch (e) {
                    // Not JSON
                }

                // If it is a JSON object, merge it
                if (parsedJSON && typeof parsedJSON === 'object' && !Array.isArray(parsedJSON)) {
                    console.log('[MQTT] Merging JSON Object:', parsedJSON);
                    setData(prev => ({ ...prev, ...parsedJSON }));

                    // Mark all keys as MQTT source
                    const newSources = {};
                    Object.keys(parsedJSON).forEach(k => {
                        newSources[k] = 'mqtt';
                    });
                    updateSources(newSources);

                    return;
                }

                // 2. Topic-based Mapping (Scalar values)
                // If the topic ends with a known key, update that key
                const lastPart = topic.split('/').pop();
                // 2. Topic-based Mapping (Scalar values)
                // const lastPart = topic.split('/').pop(); // Already declared above

                let keyToUpdate = null;
                let valToUpdate = (parsedJSON !== undefined) ? parsedJSON : msgStr;

                // Map topic suffix to internal state key
                switch (lastPart) {
                    case 'altitude': keyToUpdate = 'altitude'; break;
                    case 'speedVert': keyToUpdate = 'speedVert'; break;
                    case 'accel': keyToUpdate = 'accel'; break;
                    case 'battVoltage': keyToUpdate = 'battVoltage'; break;
                    case 'time': keyToUpdate = 'flightTime'; break; // Mapping "time" -> "flightTime"
                    case 'gpsLat': keyToUpdate = 'gpsLat'; break;
                    case 'gpsLng': keyToUpdate = 'gpsLng'; break;
                    case 'gpsState': keyToUpdate = 'gpsState'; break;
                    case 'angle': keyToUpdate = 'angle'; break;

                    case 'status':
                        // Handle status: update both code and string
                        const code = parseInt(valToUpdate);
                        setData(prev => ({
                            ...prev,
                            statusCode: code,
                            status: getStatusString(code)
                        }));
                        updateSources({ statusCode: 'mqtt', status: 'mqtt' });
                        return; // Done

                    case 'pyroStates':
                        // Handle pyro: decode byte
                        const pyroVal = parseInt(valToUpdate);
                        const pyroObj = decodePyro(pyroVal);
                        setData(prev => ({ ...prev, pyro: pyroObj }));
                        updateSources({ pyro: 'mqtt' });
                        return; // Done

                    default:
                        // Check if it matches other direct keys
                        if (['statusCode', 'flightTime', 'message'].includes(lastPart)) {
                            keyToUpdate = lastPart;
                        }
                        break;
                }

                if (keyToUpdate) {
                    // console.log(`[MQTT] Mapping topic "${lastPart}" -> "${keyToUpdate}":`, valToUpdate);
                    setData(prev => ({ ...prev, [keyToUpdate]: valToUpdate }));
                    setSource(keyToUpdate, 'mqtt');
                    return;
                }

                // 3. Fallback to Serial-style parser (for "F B" packets)
                try {
                    const data = parseTelemetry(msgStr);
                    if (data.type === 'telemetry') {
                        setData(prev => ({ ...prev, ...data }));

                        // Mark all keys as MQTT source
                        const newSources = {};
                        Object.keys(data).forEach(k => {
                            // exclude internal parser keys if needed, but 'mqtt' source is fine for all
                            newSources[k] = 'mqtt';
                        });
                        updateSources(newSources);

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

    const sendMQTTCommand = (command) => {
        client.publish(`${baseTopic}/control`, command);
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
