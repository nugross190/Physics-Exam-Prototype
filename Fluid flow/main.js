// --- Constants and Physics Configuration ---
const D1 = 10.0; // Pipe 1 diameter in cm
const D2 = 4.0;  // Pipe 2 diameter in cm
const D3 = 8.0;  // Pipe 3 diameter in cm

const V1 = 1.0;  // Reference velocity (Pipe 1) in m/s
const P1 = 200.0; // Reference pressure (Pipe 1) in kPa
const RHO = 1000.0; // Fluid density in kg/m^3 (Water)

// Animation Scaling Factors
const SPEED_FACTOR = 40.0;   // Pixels/sec per 1 m/s of velocity
const SPACING_FACTOR = 20.0; // Pixels of spacing per 1 m/s of velocity

// Canvas Dimensions
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 400;
const Y_CENTER = 200;

// Geometry Ranges (X coordinates)
const SEGMENTS = {
    PIPE1: { start: 0, end: 240, diameter: D1, name: "Pipe 1 (Inlet)", isTransition: false },
    TRANS12: { start: 240, end: 340, dStart: D1, dEnd: D2, name: "Transition 1 → 2", isTransition: true },
    PIPE2: { start: 340, end: 560, diameter: D2, name: "Pipe 2 (Throat)", isTransition: false },
    TRANS23: { start: 560, end: 660, dStart: D2, dEnd: D3, name: "Transition 2 → 3", isTransition: true },
    PIPE3: { start: 660, end: 900, diameter: D3, name: "Pipe 3 (Outlet)", isTransition: false }
};

// --- DOM References ---
const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const elStatus = document.getElementById('probe-status');
const elSegment = document.getElementById('val-segment');
const elDiameter = document.getElementById('val-diameter');
const elVelocity = document.getElementById('val-velocity');
const elPressure = document.getElementById('val-pressure');

const cards = {
    segment: document.getElementById('card-segment'),
    diameter: document.getElementById('card-diameter'),
    velocity: document.getElementById('card-velocity'),
    pressure: document.getElementById('card-pressure')
};

// --- State Variables ---
let mouseX = -1;
let mouseY = -1;
let isHovered = false;
let lastTime = 0;

// Track independent animation offsets for each rectangular segment
const animSegments = [
    {
        xStart: SEGMENTS.PIPE1.start,
        xEnd: SEGMENTS.PIPE1.end,
        v: V1,
        spacing: V1 * SPACING_FACTOR,
        speed: V1 * SPEED_FACTOR,
        offset: 0,
        yTop: 100,
        yBottom: 300
    },
    {
        xStart: SEGMENTS.PIPE2.start,
        xEnd: SEGMENTS.PIPE2.end,
        v: V1 * Math.pow(D1 / D2, 2),
        spacing: V1 * Math.pow(D1 / D2, 2) * SPACING_FACTOR,
        speed: V1 * Math.pow(D1 / D2, 2) * SPEED_FACTOR,
        offset: 0,
        yTop: 160,
        yBottom: 240
    },
    {
        xStart: SEGMENTS.PIPE3.start,
        xEnd: SEGMENTS.PIPE3.end,
        v: V1 * Math.pow(D1 / D3, 2),
        spacing: V1 * Math.pow(D1 / D3, 2) * SPACING_FACTOR,
        speed: V1 * Math.pow(D1 / D3, 2) * SPEED_FACTOR,
        offset: 0,
        yTop: 120,
        yBottom: 280
    }
];

// --- Pre-create Gradients for Line Fading (Optimized performance) ---
const gradient1 = ctx.createLinearGradient(0, 100, 0, 300);
gradient1.addColorStop(0, 'rgba(0, 229, 255, 0)');
gradient1.addColorStop(0.15, 'rgba(0, 229, 255, 0.45)');
gradient1.addColorStop(0.85, 'rgba(0, 229, 255, 0.45)');
gradient1.addColorStop(1, 'rgba(0, 229, 255, 0)');

