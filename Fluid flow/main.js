// --- Constants and Physics Configuration ---
const V1 = 1.0;      // Inlet velocity in m/s (reference)
const RHO = 1000.0;  // Fluid density in kg/m^3 (Water)
const G = 9.81;      // Gravitational acceleration in m/s^2

// Adjustable parameters (driven by the preset buttons)
const state = {
    A1: 80,   // Inlet cross-sectional area in cm^2
    A2: 20,   // Throat cross-sectional area in cm^2
    A3: 50,   // Outlet cross-sectional area in cm^2
    P1: 200,  // Source (inlet) pressure in kPa
    dh: 0     // Outlet elevation above the inlet in m
};

// Animation Scaling Factors
const SPEED_FACTOR = 40.0;   // Pixels/sec per 1 m/s of velocity
const SPACING_FACTOR = 20.0; // Pixels of spacing per 1 m/s of velocity

// Canvas Dimensions & Geometry Scaling
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 400;
const BASE_CENTER_Y = 230;  // Centerline of the inlet pipe
const AREA_SCALE = 10.0;    // Pipe half-height in px per sqrt(cm^2)
const PX_PER_M = 25.0;      // Elevation in px per metre

// Segment X ranges
const SEGX = {
    PIPE1:   { start: 0,   end: 240, name: "Pipe 1 (Inlet)" },
    TRANS12: { start: 240, end: 340, name: "Transition 1 → 2" },
    PIPE2:   { start: 340, end: 560, name: "Pipe 2 (Throat)" },
    TRANS23: { start: 560, end: 660, name: "Transition 2 → 3" },
    PIPE3:   { start: 660, end: 900, name: "Pipe 3 (Outlet)" }
};

// --- DOM References ---
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const elStatus = document.getElementById('probe-status');
const elSegment = document.getElementById('val-segment');
const elArea = document.getElementById('val-area');
const elVelocity = document.getElementById('val-velocity');
const elPressure = document.getElementById('val-pressure');
const elHeight = document.getElementById('val-height');

const elPresetP1 = document.getElementById('preset-p1');
const elPresetH = document.getElementById('preset-h');

const cards = {
    segment: document.getElementById('card-segment'),
    area: document.getElementById('card-area'),
    velocity: document.getElementById('card-velocity'),
    pressure: document.getElementById('card-pressure'),
    height: document.getElementById('card-height')
};

// --- State Variables ---
let mouseX = -1;
let mouseY = -1;
let isHovered = false;
let lastTime = 0;

let pipes = [];        // Computed geometry for the three straight pipes
let animSegments = []; // Flow line animation state per straight pipe
let lineGradients = [];

// --- Geometry Construction ---

function halfHeight(area) {
    return AREA_SCALE * Math.sqrt(area);
}

/**
 * Recomputes pipe geometry, animation speeds, and gradients from the
 * current adjustable state. Called once at start and on every preset change.
 */
function rebuildGeometry() {
    const c3 = BASE_CENTER_Y - state.dh * PX_PER_M;
    pipes = [
        { x: SEGX.PIPE1, area: state.A1, h: 0,        center: BASE_CENTER_Y, half: halfHeight(state.A1) },
        { x: SEGX.PIPE2, area: state.A2, h: 0,        center: BASE_CENTER_Y, half: halfHeight(state.A2) },
        { x: SEGX.PIPE3, area: state.A3, h: state.dh, center: c3,            half: halfHeight(state.A3) }
    ];

    animSegments = pipes.map(p => {
        const v = V1 * state.A1 / p.area;
        return {
            xStart: p.x.start,
            xEnd: p.x.end,
            spacing: v * SPACING_FACTOR,
            speed: v * SPEED_FACTOR,
            offset: 0,
            yTop: p.center - p.half,
            yBottom: p.center + p.half
        };
    });

    lineGradients = animSegments.map(s => {
        const g = ctx.createLinearGradient(0, s.yTop, 0, s.yBottom);
        g.addColorStop(0, 'rgba(0, 229, 255, 0)');
        g.addColorStop(0.15, 'rgba(0, 229, 255, 0.45)');
        g.addColorStop(0.85, 'rgba(0, 229, 255, 0.45)');
        g.addColorStop(1, 'rgba(0, 229, 255, 0)');
        return g;
    });
}

// --- Helper Functions ---

function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Returns the pipe profile (segment name, area, elevation, wall geometry)
 * at a given x coordinate, interpolating linearly inside transitions.
 */
