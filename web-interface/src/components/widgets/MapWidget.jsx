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
    const marker = useRef(null);
    const coordsRef = useRef([0, 0]); // Store latest for event handlers
    const { data } = useTelemetry();
    const { gpsLat, gpsLng } = data;

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

        // Create marker
        const el = document.createElement('div');
        el.className = 'w-4 h-4 rounded-full bg-accent-primary border-2 border-white shadow-lg';

        marker.current = new maplibregl.Marker({ element: el }).setLngLat([-90.48, 42.7329]).addTo(map.current);

        return () => {
            map.current?.remove();
            map.current = null;
            marker.current = null;
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
        if (!map.current || !marker.current) return;
        if (gpsLat === 0 && gpsLng === 0) return;

        const ll = [gpsLng, gpsLat];
        marker.current.setLngLat(ll);

        // Auto-pan if no interaction in last 4 seconds
        if (Date.now() - lastInteraction.current > 4000) {
            map.current.panTo(ll);
        }
    }, [gpsLat, gpsLng]);

    return (
        <div className={className}>
            <div ref={mapContainer} className="w-full h-full rounded-lg overflow-hidden border border-border-color" />
        </div>
    );
}
