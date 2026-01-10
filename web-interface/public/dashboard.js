import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/modular/sortable.esm.js';

export function initDraggableDashboard() {
    const el = document.querySelector('.dashboard');
    if (!el) {
        console.error('Dashboard element not found');
        return;
    }

    console.log('Initializing SortableJS on dashboard');

    // Load saved order if exists
    loadLayout(el);

    Sortable.create(el, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        easing: "cubic-bezier(1, 0, 0, 1)",
        handle: '.stat-card',
        onEnd: function (evt) {
            saveLayout(el);
        }
    });

    // Show the dashboard content after reordering to prevent flash (optional, but good UX)
    // el.style.visibility = 'visible'; 
}

function saveLayout(container) {
    const order = [];
    const cards = container.querySelectorAll('.stat-card');
    cards.forEach(card => {
        if (card.id) {
            order.push(card.id);
        }
    });
    localStorage.setItem('dashboard_layout', JSON.stringify(order));
    console.log('Layout saved:', order);
}

function loadLayout(container) {
    const saved = localStorage.getItem('dashboard_layout');
    if (!saved) return;

    try {
        const order = JSON.parse(saved);
        // We need to move elements to match the order
        // Existing elements map
        const currentCards = {};
        Array.from(container.children).forEach(child => {
            if (child.id) currentCards[child.id] = child;
        });

        // Append in order (appending moves them)
        order.forEach(id => {
            if (currentCards[id]) {
                container.appendChild(currentCards[id]);
            }
        });
        console.log('Layout loaded');
    } catch (e) {
        console.error('Failed to load layout', e);
    }
}

