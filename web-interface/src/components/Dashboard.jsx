import React, { useState, useEffect } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { StatCard } from './widgets/StatCard';
import { PlotWidget } from './widgets/PlotWidget';
import { MapWidget } from './widgets/MapWidget';
import { PyroWidget } from './widgets/PyroWidget';
import { MessageWidget } from './widgets/MessageWidget';
import { useTelemetry } from '../contexts/TelemetryContext';

// Define available widgets
const DEFAULT_WIDGETS = [
    { id: 'map', type: 'map', className: 'col-span-1 md:col-span-2 lg:col-span-2 row-span-1 md:row-span-3 relative min-h-[300px] h-64 md:h-auto no-drag' },
    { id: 'altitude', type: 'plot', label: 'Altitude', unit: 'm', subLabel: 'AGL', className: 'col-span-1 h-32', color: '#8884d8' },
    { id: 'speed', type: 'plot', label: 'Vertical Speed', unit: 'm/s', className: 'col-span-1 h-32', color: '#ffc658' },
    { id: 'mission_status', type: 'mission_status', className: 'col-span-1 md:col-span-2 lg:col-span-2 h-32' },
    { id: 'accel', type: 'plot', label: 'Acceleration', unit: 'm/s²', className: 'col-span-1 h-32', color: '#82ca9d' },
    { id: 'battery', type: 'plot', label: 'Battery', unit: 'mV', className: 'col-span-1 h-32', color: '#ff8042' },
    { id: 'flight_time', type: 'stat', label: 'Flight Time', unit: 's', className: 'col-span-1 h-32' },
    { id: 'pyro', type: 'pyro', className: 'col-span-1 md:col-span-2 h-32' },
    { id: 'message', type: 'message', className: 'col-span-1 md:col-span-2 h-32' },
];

export function Dashboard() {
    const { data, sources } = useTelemetry();
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
        // Common data logic
        let value = 0;
        let sourceKey = widget.id;

        // Map ID to data source
        if (widget.id === 'altitude') value = data.altitude;
        if (widget.id === 'speed') {
            value = data.speedVert;
            sourceKey = 'speedVert';
        }
        if (widget.id === 'accel') value = data.accel; // keep raw number for plot
        if (widget.id === 'battery') {
            value = data.battVoltage;
            sourceKey = 'battVoltage';
        }
        if (widget.id === 'flight_time') {
            value = data.flightTime;
            sourceKey = 'flightTime';
        }
        if (widget.id === 'gps_lat') {
            value = data.gpsLat;
            sourceKey = 'gpsLat';
        }
        if (widget.id === 'gps_lng') {
            value = data.gpsLng;
            sourceKey = 'gpsLng';
        }
        if (widget.id === 'gps_state') {
            value = data.gpsState;
            sourceKey = 'gpsState';
        }

        const isMQTT = sources[sourceKey] === 'mqtt';

        switch (widget.type) {
            case 'map':
                return (
                    <div className="w-full h-full relative">
                        {/* Top Left Overlay Group */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
                            <h3 className="text-white font-bold bg-black/50 px-2 rounded backdrop-blur-sm">GPS TRACK</h3>

                            <div className="bg-black/50 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-3">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[10px] text-text-muted font-bold">LAT</span>
                                    <span className="text-sm font-mono text-white">{data.gpsLat.toFixed(6)}</span>
                                </div>
                                <div className="w-px h-3 bg-white/20"></div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-[10px] text-text-muted font-bold">LNG</span>
                                    <span className="text-sm font-mono text-white">{data.gpsLng.toFixed(6)}</span>
                                </div>
                            </div>
                        </div>

                        {/* GPS State Overlay - Bottom Left */}
                        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
                            <div className="bg-black/50 px-2 py-1 rounded backdrop-blur-sm flex items-center gap-2">
                                <span className="text-[10px] text-text-muted font-bold">GPS STATE</span>
                                <span className="text-sm font-mono text-white">{data.gpsState}</span>
                            </div>
                        </div>

                        <span className="absolute bottom-2 right-2 z-10 text-[10px] text-white/50 font-mono pointer-events-none select-none bg-black/30 px-1 rounded">DOUBLE TAP TO OPEN MAPS</span>
                        <MapWidget className="w-full h-full rounded-lg" />
                    </div>
                );

            case 'plot':
                // Format value for display if needed, but pass raw number to plot
                return <PlotWidget label={widget.label} value={value} unit={widget.unit} subLabel={widget.subLabel} className="h-full" color={widget.color} isMQTT={isMQTT} />;

            case 'stat':
                // Format specific values for stat card
                let displayValue = value;
                if (widget.id === 'accel') displayValue = typeof value === 'number' ? value.toFixed(1) : value;
                if (widget.id === 'flight_time') displayValue = typeof value === 'number' ? value.toFixed(1) : value;
                if (widget.id === 'gps_lat' || widget.id === 'gps_lng') {
                    displayValue = typeof value === 'number' ? value.toFixed(isSmallScreen ? 4 : 6) : value;
                }

                return <StatCard label={widget.label} value={displayValue} unit={widget.unit} subLabel={widget.subLabel} className="h-full" isMQTT={isMQTT} />;

            case 'mission_status':
                return (
                    <StatCard
                        label="Mission Status"
                        value={data.status}
                        valueColor={data.statusCode >= 4 ? 'text-accent-primary' : data.statusCode >= 1 ? 'text-accent-warn' : 'text-white'}
                        className="h-full"
                        isMQTT={sources['status'] === 'mqtt' || sources['statusCode'] === 'mqtt'}
                    />
                );

            case 'pyro':
                return <PyroWidget className="h-full" isMQTT={sources['pyro'] === 'mqtt'} />;

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
