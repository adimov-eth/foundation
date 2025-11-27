document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('graph-svg');
    const nodesLayer = document.getElementById('nodes-layer');
    const connectionsLayer = document.getElementById('connections-layer');
    const detailsPanel = document.getElementById('details-panel');
    const closeDetailsBtn = document.getElementById('close-details');
    const detailTitle = document.getElementById('detail-title');
    const detailContent = document.getElementById('detail-content');

    // Add Back Button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.textContent = '← Back to System View';
    document.querySelector('.app-container').appendChild(backBtn);

    // State
    let currentView = 'system'; // 'system' or 'detail'
    let activeNodeId = null;

    // Data Definition
    const systemNodes = [
        {
            id: 'arrival',
            label: 'ARRIVAL',
            x: 400,
            y: 150,
            color: '#00f3ff',
            description: 'The TypeScript-Native Orchestration Layer.',
            subNodes: [
                { id: 'lips', label: 'LIPS Interpreter', x: 400, y: 100, r: 25 },
                { id: 'sandbox', label: 'Sandbox', x: 300, y: 200, r: 25 },
                { id: 'control', label: 'Control Loop', x: 500, y: 200, r: 25 },
                { id: 'tools', label: 'Tool Registry', x: 400, y: 300, r: 25 }
            ],
            subConnections: [
                { from: 'lips', to: 'sandbox' },
                { from: 'sandbox', to: 'control' },
                { from: 'control', to: 'tools' },
                { from: 'tools', to: 'lips' }
            ],
            details: `...` // (Same as before)
        },
        {
            id: 'vessel',
            label: 'VESSEL',
            x: 200,
            y: 450,
            color: '#bd00ff',
            description: 'The Active Context Engine.',
            subNodes: [
                { id: 'graph', label: 'Knowledge Graph', x: 200, y: 400, r: 30 },
                { id: 'activation', label: 'Spreading Activation', x: 100, y: 500, r: 25 },
                { id: 'injector', label: 'Intuition Injector', x: 300, y: 500, r: 25 },
                { id: 'observer', label: 'Observer', x: 200, y: 600, r: 25 }
            ],
            subConnections: [
                { from: 'observer', to: 'graph' },
                { from: 'graph', to: 'activation' },
                { from: 'activation', to: 'injector' }
            ],
            details: `...` // (Same as before)
        },
        {
            id: 'plexus',
            label: 'PLEXUS',
            x: 600,
            y: 450,
            color: '#ffd700',
            description: 'The Shared Reality Layer.',
            subNodes: [
                { id: 'yjs', label: 'Yjs Doc', x: 600, y: 450, r: 35 },
                { id: 'user', label: 'User Client', x: 500, y: 350, r: 20 },
                { id: 'agent', label: 'Agent Client', x: 700, y: 350, r: 20 },
                { id: 'sync', label: 'Sync Protocol', x: 600, y: 550, r: 25 }
            ],
            subConnections: [
                { from: 'user', to: 'yjs' },
                { from: 'agent', to: 'yjs' },
                { from: 'yjs', to: 'sync' }
            ],
            details: `...` // (Same as before)
        }
    ];

    const systemConnections = [
        { from: 'arrival', to: 'vessel', color: '#00f3ff' },
        { from: 'vessel', to: 'arrival', color: '#bd00ff' },
        { from: 'arrival', to: 'plexus', color: '#ffd700' },
        { from: 'plexus', to: 'arrival', color: '#ffd700' }
    ];

    // Initialize
    renderSystemView();

    function renderSystemView() {
        currentView = 'system';
        activeNodeId = null;
        backBtn.classList.remove('visible');
        detailsPanel.classList.add('hidden');

        // Clear
        nodesLayer.innerHTML = '';
        connectionsLayer.innerHTML = '';

        // Render Connections
        systemConnections.forEach((conn, index) => {
            const fromNode = systemNodes.find(n => n.id === conn.from);
            const toNode = systemNodes.find(n => n.id === conn.to);
            const offset = (index % 2 === 0) ? 10 : -10;

            const path = createPath(
                fromNode.x + offset, fromNode.y,
                toNode.x + offset, toNode.y,
                conn.color,
                true // isMain
            );
            connectionsLayer.appendChild(path);
            animateParticle(path, conn.color);
        });

        // Render Nodes
        systemNodes.forEach(node => {
            const g = createNodeGroup(node.x, node.y, node.id);
            g.onclick = () => drillDown(node);

            const circle = createCircle(40, node.color, true);
            const label = createLabel(node.label, 60, 'node-label');

            g.appendChild(circle);
            g.appendChild(label);
            nodesLayer.appendChild(g);
        });
    }

    function drillDown(node) {
        currentView = 'detail';
        activeNodeId = node.id;
        backBtn.classList.add('visible');

        // Transition: Fade out others, expand current
        // For simplicity in Vanilla JS, we'll re-render
        nodesLayer.innerHTML = '';
        connectionsLayer.innerHTML = '';

        // Render Sub-Connections
        if (node.subConnections) {
            node.subConnections.forEach(conn => {
                const fromSub = node.subNodes.find(n => n.id === conn.from);
                const toSub = node.subNodes.find(n => n.id === conn.to);

                const path = createPath(
                    fromSub.x, fromSub.y,
                    toSub.x, toSub.y,
                    node.color,
                    false // isMain
                );
                connectionsLayer.appendChild(path);
            });
        }

        // Render Sub-Nodes
        if (node.subNodes) {
            node.subNodes.forEach(sub => {
                const g = createNodeGroup(sub.x, sub.y, sub.id);
                // Sub-nodes don't click further

                const circle = createCircle(sub.r, node.color, false);
                const label = createLabel(sub.label, sub.r + 20, 'node-sub-label');

                g.appendChild(circle);
                g.appendChild(label);
                nodesLayer.appendChild(g);
            });
        }

        // Show Details Panel
        showDetails(node);
    }

    backBtn.onclick = () => {
        renderSystemView();
    };

    // Helpers
    function createNodeGroup(x, y, id) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'node-group');
        g.setAttribute('transform', `translate(${x}, ${y})`);
        g.dataset.id = id;
        return g;
    }

    function createCircle(r, color, isMain) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', r);
        circle.setAttribute('class', isMain ? 'node-circle' : 'node-sub-circle');
        circle.setAttribute('stroke', color);
        if (isMain) {
            circle.setAttribute('filter', `url(#glow-${color === '#00f3ff' ? 'blue' : (color === '#bd00ff' ? 'purple' : 'gold')})`);
        }
        return circle;
    }

    function createLabel(text, y, className) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('y', y);
        t.setAttribute('class', className);
        t.textContent = text;
        return t;
    }

    function createPath(x1, y1, x2, y2, color, isMain) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Simple curve
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        // Add some curve
        const d = isMain
            ? `M ${x1} ${y1} Q 400 300 ${x2} ${y2}`
            : `M ${x1} ${y1} L ${x2} ${y2}`;

        path.setAttribute('d', d);
        path.setAttribute('class', isMain ? 'connection-path' : 'connection-sub-path');
        path.setAttribute('stroke', color);
        return path;
    }

    function showDetails(node) {
        detailTitle.textContent = node.label;
        detailTitle.style.color = node.color;
        detailTitle.style.borderColor = node.color;

        // Re-use the existing details content from previous version or define new
        // For now, using the description
        detailContent.innerHTML = `
            <p style="margin-bottom: 20px; font-size: 1.1rem;">${node.description}</p>
            <p style="color: #888; font-size: 0.9rem;">(Detailed view active)</p>
        `;

        detailsPanel.classList.remove('hidden');
    }

    function animateParticle(path, color) {
        const particle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        particle.setAttribute('r', '3');
        particle.setAttribute('fill', color);
        particle.setAttribute('class', 'flow-particle');
        connectionsLayer.appendChild(particle);

        const length = path.getTotalLength();
        let start = performance.now();
        const duration = 2000 + Math.random() * 1000;

        function step(timestamp) {
            if (!document.body.contains(path)) {
                particle.remove();
                return; // Stop if path removed
            }
            const progress = ((timestamp - start) % duration) / duration;
            const point = path.getPointAtLength(progress * length);

            particle.setAttribute('cx', point.x);
            particle.setAttribute('cy', point.y);

            requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }
});
