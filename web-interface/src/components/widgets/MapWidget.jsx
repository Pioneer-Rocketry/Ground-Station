import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useTelemetry } from '../../contexts/TelemetryContext';
import { GLOBAL_COLORS } from '../../lib/const';

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

export function MapWidget({ className }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const coordsRef = useRef([0, 0]); // Store latest for event handlers

    const { data, pathsBySource, valuesBySource, is3DMode } = useTelemetry();
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
            pitch: 60, // Start with some tilt
            bearing: -17.6,
            maxPitch: 85,
            doubleClickZoom: false,
        });

        map.current.addControl(
            new maplibregl.NavigationControl({
                visualizePitch: true,
                showZoom: true,
                showCompass: true,
            }),
            'top-right'
        );

        // Initial setup only
        map.current.on('load', () => {
            map.current.addSource('terrain', {
                type: 'raster-dem',
                url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
                tileSize: 256,
            });
            // Default based on initial state (which defaults to false)
            if (is3DMode) {
                map.current.setTerrain({ source: 'terrain', exaggeration: 1.5 });
            }
        });

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

        // ... cleanup
        return () => {
            map.current?.remove();
            map.current = null;
            markersRef.current = {};
            startMarkersRef.current = {};
        };
    }, []); // Run once

    // React to 3D Mode changes
    useEffect(() => {
        if (!map.current || !map.current.getSource('terrain')) return;

        if (is3DMode) {
            map.current.setTerrain({ source: 'terrain', exaggeration: 1.5 });
            map.current.easeTo({ pitch: 60, bearing: -17.6 });
        } else {
            map.current.setTerrain(null); // Disable terrain
            map.current.easeTo({ pitch: 0, bearing: 0 }); // Top-down view
        }
    }, [is3DMode]);

    const lastInteraction = useRef(0);

    // Track user interaction
    useEffect(() => {
        if (!map.current) return;
        const handleInteraction = () => (lastInteraction.current = Date.now());
        const canvas = map.current.getCanvas();
        canvas.addEventListener('mousedown', handleInteraction);
        canvas.addEventListener('touchstart', handleInteraction);
        canvas.addEventListener('wheel', handleInteraction);
        map.current.on('movestart', (e) => {
            if (e.originalEvent) handleInteraction();
        });

        return () => {
            canvas.removeEventListener('mousedown', handleInteraction);
            canvas.removeEventListener('touchstart', handleInteraction);
            canvas.removeEventListener('wheel', handleInteraction);
        };
    }, []);

    // Handle Paths and Markers
    const lastMapUpdate = useRef(0);

    useEffect(() => {
        if (!map.current) return;

        // Throttle updates to ~10fps (100ms) to prevent UI lag during high-speed replay
        const now = Date.now();
        if (now - lastMapUpdate.current < 100 && Object.keys(pathsBySource).length > 0) return;
        lastMapUpdate.current = now;

        // Ensure we handle all sources found in pathsBySource
        // We also want to respect the sorted order for colors
        const sources = Object.keys(pathsBySource).sort();

        // 1. Update/Create Sources and Layers for Paths
        sources.forEach((source, idx) => {
            const path = pathsBySource[source];
            const color = GLOBAL_COLORS[idx % GLOBAL_COLORS.length];
            const sourceId = `trace-${source}`;

            const shadowId = `trace-shadow-${source}`;
            const extrusionId = `trace-extrusion-${source}`;

            // 1. Prepare Data
            // Shadow: 2D projection
            const shadowPath = path.map((p) => [p[0], p[1]]);

            // Extrusion: Create a "Floating Ribbon" to simulate a 3D line
            // We extrude from (alt - thickness) to (alt) so it floats in the air
            const pillars = [];

            if (is3DMode) {
                const samplingRate = 2; // Optimize: use every 2nd point to reduce polygon count by 50%
                const thickness = 5; // 5 Meters thick (finer line)
                const width = 0.00002; // ~2 Meters width (finer line)

                for (let i = 0; i < path.length; i += samplingRate) {
                    const [lng, lat, alt] = path[i];
                    // Show anything above 0, even if small
                    if (alt === undefined || alt <= 1) continue;

                    // Clamp base to be at least 0
                    let base = alt - thickness;
                    if (base < 0) base = 0;

                    pillars.push({
                        type: 'Feature',
                        properties: {
                            level: alt,
                            base: base,
                            color: color,
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [lng - width, lat - width],
                                    [lng + width, lat - width],
                                    [lng + width, lat + width],
                                    [lng - width, lat + width],
                                    [lng - width, lat - width],
                                ],
                            ],
                        },
                    });
                }
                // Ensure the very last point is always added for accuracy
                if (path.length > 0) {
                    const [lng, lat, alt] = path[path.length - 1];
                    if (alt > 1) {
                        // Adjusted condition to match the loop
                        let base = alt - thickness;
                        if (base < 0) base = 0;
                        pillars.push({
                            type: 'Feature',
                            properties: { level: alt, base: alt - thickness, color: color },
                            geometry: {
                                type: 'Polygon',
                                coordinates: [
                                    [
                                        [lng - width, lat - width],
                                        [lng + width, lat - width],
                                        [lng + width, lat + width],
                                        [lng - width, lat + width],
                                        [lng - width, lat - width],
                                    ],
                                ],
                            },
                        });
                    }
                }
            }

            // 2. Add Sources/Layers if Missing

            // A. Shadow (Ground Track) - Keep this for reference!
            if (!map.current.getSource(shadowId)) {
                map.current.addSource(shadowId, {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                });
                map.current.addLayer({
                    id: `line-shadow-${source}`,
                    type: 'line',
                    source: shadowId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': '#000000',
                        'line-opacity': 0.3,
                        'line-width': 4,
                        'line-blur': 1,
                    },
                });
            }

            // B. Extrusion (Floating 3D Line)
            if (!map.current.getSource(extrusionId)) {
                map.current.addSource(extrusionId, {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                });
                map.current.addLayer({
                    id: `extrusion-${source}`,
                    type: 'fill-extrusion',
                    source: extrusionId,
                    paint: {
                        'fill-extrusion-color': ['get', 'color'],
                        'fill-extrusion-height': ['get', 'level'],
                        'fill-extrusion-base': ['get', 'base'],
                        'fill-extrusion-opacity': 1,
                    },
                });
            }

            // C. Main Line (Draped) - Optional, keeps ground track clear
            // user request "just a 3d line", so maybe hide draped line if shadow exists?
            // Let's keep draped line as "ground projection" (shadow is black, this is colored)
            // Or maybe transparent? Let's make it very faint.
            if (!map.current.getSource(sourceId)) {
                map.current.addSource(sourceId, {
                    type: 'geojson',
                    data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
                });
                map.current.addLayer({
                    id: `line-${source}`,
                    type: 'line',
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': color,
                        'line-width': 2,
                        'line-opacity': 0.2, // Faint ground track
                    },
                });
            }

            // 3. Update Data
            map.current.getSource(shadowId).setData({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: shadowPath },
            });

            map.current.getSource(extrusionId).setData({
                type: 'FeatureCollection',
                features: pillars,
            });

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
                    startMarkersRef.current[source] = new maplibregl.Marker({ element: startEl, anchor: 'bottom' }).setLngLat(path[0]).addTo(map.current);
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

                markersRef.current[source] = new maplibregl.Marker({ element: currentEl, anchor: 'center' }).setLngLat(currentPos).addTo(map.current);
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
