import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Assuming server is on the same host/port if served by it,
        // or proxy is set up in vite.config.js for dev.
        // For dev, we might need to point to localhost:3000
        const newSocket = io('/', {
            transports: ['websocket'],
            autoConnect: false,
        });

        newSocket.on('connect', () => {
            console.log('Socket Connected');
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket Disconnected');
            setConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}
