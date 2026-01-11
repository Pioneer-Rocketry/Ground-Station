import React, { useState, useEffect } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { StatCard } from './widgets/StatCard';
import { MapWidget } from './widgets/MapWidget';
import { PyroWidget } from './widgets/PyroWidget';
import { MessageWidget } from './widgets/MessageWidget';
import { useTelemetry } from '../contexts/TelemetryContext';

// Define available widgets
const DEFAULT_WIDGETS = [
    { id: 'map', type: 'map', className: 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1 md:row-span-3 relative min-h-[300px] h-64 md:h-auto no-drag' },
    { id: 'altitude', type: 'stat', label: 'Altitude', unit: 'm', subLabel: 'AGL', className: 'col-span-1 h-32' },
    { id: 'speed', type: 'stat', label: 'Vertical Speed', unit: 'm/s', className: 'col-span-1 h-32' },
    { id: 'mission_status', type: 'mission_status', className: 'col-span-1 md:col-span-2 lg:col-span-2 h-32' },
    { id: 'accel', type: 'stat', label: 'Acceleration', unit: 'm/s²', className: 'col-span-1 h-32' },
    { id: 'battery', type: 'stat', label: 'Battery', unit: 'mV', className: 'col-span-1 h-32' },
    { id: 'flight_time', type: 'stat', label: 'Flight Time', unit: 's', className: 'col-span-1 h-32' },
    { id: 'gps_state', type: 'stat', label: 'GPS State', className: 'col-span-1 h-32' },
    { id: 'gps_lat', type: 'stat', label: 'GPS Lat', className: 'col-span-1 h-32' },
    { id: 'gps_lng', type: 'stat', label: 'GPS Lng', className: 'col-span-1 h-32' },
    { id: 'pyro', type: 'pyro', className: 'col-span-1 md:col-span-2 h-32' },
    { id: 'message', type: 'message', className: 'col-span-1 md:col-span-2 h-32' },
];

export function Dashboard() {
    const { data } = useTelemetry();
    const [widgets, setWidgets] = useState([]);
    const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth <= 700);

    useEffect(() => {
        const handleResize = () => {
            setIsSmallScreen(window.innerWidth <= 800);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load layout
    useEffect(() => {
        const saved = localStorage.getItem('dashboard_layout_v2');
        if (saved) {
            try {
                const savedIds = JSON.parse(saved);
                // Map saved IDs back to widget objects to restore order
                // Filter out any IDs that might no longer exist in DEFAULT_WIDGETS
                const loadedWidgets = savedIds.map((id) => DEFAULT_WIDGETS.find((w) => w.id === id)).filter(Boolean);

                // Add any new widgets that weren't in saved layout
                const missingWidgets = DEFAULT_WIDGETS.filter((w) => !savedIds.includes(w.id));
                setWidgets([...loadedWidgets, ...missingWidgets]);
                return;
            } catch (e) {
                console.error('Failed to load layout', e);
            }
        }
        setWidgets([...DEFAULT_WIDGETS]);
    }, []);

    // Save layout whenever widgets change
    useEffect(() => {
        if (widgets.length > 0) {
            localStorage.setItem('dashboard_layout_v2', JSON.stringify(widgets.map((w) => w.id)));
        }
    }, [widgets]);

    // Helper to render specific widget type
    const renderWidget = (widget) => {
        switch (widget.type) {
            case 'map':
                return (
                    <div className="w-full h-full relative">
                        <h3 className="absolute top-4 left-4 z-10 text-white font-bold bg-black/50 px-2 rounded backdrop-blur-sm">GPS TRACK</h3>
                        <span className="absolute bottom-2 right-2 z-10 text-[10px] text-white/50 font-mono pointer-events-none select-none bg-black/30 px-1 rounded">DOUBLE TAP TO OPEN MAPS</span>
                        <MapWidget className="w-full h-full rounded-lg" />
                    </div>
                );
            case 'stat':
                // Dynamically get value from data based on ID logic
                let value = 0;
                let color = undefined;

                if (widget.id === 'altitude') value = data.altitude;
                if (widget.id === 'speed') value = data.speedVert;
                if (widget.id === 'accel') value = data.accel.toFixed(1);
                if (widget.id === 'battery') value = data.battVoltage;
                if (widget.id === 'flight_time') value = data.flightTime.toFixed(1);
                if (widget.id === 'gps_state') value = data.gpsState;
                if (widget.id === 'gps_lat') value = data.gpsLat.toFixed(isSmallScreen ? 4 : 6);
                if (widget.id === 'gps_lng') value = data.gpsLng.toFixed(isSmallScreen ? 4 : 6);

                return <StatCard label={widget.label} value={value} unit={widget.unit} subLabel={widget.subLabel} className="h-full" />;

            case 'mission_status':
                return <StatCard label="Mission Status" value={data.status} valueColor={data.statusCode >= 4 ? 'text-accent-primary' : data.statusCode >= 1 ? 'text-accent-warn' : 'text-white'} className="h-full" />;

            case 'pyro':
                return <PyroWidget className="h-full" />;

            case 'message':
                return <MessageWidget className="h-full" />;

            default:
                return null;
        }
    };

    return (
        <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-bg-dark">
            <ReactSortable
                list={widgets}
                setList={setWidgets}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min pb-10"
                animation={150}
                delay={200}
                delayOnTouchOnly={true}
                filter=".no-drag"
                preventOnFilter={false}
                chosenClass="sortable-chosen-highlight"
                dragClass="sortable-drag-active"
                ghostClass="sortable-ghost-highlight">
                {widgets.map((widget) => (
                    <div key={widget.id} className={`${widget.className} cursor-grab active:cursor-grabbing`}>
                        {renderWidget(widget)}
                    </div>
                ))}
            </ReactSortable>
        </div>
    );
}
