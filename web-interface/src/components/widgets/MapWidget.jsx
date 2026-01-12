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
            id: 'road_major',
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            filter: ['all', ['==', 'class', 'motorway']],
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
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
};

export function MapWidget({ className }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const coordsRef = useRef([0, 0]); // Store latest for event handlers
    const { data, gpsPath } = useTelemetry();
    const { gpsLat, gpsLng } = data;
    const startMarker = useRef(null);
    const currentMarker = useRef(null);

    // Update ref when data changes
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
            doubleClickZoom: false, // We use double click for external map
        });

        // Add controls
        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // External Map Handler
        map.current.on('dblclick', (e) => {
            e.preventDefault(); // Prevent default zoom (redundant with doubleClickZoom: false but good practice)

            const [lat, lng] = coordsRef.current;
            if (lat === 0 && lng === 0) return;

            // Use geo: URI for better mobile app integration
            // Fallback to https (handled by browser usually) if strictly needed, but user asked for app link.
            // A hybrid approach:
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            if (isMobile) {
                window.location.href = `geo:${lat},${lng}?q=${lat},${lng}`;
            } else {
                window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
            }
        });

        map.current.on('load', () => {
            // Add Line Source
            map.current.addSource('gps-trace', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [],
                    },
                },
            });

            // Add Line Layer (bottom most)
            map.current.addLayer(
                {
                    id: 'gps-trace-line',
                    type: 'line',
                    source: 'gps-trace',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                    },
                    paint: {
                        'line-color': '#ffff00', // Yellow/Gold for visibility or adjust as requested
                        'line-width': 4,
                    },
                },
                'water'
            ); // Place before water if possible, or usually just add first. 'background' is bottom.
            // Actually 'water' is usually above background. Let's try to put it right above background if possible or just use beforeId if we knew one.
            // Given the SIMPLE_STYLE, layers are: background, water, road_major, boundary.
            // We want it at the bottom-most layer that makes sense. Maybe above water?
            // Actually user said "bottom most layer". So maybe before 'road_major'?
            map.current.moveLayer('gps-trace-line', 'road_major');
        });

        // Create Start Marker (Green Teardrop)
        const startEl = document.createElement('div');
        startEl.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="#22c55e" stroke="white" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`;
        startEl.className = 'w-6 h-6 -translate-x-1/2 -translate-y-full'; // Adjust anchor if needed, but MapLibre handles simple offsets.
        // Actually maplibre markers center by default? No, anchor is center.
        // Upside down teardrop usually points down. The SVG path above is a standard pin pointing down.
        // Wait, "upside down" might mean pointing UP? A standard map pin points DOWN.
        // "Teardrop upside down" -> Standard pins look like upside down teardrops. I will assume they mean a standard pin.
        // If they strictly mean the shape is inverted (point up), I'd rotate it.
        // "green teardrom upside down for the staring point" -> standard pin.

        startMarker.current = new maplibregl.Marker({ element: startEl, anchor: 'bottom' });

        // Create Current Marker (Blue Triangle with Outline)
        const currentEl = document.createElement('div');
        currentEl.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="#3b82f6" stroke="white" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>`;
        currentEl.className = 'w-6 h-6';

        currentMarker.current = new maplibregl.Marker({ element: currentEl, anchor: 'center' });

        return () => {
            map.current?.remove();
            map.current = null;
            startMarker.current = null;
            currentMarker.current = null;
        };
    }, []);

    const lastInteraction = useRef(0);

    // Track user interaction
    useEffect(() => {
        if (!map.current) return;

        const handleInteraction = () => {
            lastInteraction.current = Date.now();
        };

        // Listen to map events that indicate user intent (move, zoom, etc.)
        // We use MapLibre events but filter for user-initiated ones if possible,
        // OR just simple DOM events on the canvas which is easier for "any touch".
        const canvas = map.current.getCanvas();
        canvas.addEventListener('mousedown', handleInteraction);
        canvas.addEventListener('touchstart', handleInteraction);
        canvas.addEventListener('wheel', handleInteraction);

        // Also listen for drag pan via library events just in case
        map.current.on('movestart', (e) => {
            if (e.originalEvent) handleInteraction();
        });

        return () => {
            canvas.removeEventListener('mousedown', handleInteraction);
            canvas.removeEventListener('touchstart', handleInteraction);
            canvas.removeEventListener('wheel', handleInteraction);
        };
    }, []);

    useEffect(() => {
        if (!map.current || !startMarker.current || !currentMarker.current) return;

        // Update Path
        if (map.current.getSource('gps-trace')) {
            map.current.getSource('gps-trace').setData({
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: gpsPath,
                },
            });
        }

        // Update Start Marker
        if (gpsPath.length > 0) {
            const start = gpsPath[0];
            startMarker.current.setLngLat(start).addTo(map.current);
        }

        // Update Current Marker
        if (gpsLat !== 0 || gpsLng !== 0) {
            const ll = [gpsLng, gpsLat];
            currentMarker.current.setLngLat(ll).addTo(map.current);

            // Auto-pan if no interaction in last 4 seconds
            if (Date.now() - lastInteraction.current > 4000) {
                map.current.panTo(ll);
            }
        }
    }, [gpsPath, gpsLat, gpsLng]);

    return (
        <div className={className}>
            <div ref={mapContainer} className="w-full h-full rounded-lg overflow-hidden border border-border-color" />
        </div>
    );
}