const gradient2 = ctx.createLinearGradient(0, 160, 0, 240);
gradient2.addColorStop(0, 'rgba(0, 229, 255, 0)');
gradient2.addColorStop(0.15, 'rgba(0, 229, 255, 0.45)');
gradient2.addColorStop(0.85, 'rgba(0, 229, 255, 0.45)');
gradient2.addColorStop(1, 'rgba(0, 229, 255, 0)');

const gradient3 = ctx.createLinearGradient(0, 120, 0, 280);
gradient3.addColorStop(0, 'rgba(0, 229, 255, 0)');
gradient3.addColorStop(0.15, 'rgba(0, 229, 255, 0.45)');
gradient3.addColorStop(0.85, 'rgba(0, 229, 255, 0.45)');
gradient3.addColorStop(1, 'rgba(0, 229, 255, 0)');

const lineGradients = [gradient1, gradient2, gradient3];

// --- Helper Functions ---

/**
 * Calculates the top y-coordinate of the pipe wall at a given x
 */
function getYTop(x) {
    if (x < 0 || x > CANVAS_WIDTH) return Y_CENTER;
    if (x < SEGMENTS.PIPE1.end) return 100;
    if (x < SEGMENTS.PIPE2.start) {
        const t = (x - SEGMENTS.PIPE1.end) / (SEGMENTS.PIPE2.start - SEGMENTS.PIPE1.end);
        return 100 + t * (160 - 100);
    }
    if (x < SEGMENTS.PIPE2.end) return 160;
    if (x < SEGMENTS.PIPE3.start) {
        const t = (x - SEGMENTS.PIPE2.end) / (SEGMENTS.PIPE3.start - SEGMENTS.PIPE2.end);
        return 160 + t * (120 - 160);
    }
    return 120;
}

/**
 * Calculates the bottom y-coordinate of the pipe wall at a given x
 */
function getYBottom(x) {
    if (x < 0 || x > CANVAS_WIDTH) return Y_CENTER;
    if (x < SEGMENTS.PIPE1.end) return 300;
    if (x < SEGMENTS.PIPE2.start) {
        const t = (x - SEGMENTS.PIPE1.end) / (SEGMENTS.PIPE2.start - SEGMENTS.PIPE1.end);
        return 300 + t * (240 - 300);
    }
    if (x < SEGMENTS.PIPE2.end) return 240;
    if (x < SEGMENTS.PIPE3.start) {
        const t = (x - SEGMENTS.PIPE2.end) / (SEGMENTS.PIPE3.start - SEGMENTS.PIPE2.end);
        return 240 + t * (280 - 240);
    }
    return 280;
}

/**
 * Inspects coordinates and returns physical parameters if within the pipe boundaries
 */
