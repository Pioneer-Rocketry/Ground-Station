import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/modular/sortable.esm.js';

export function initDraggableDashboard() {
    const el = document.querySelector('.dashboard');
    if (!el) {
        console.error('Dashboard element not found');
        return;
    }

    console.log('Initializing SortableJS on dashboard');

    // Assign initial indices for restoration
    const cards = el.querySelectorAll('.stat-card');
    cards.forEach((card, index) => {
        if (!card.dataset.initialIndex) {
            card.dataset.initialIndex = index;
        }

        // Inject Close Buttons if missing
        if (!card.querySelector('.card-close-btn')) {
            const btn = document.createElement('button');
            btn.className = 'card-close-btn';
            btn.innerHTML = '&times;';
            btn.title = 'Remove Card';
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Soft close (hide)
                card.classList.add('hidden');
                saveLayout(el);
            };
            card.appendChild(btn);
        }
    });

    // Load saved state (order and visibility)
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
}

function saveLayout(container) {
    // Save Order
    const order = [];
    const hidden = [];
    const cards = container.querySelectorAll('.stat-card');

    cards.forEach(card => {
        if (card.id) {
            order.push(card.id);
            if (card.classList.contains('hidden')) {
                hidden.push(card.id);
            }
        }
    });

    localStorage.setItem('dashboard_layout', JSON.stringify(order));
    localStorage.setItem('dashboard_hidden', JSON.stringify(hidden));
    console.log('Layout saved');
}

function loadLayout(container) {
    const savedOrder = localStorage.getItem('dashboard_layout');
    const savedHidden = localStorage.getItem('dashboard_hidden');

    // Restore Hidden State
    if (savedHidden) {
        try {
            const hiddenIds = JSON.parse(savedHidden);
            hiddenIds.forEach(id => {
                const card = document.getElementById(id);
                if (card) card.classList.add('hidden');
            });
        } catch (e) { console.error(e); }
    }

    // Restore Order
    if (savedOrder) {
        try {
            const order = JSON.parse(savedOrder);
            const currentCards = {};
            Array.from(container.children).forEach(child => {
                if (child.id) currentCards[child.id] = child;
            });

            // Append in saved order
            order.forEach(id => {
                if (currentCards[id]) {
                    container.appendChild(currentCards[id]);
                }
            });
        } catch (e) {
            console.error('Failed to load layout', e);
        }
    }
}

export function resetLayout() {
    if (confirm('Reset dashboard layout to default?')) {
        localStorage.removeItem('dashboard_layout');
        localStorage.removeItem('dashboard_hidden');

        const container = document.querySelector('.dashboard');
        const cards = Array.from(container.querySelectorAll('.stat-card'));

        // 1. Unhide all
        cards.forEach(card => card.classList.remove('hidden'));

        // 2. Sort by initial index
        cards.sort((a, b) => {
            return Number(a.dataset.initialIndex) - Number(b.dataset.initialIndex);
        });

        // 3. Re-append in correct order
        cards.forEach(card => container.appendChild(card));

        console.log('Layout reset to default');
    }
}
