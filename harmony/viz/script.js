document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('sim-svg');
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // State
    const agents = [];
    const tasks = [];
    const beams = [];
    const ripples = [];
    let lastTime = 0;
    let nextAgentId = 1;

    // DOM Elements
    const btnInject = document.getElementById('btn-inject');
    const btnReset = document.getElementById('btn-reset');
    const statAgents = document.getElementById('stat-agents');
    const statTasks = document.getElementById('stat-tasks');

    // --- Initialization ---
    function init() {
        // Create Core (Vessel)
        const coreGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        coreGroup.setAttribute('transform', `translate(${centerX}, ${centerY})`);

        const core = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        core.setAttribute('r', '40');
        core.setAttribute('class', 'core-sun');

        const ring1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring1.setAttribute('r', '60');
        ring1.setAttribute('class', 'core-ring');

        const ring2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring2.setAttribute('r', '80');
        ring2.setAttribute('class', 'core-ring');
        ring2.style.animationDirection = 'reverse';
        ring2.style.animationDuration = '30s';

        coreGroup.appendChild(core);
        coreGroup.appendChild(ring1);
        coreGroup.appendChild(ring2);
        svg.appendChild(coreGroup);

        // Initial Agents
        for (let i = 0; i < 5; i++) spawnAgent();

        // Loop
        requestAnimationFrame(loop);
    }

    // --- Simulation Loop ---
    function loop(timestamp) {
        const dt = timestamp - lastTime;
        lastTime = timestamp;

        updateAgents(dt);
        updateTasks(dt);
        updateBeams();
        updateRipples();

        updateStats();
        requestAnimationFrame(loop);
    }

    // --- Agents ---
    function spawnAgent() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 150 + Math.random() * 200;
        const x = centerX + Math.cos(angle) * dist;
        const y = centerY + Math.sin(angle) * dist;

        const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('r', '5');
        el.setAttribute('class', 'agent');
        svg.appendChild(el);

        agents.push({
            id: nextAgentId++,
            x, y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            state: 'idle', // idle, swarming, syncing
            target: null,
            el
        });
    }

    function updateAgents(dt) {
        agents.forEach(a => {
            // Physics
            a.x += a.vx;
            a.y += a.vy;

            // Boundaries (Bounce)
            if (a.x < 0 || a.x > width) a.vx *= -1;
            if (a.y < 0 || a.y > height) a.vy *= -1;

            // Behavior
            if (a.state === 'idle') {
                // Orbit gently
                const dx = centerX - a.x;
                const dy = centerY - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 400) { // Keep close
                    a.vx += dx * 0.0001;
                    a.vy += dy * 0.0001;
                }
            } else if (a.state === 'swarming' && a.target) {
                // Move to task
                const dx = a.target.x - a.x;
                const dy = a.target.y - a.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 30) {
                    a.vx += dx * 0.0005;
                    a.vy += dy * 0.0005;
                } else {
                    // Arrived
                    a.vx *= 0.9;
                    a.vy *= 0.9;
                    // Shoot beam to core (Context Lookup)
                    if (Math.random() < 0.05) shootBeam(a, { x: centerX, y: centerY });
                }
            }

            // Update DOM
            a.el.setAttribute('cx', a.x);
            a.el.setAttribute('cy', a.y);
        });
    }

    // --- Tasks ---
    function injectTask() {
        const x = Math.random() * (width - 100) + 50;
        const y = Math.random() * (height - 100) + 50;

        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        el.setAttribute('transform', `translate(${x}, ${y})`);

        // Hexagon shape
        const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        hex.setAttribute('points', '0,-15 13,-7.5 13,7.5 0,15 -13,7.5 -13,-7.5');
        hex.setAttribute('class', 'task-node');
        el.appendChild(hex);
        svg.appendChild(el);

        const task = {
            id: Date.now(),
            x, y,
            life: 100, // 100% health
            el
        };
        tasks.push(task);

        // Create Ripple (Plexus Event)
        createRipple(x, y);

        // Assign Agents
        const squadSize = 3 + Math.floor(Math.random() * 3);
        // Find nearest idle agents
        const available = agents.filter(a => a.state === 'idle');
        // If not enough, spawn more
        while (available.length < squadSize) {
            spawnAgent();
            available.push(agents[agents.length - 1]);
        }

        // Dispatch Squad
        available.slice(0, squadSize).forEach(a => {
            a.state = 'swarming';
            a.target = task;
            a.el.classList.add('active');
        });
    }

    function updateTasks(dt) {
        for (let i = tasks.length - 1; i >= 0; i--) {
            const t = tasks[i];

            // Check if agents are near
            const swarmers = agents.filter(a => a.target === t);
            const arrived = swarmers.filter(a => {
                const dx = a.x - t.x;
                const dy = a.y - t.y;
                return Math.sqrt(dx * dx + dy * dy) < 40;
            });

            if (arrived.length > 0) {
                t.life -= 0.5; // Progress
                // Visual feedback
                t.el.style.opacity = t.life / 100;
            }

            if (t.life <= 0) {
                // Task Done
                t.el.remove();
                tasks.splice(i, 1);

                // Release Agents
                swarmers.forEach(a => {
                    a.state = 'idle';
                    a.target = null;
                    a.el.classList.remove('active');
                    // Ephemeral: chance to die
                    if (Math.random() < 0.3 && agents.length > 5) {
                        a.el.remove();
                        const idx = agents.indexOf(a);
                        if (idx > -1) agents.splice(idx, 1);
                    }
                });
            }
        }
    }

    // --- FX ---
    function shootBeam(from, to) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('class', 'beam');
        svg.insertBefore(line, svg.firstChild); // Behind nodes

        beams.push({ el: line, life: 20 });
    }

    function updateBeams() {
        for (let i = beams.length - 1; i >= 0; i--) {
            const b = beams[i];
            b.life--;
            if (b.life <= 0) {
                b.el.remove();
                beams.splice(i, 1);
            } else {
                b.el.style.opacity = b.life / 20;
            }
        }
    }

    function createRipple(x, y) {
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        r.setAttribute('cx', x);
        r.setAttribute('cy', y);
        r.setAttribute('r', '10');
        r.setAttribute('class', 'ripple');
        svg.insertBefore(r, svg.firstChild);
        ripples.push({ el: r, size: 10, opacity: 1 });
    }

    function updateRipples() {
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.size += 2;
            r.opacity -= 0.02;

            if (r.opacity <= 0) {
                r.el.remove();
                ripples.splice(i, 1);
            } else {
                r.el.setAttribute('r', r.size);
                r.el.style.opacity = r.opacity;
            }
        }
    }

    function updateStats() {
        statAgents.textContent = agents.length;
        statTasks.textContent = tasks.length;
    }

    // --- Controls ---
    btnInject.onclick = injectTask;
    btnReset.onclick = () => {
        tasks.forEach(t => t.el.remove());
        tasks.length = 0;
        agents.forEach(a => a.el.remove());
        agents.length = 0;
        for (let i = 0; i < 5; i++) spawnAgent();
    };

    // Start
    init();
});