function profileAt(x) {
    if (x < 0 || x > CANVAS_WIDTH) return null;
    const [p1, p2, p3] = pipes;

    if (x < SEGX.PIPE1.end) {
        return { name: SEGX.PIPE1.name, area: p1.area, h: 0, center: p1.center, half: p1.half };
    }
    if (x < SEGX.PIPE2.start) {
        const t = (x - SEGX.TRANS12.start) / (SEGX.TRANS12.end - SEGX.TRANS12.start);
        return {
            name: SEGX.TRANS12.name,
            area: lerp(p1.area, p2.area, t),
            h: 0,
            center: lerp(p1.center, p2.center, t),
            half: lerp(p1.half, p2.half, t)
        };
    }
    if (x < SEGX.PIPE2.end) {
        return { name: SEGX.PIPE2.name, area: p2.area, h: 0, center: p2.center, half: p2.half };
    }
    if (x < SEGX.PIPE3.start) {
        const t = (x - SEGX.TRANS23.start) / (SEGX.TRANS23.end - SEGX.TRANS23.start);
        return {
            name: SEGX.TRANS23.name,
            area: lerp(p2.area, p3.area, t),
            h: lerp(0, p3.h, t),
            center: lerp(p2.center, p3.center, t),
            half: lerp(p2.half, p3.half, t)
        };
    }
    return { name: SEGX.PIPE3.name, area: p3.area, h: p3.h, center: p3.center, half: p3.half };
}

/**
 * Inspects coordinates and returns physical parameters if within the pipe boundaries
 */
function getProbeParameters(x, y) {
    const prof = profileAt(x);
    if (!prof) return null;

    const yT = prof.center - prof.half;
    const yB = prof.center + prof.half;
    if (y < yT || y > yB) return null;

    // Continuity: v = v1 * (A1 / A)
    const velocity = V1 * state.A1 / prof.area;
    // Bernoulli: P = P1 + ½ρ(v1² − v²) + ρg(h1 − h), with h1 = 0
    const pPa = (state.P1 * 1000.0)
        + 0.5 * RHO * (V1 * V1 - velocity * velocity)
        + RHO * G * (0 - prof.h);

    return {
        name: prof.name,
        area: prof.area,
        velocity,
        pressure: pPa / 1000.0,
        height: prof.h,
        yTop: yT,
        yBottom: yB
    };
}

// --- Main Drawing Routines ---

/**
 * Builds the pipe outline corner points from current geometry.
 */
function wallPoints() {
    const [p1, p2, p3] = pipes;
    return {
        top: [
            [0, p1.center - p1.half], [240, p1.center - p1.half],
            [340, p2.center - p2.half], [560, p2.center - p2.half],
            [660, p3.center - p3.half], [900, p3.center - p3.half]
        ],
        bottom: [
            [0, p1.center + p1.half], [240, p1.center + p1.half],
            [340, p2.center + p2.half], [560, p2.center + p2.half],
            [660, p3.center + p3.half], [900, p3.center + p3.half]
        ]
    };
}

/**
 * Draws the pipe structure, flow animation, and measurement probe HUD
 */