function getProbeParameters(x, y) {
    if (x < 0 || x > CANVAS_WIDTH) return null;
    
    const yT = getYTop(x);
    const yB = getYBottom(x);
    
    // Check if the coordinate is within vertical bounds
    if (y < yT || y > yB) return null;
    
    let segmentName = "";
    let diameter = 0.0;
    let velocity = 0.0;
    let pressure = 0.0;
    
    if (x >= SEGMENTS.PIPE1.start && x < SEGMENTS.PIPE1.end) {
        segmentName = SEGMENTS.PIPE1.name;
        diameter = D1;
        velocity = V1;
        pressure = P1;
    } else if (x >= SEGMENTS.TRANS12.start && x < SEGMENTS.TRANS12.end) {
        segmentName = SEGMENTS.TRANS12.name;
        const t = (x - SEGMENTS.TRANS12.start) / (SEGMENTS.TRANS12.end - SEGMENTS.TRANS12.start);
        diameter = D1 + t * (D2 - D1);
    } else if (x >= SEGMENTS.PIPE2.start && x < SEGMENTS.PIPE2.end) {
        segmentName = SEGMENTS.PIPE2.name;
        diameter = D2;
    } else if (x >= SEGMENTS.TRANS23.start && x < SEGMENTS.TRANS23.end) {
        segmentName = SEGMENTS.TRANS23.name;
        const t = (x - SEGMENTS.TRANS23.start) / (SEGMENTS.TRANS23.end - SEGMENTS.TRANS23.end); // wait, fix potential transition math
        const tCorrect = (x - SEGMENTS.TRANS23.start) / (SEGMENTS.TRANS23.end - SEGMENTS.TRANS23.start);
        diameter = D2 + tCorrect * (D3 - D2);
    } else if (x >= SEGMENTS.PIPE3.start && x <= SEGMENTS.PIPE3.end) {
        segmentName = SEGMENTS.PIPE3.name;
        diameter = D3;
    }
    
    // Calculate continuity and pressure dynamically (works for static pipes too)
    if (diameter > 0) {
        // Continuity: v = v1 * (A1 / A) = v1 * (d1 / d)^2
        velocity = V1 * Math.pow(D1 / diameter, 2);
        // Bernoulli: P = P1 + 0.5 * rho * (v1^2 - v^2)
        // Convert P from Pa to kPa.
        const pPa = (P1 * 1000.0) + 0.5 * RHO * (Math.pow(V1, 2) - Math.pow(velocity, 2));
        pressure = pPa / 1000.0;
    }
    
    return {
        name: segmentName,
        diameter,
        velocity,
        pressure,
        yTop: yT,
        yBottom: yB
    };
}

// --- Main Drawing Routines ---

/**
 * Draws the pipe structure, grid lines, flow animation, and measurement probe HUD
 */
function draw(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = (timestamp - lastTime) / 1000.0; // Delta time in seconds
    lastTime = timestamp;
    
    // 1. Clear Canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 2. Draw Fluid Volume (Background Fill with Gradient)
    ctx.beginPath();
    ctx.moveTo(0, 100);
    ctx.lineTo(240, 100);
    ctx.lineTo(340, 160);
    ctx.lineTo(560, 160);
    ctx.lineTo(660, 120);
    ctx.lineTo(900, 120);
    ctx.lineTo(900, 280);
    ctx.lineTo(660, 280);
    ctx.lineTo(560, 240);
    ctx.lineTo(340, 240);
    ctx.lineTo(240, 300);
    ctx.lineTo(0, 300);
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
    ctx.moveTo(0, 100);
    ctx.lineTo(240, 100);
    ctx.lineTo(340, 160);
    ctx.lineTo(560, 160);
    ctx.lineTo(660, 120);
    ctx.lineTo(900, 120);
    ctx.stroke();
    
    // Bottom Wall
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(240, 300);
    ctx.lineTo(340, 240);
    ctx.lineTo(560, 240);
    ctx.lineTo(660, 280);
    ctx.lineTo(900, 280);
    ctx.stroke();
    
    // Reset shadow for next drawings
    ctx.shadowBlur = 0;
    
    // 5. Draw Measurement Probe crosshair if hovered inside pipe
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
        elDiameter.textContent = params.diameter.toFixed(1) + " cm";
        elVelocity.textContent = params.velocity.toFixed(2) + " m/s";
        elPressure.textContent = params.pressure.toFixed(1) + " kPa";
        
        // Apply glowing/active classes to elements
        Object.keys(cards).forEach(key => {
            cards[key].classList.add('active');
        });
    } else {
        // Reset Active States
        elStatus.textContent = "Awaiting Probe Input...";
        elStatus.className = "probe-inactive";
        
        elSegment.textContent = "--";
        elDiameter.textContent = "--";
        elVelocity.textContent = "--";
        elPressure.textContent = "--";
        
        // Remove glowing/active classes
        Object.keys(cards).forEach(key => {
            cards[key].classList.remove('active');
        });
    }
}

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

// Start loop on load
requestAnimationFrame(draw);
