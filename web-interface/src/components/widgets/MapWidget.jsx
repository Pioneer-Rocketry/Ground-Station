import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTelemetry } from '../../contexts/TelemetryContext';

const SIMPLE_STYLE = {
    version: 8,
    sources: {
        openmaptiles: {
            type: 'vector',
            tiles: ['https://maptiler.csutter.dev/api/tiles/osm-2020-02-10-v3.11_north-america_us/{z}/{x}/{y}'],
            minzoom: 0,
            maxzoom: 14,
        },
    },
    layers: [
        {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#111' },
        },
        {
            id: 'water',
            type: 'fill',
            source: 'openmaptiles',
            'source-layer': 'water',
            paint: { 'fill-color': '#2c2c2c' },
        },
        {
            id: 'waterway',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'waterway',
            paint: { 'line-color': '#2c2c2c' },
        },
        {
            id: 'road_major',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            filter: ['all', ['==', 'class', 'motorway']],
            paint: { 'line-color': '#444', 'line-width': 2 },
        },
        {
            id: 'road_minor',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            filter: ['all', ['==', 'class', 'minor']],
            paint: { 'line-color': '#444', 'line-width': 2 },
        },
        {
            id: 'road_service',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            filter: ['all', ['==', 'class', 'service']],
            paint: { 'line-color': '#444', 'line-width': 2 },
        },
        {
            id: 'boundary',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'boundary',
            paint: { 'line-color': '#666', 'line-width': 1 },
        },
    ],
};

// Global consistent palette for devices (Same as PlotWidget)
const GLOBAL_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export function MapWidget({ className }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const coordsRef = useRef([0, 0]); // Store latest for event handlers
    
    const { data, pathsBySource, valuesBySource } = useTelemetry();
    const { gpsLat, gpsLng } = data;
    
    // Track markers by source: { [source]: Marker }
    const markersRef = useRef({});
    const startMarkersRef = useRef({});
    const userMarker = useRef(null);

    // Update ref when data changes (for interaction handlers primarily)
    useEffect(() => {
        coordsRef.current = [gpsLat, gpsLng];
    }, [gpsLat, gpsLng]);

    useEffect(() => {
        if (map.current) return;
        if (!mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: SIMPLE_STYLE,
            center: [-90.48, 42.7329], // Busby Hall, UW-Platteville
            zoom: 16,
            doubleClickZoom: false,
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // External Map Handler
        map.current.on('dblclick', (e) => {
            e.preventDefault(); 
            const [lat, lng] = coordsRef.current;
            if (lat === 0 && lng === 0) return;

            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
            } else {
                window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
            }
        });

        // Cleanup
        return () => {
            map.current?.remove();
            map.current = null;
            markersRef.current = {};
            startMarkersRef.current = {};
        };
    }, []);

    const lastInteraction = useRef(0);

    // Track user interaction
    useEffect(() => {
        if (!map.current) return;
        const handleInteraction = () => lastInteraction.current = Date.now();
        const canvas = map.current.getCanvas();
        canvas.addEventListener('mousedown', handleInteraction);
        canvas.addEventListener('touchstart', handleInteraction);
        canvas.addEventListener('wheel', handleInteraction);
        map.current.on('movestart', (e) => { if (e.originalEvent) handleInteraction(); });

        return () => {
            canvas.removeEventListener('mousedown', handleInteraction);
            canvas.removeEventListener('touchstart', handleInteraction);
            canvas.removeEventListener('wheel', handleInteraction);
        };
    }, []);

    // Handle Paths and Markers
    useEffect(() => {
        if (!map.current) return;

        // Ensure we handle all sources found in pathsBySource
        // We also want to respect the sorted order for colors
        const sources = Object.keys(pathsBySource).sort();

        // 1. Update/Create Sources and Layers for Paths
        sources.forEach((source, idx) => {
            const path = pathsBySource[source];
            const color = GLOBAL_COLORS[idx % GLOBAL_COLORS.length];
            const sourceId = `trace-${source}`;

            // Add Source if missing
            if (!map.current.getSource(sourceId)) {
                map.current.addSource(sourceId, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: [] },
                    },
                });

                map.current.addLayer({
                    id: `line-${source}`,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 
                        'line-color': color, 
                        'line-width': 4 
                    },
                });
            }

            // Update Data
            map.current.getSource(sourceId).setData({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: path },
            });

            // 2. Manage Start Marker
            if (path.length > 0) {
                if (!startMarkersRef.current[source]) {
                    const startEl = document.createElement('div');
                    // Green Teardrop for Start
                    startEl.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="#22c55e" stroke="white" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`;
                    startEl.className = 'w-6 h-6 -translate-x-1/2 -translate-y-full'; 
                    startMarkersRef.current[source] = new maplibregl.Marker({ element: startEl, anchor: 'bottom' })
                        .setLngLat(path[0])
                        .addTo(map.current);
                } else {
                    // Update header if needed, but start position shouldn't move usually?
                    // Safe to update just in case it was 0,0
                     startMarkersRef.current[source].setLngLat(path[0]);
                }
            }
        });

        // 3. Manage Current Position Markers
        // We look at the LAST point in the path, OR valuesBySource if we want live data
        // Path is safest for sync.
        sources.forEach((source, idx) => {
            const path = pathsBySource[source];
            if (!path || path.length === 0) return;

            const currentPos = path[path.length - 1]; // [lng, lat]
            const color = GLOBAL_COLORS[idx % GLOBAL_COLORS.length];

            if (!markersRef.current[source]) {
                const currentEl = document.createElement('div');
                // Triangle with specific color
                currentEl.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="${color}" stroke="white" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>`;
                currentEl.className = 'w-6 h-6';

                markersRef.current[source] = new maplibregl.Marker({ element: currentEl, anchor: 'center' })
                    .setLngLat(currentPos)
                    .addTo(map.current);
            } else {
                markersRef.current[source].setLngLat(currentPos);
            }

            // Auto-pan to the FIRST source (likely the rocket or primary payload) if no interaction
            // Or maybe pan to fit bounds of all?
            // "Rocket" logic: if source is 'PTR' (idx 1 usually) or just first source?
            // Let's stick to first source for now.
            if (idx === 0 && Date.now() - lastInteraction.current > 4000) {
                 map.current.panTo(currentPos);
            }
        });

    }, [pathsBySource]);

    // User Location Tracking
    useEffect(() => {
        if (!navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                if (!map.current) return;

                if (!userMarker.current) {
                    const el = document.createElement('div');
                    el.className = 'w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-md';
                    userMarker.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map.current);
                } else {
                    userMarker.current.setLngLat([longitude, latitude]);
                }
            },
            (err) => console.warn('Geolocation error:', err),
            { enableHighAccuracy: true }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    return (
        <div className={className}>
            <div ref={mapContainer} className="w-full h-full rounded-lg overflow-hidden border border-border-color" />
        </div>
    );
}
