
let map;
let marker;
let hasFix = false;

// Default style that uses OpenMapTiles schema (compatible with the user's source)
const STYLE_URL = 'https://api.maptiler.com/maps/basic-v2/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL';
// Wait, I shouldn't use a proprietary key.
// Let's use a raw JSON object for a simple style to avoid keys.
// Or rely on the fact that MapLibre has a demo style.

const SIMPLE_STYLE = {
    version: 8,
    sources: {
        'openmaptiles': {
            type: 'vector',
            tiles: [
                'https://maptiler.csutter.dev/api/tiles/osm-2020-02-10-v3.11_north-america_us/{z}/{x}/{y}'
            ],
            minzoom: 0,
            maxzoom: 14 // From metadata
        }
    },
    layers: [
        {
            "id": "background",
            "type": "background",
            "paint": { "background-color": "#111" }
        },
        {
            "id": "water",
            "type": "fill",
            "source": "openmaptiles",
            "source-layer": "water",
            "paint": { "fill-color": "#2c2c2c" }
        },
        {
            "id": "road_major",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "transportation",
            "filter": ["all", ["==", "class", "motorway"]],
            "paint": { "line-color": "#444", "line-width": 2 }
        },
        {
            "id": "boundary",
            "type": "line",
            "source": "openmaptiles",
            "source-layer": "boundary",
            "paint": { "line-color": "#666", "line-width": 1 }
        }
    ],
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
};

export function initMap() {
    try {
        map = new maplibregl.Map({
            container: 'map',
            style: SIMPLE_STYLE, // Dark simple style
            center: [-95.5371, 36.6658], // User's requested center
            zoom: 18 // High zoom for close-up view
        });

        map.addControl(new maplibregl.NavigationControl());

        // Create marker
        const el = document.createElement('div');
        el.className = 'rocket-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.backgroundColor = '#ef4444';
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';

        marker = new maplibregl.Marker({ element: el })
            .setLngLat([-95.5371, 36.6658])
            .addTo(map);

    } catch (e) {
        console.error("Map Init Error", e);
    }
}

export function updateMapPosition(lat, lng) {
    if (!map || !marker) return;

    // Sanity check
    if (lat === 0 && lng === 0) return;

    const ll = [lng, lat];
    marker.setLngLat(ll);

    // Pan to rocket if we haven't moved manually recently? 
    // For now, always pan or just fit bounds?
    // Let's pan.
    map.panTo(ll);
}