function draw(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000.0; // Delta time in seconds
    lastTime = timestamp;

    // 1. Clear Canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const walls = wallPoints();

    // 2. Draw Fluid Volume (Background Fill with Gradient)
    ctx.beginPath();
    walls.top.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    [...walls.bottom].reverse().forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.closePath();

    // Dynamic Gradient mirroring pressure drop
    const fluidGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
    fluidGrad.addColorStop(0.0, 'rgba(0, 195, 255, 0.18)');
    fluidGrad.addColorStop(0.26, 'rgba(0, 195, 255, 0.18)');
    fluidGrad.addColorStop(0.38, 'rgba(139, 92, 246, 0.12)'); // Low pressure/High velocity (violet color theme)
    fluidGrad.addColorStop(0.62, 'rgba(139, 92, 246, 0.12)');
    fluidGrad.addColorStop(0.73, 'rgba(0, 136, 255, 0.18)');  // Pressure recovery
    fluidGrad.addColorStop(1.0, 'rgba(0, 136, 255, 0.18)');

    ctx.fillStyle = fluidGrad;
    ctx.fill();

    // 3. Draw Flow Animation (Periodic vertical lines inside pipe segments)
    animSegments.forEach((segment, idx) => {
        // Update offset based on speed
        segment.offset = (segment.offset + segment.speed * dt) % segment.spacing;

        ctx.strokeStyle = lineGradients[idx];
        ctx.lineWidth = 1.5;

        const startI = -1;
        const endI = Math.ceil((segment.xEnd - segment.xStart) / segment.spacing) + 1;

        ctx.beginPath();
        for (let i = startI; i <= endI; i++) {
            const lineX = segment.xStart + segment.offset + i * segment.spacing;
            // Draw line only if it falls within the boundaries of the segment
            if (lineX >= segment.xStart && lineX <= segment.xEnd) {
                ctx.moveTo(lineX, segment.yTop);
                ctx.lineTo(lineX, segment.yBottom);
            }
        }
        ctx.stroke();
    });

    // 4. Draw Outer Pipe Borders (Glowing outlines, excluding open ends)
    ctx.shadowColor = 'rgba(0, 136, 255, 0.6)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(0, 136, 255, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Top Wall
    ctx.beginPath();
    walls.top.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    // Bottom Wall
    ctx.beginPath();
    walls.bottom.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    // Reset shadow for next drawings
    ctx.shadowBlur = 0;

    // 5. Draw elevation reference when the outlet is raised
    if (state.dh > 0) {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, BASE_CENTER_Y);
        ctx.lineTo(CANVAS_WIDTH, BASE_CENTER_Y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText('Δh = +' + state.dh.toFixed(1) + ' m', 780, pipes[2].center - pipes[2].half - 10);
    }

    // 6. Draw Measurement Probe crosshair if hovered inside pipe
    if (isHovered) {
        const params = getProbeParameters(mouseX, mouseY);
        if (params) {
            // Draw horizontal coordinate guideline inside the pipe
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(0, mouseY);
            ctx.lineTo(CANVAS_WIDTH, mouseY);
            ctx.stroke();

            // Draw vertical measurement slice (representing the cross-section plane)
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(mouseX, params.yTop);
            ctx.lineTo(mouseX, params.yBottom);
            ctx.stroke();

            ctx.setLineDash([]); // Reset dash

            // Draw Reticle Center Target
            ctx.strokeStyle = '#00E5FF';
            ctx.fillStyle = '#050811';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#00E5FF';
            ctx.fill();
        }
    }

    requestAnimationFrame(draw);
}

// --- Interaction & Event Handlers ---

/**
 * Updates UI cards and status indicators based on measurement probe parameters
 */
function updateReadout(params) {
    if (params) {
        // Toggle Active States
        elStatus.textContent = "PROBE ACTIVE";
        elStatus.className = "probe-active";

        // Populate card content
        elSegment.textContent = params.name;
        elArea.textContent = params.area.toFixed(1) + " cm²";
        elVelocity.textContent = params.velocity.toFixed(2) + " m/s";
        elPressure.textContent = params.pressure.toFixed(1) + " kPa";
        elHeight.textContent = params.height.toFixed(2) + " m";

        // Apply glowing/active classes to elements
        Object.keys(cards).forEach(key => {
            cards[key].classList.add('active');
        });
    } else {
        // Reset Active States
        elStatus.textContent = "Awaiting Probe Input...";
        elStatus.className = "probe-inactive";

        elSegment.textContent = "--";
        elArea.textContent = "--";
        elVelocity.textContent = "--";
        elPressure.textContent = "--";
        elHeight.textContent = "--";

        // Remove glowing/active classes
        Object.keys(cards).forEach(key => {
            cards[key].classList.remove('active');
        });
    }
}

/**
 * Reflects the current adjustable values inside the constants/preset card
 */
function updatePresetCard() {
    elPresetP1.textContent = state.P1.toFixed(0) + " kPa";
    elPresetH.textContent = state.dh === 0 ? "0 m (level)" : "+" + state.dh.toFixed(1) + " m (outlet)";
}

// Preset Button Listeners
document.querySelectorAll('.control-group').forEach(group => {
    const param = group.dataset.param;
    group.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state[param] = parseFloat(btn.dataset.value);
            rebuildGeometry();
            updatePresetCard();
            // Refresh probe readout against new geometry
            updateReadout(isHovered ? getProbeParameters(mouseX, mouseY) : null);
        });
    });
});

// Mouse Move Listener
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    // Calculate scale factor in case CSS has resized the canvas element layout
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    mouseX = (event.clientX - rect.left) * scaleX;
    mouseY = (event.clientY - rect.top) * scaleY;

    const params = getProbeParameters(mouseX, mouseY);

    if (params) {
        isHovered = true;
        canvas.style.cursor = 'none'; // Hide native cursor to let custom reticle shine
        updateReadout(params);
    } else {
        isHovered = false;
        canvas.style.cursor = 'default';
        updateReadout(null);
    }
});

// Mouse Leave Listener
canvas.addEventListener('mouseleave', () => {
    isHovered = false;
    canvas.style.cursor = 'default';
    updateReadout(null);
});

// Initialize geometry and start loop
rebuildGeometry();
updatePresetCard();
requestAnimationFrame(draw);
