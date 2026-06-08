const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let cx, cy; // Center of propeller rotation
let px_pulley, py_pulley; // Pulley center position
let ground_y; // Floor level position

const g = 9.8; // Acceleration due to gravity (m/s^2)
const axle_scale = 120; // Pixels per meter for the axle radius
const blade_scale = 150; // Pixels per meter for the blade length

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  
  // Propeller is slightly left-of-center to balance the weight on the right
  cx = width * 0.42;
  cy = height * 0.55;
  
  // Pulley is located on the right side
  px_pulley = width * 0.78;
  
  // Recalculate positions based on active radius
  const currentRadius = state ? state.r : 0.1;
  const axle_radius_px = currentRadius * axle_scale;
  py_pulley = cy - axle_radius_px + 16; // 16 is pulley radius
  
  ground_y = height - 120;
  
  render();
}

// UI Elements
const sliderMass = document.getElementById('mass');
const sliderRadius = document.getElementById('radius');
const sliderBladeMass = document.getElementById('blade-mass');
const sliderBladeLength = document.getElementById('blade-length');

const valMass = document.getElementById('val-mass');
const valRadius = document.getElementById('val-radius');
const valBladeMass = document.getElementById('val-blade-mass');
const valBladeLength = document.getElementById('val-blade-length');

const playPauseBtn = document.getElementById('playPauseBtn');
const timeline = document.getElementById('timeline');
const resetSimBtn = document.getElementById('resetSimBtn');

const phaseBadge = document.getElementById('phase-badge');
const actionPrompt = document.getElementById('action-prompt');
const toastCue = document.getElementById('toast-cue');

// HUD Elements
const valTime = document.getElementById('val-time');
const valHeight = document.getElementById('val-height');
const valTorque = document.getElementById('val-torque');
const valInertia = document.getElementById('val-inertia');
const valAlpha = document.getElementById('val-alpha');
const valOmega = document.getElementById('val-omega');
const valTheta = document.getElementById('val-theta');
const valMomentum = document.getElementById('val-momentum');

// Simulation State
let isPlaying = false;
let state = {
  time: 0,
  phase: 1,
  m: 10.0,
  r: 0.1,
  L: 1.0,
  mb: 2.0,
  tau: 0,
  I: 0,
  alpha: 0,
  omega: 0,
  theta: 0,
  rope_unwound: 0,
  mass_height: 3.0,
  phase2Timer: 0,
  L_conserved: 0
};

let history = [];
let dt = 1/60; // Fixed timestep (60 FPS)
let playbackIndex = 0;
let lastPhase = 1;

// Initialize Simulation
function init() {
  const initM = parseFloat(sliderMass.value);
  const initR = parseFloat(sliderRadius.value);
  const initMb = parseFloat(sliderBladeMass.value);
  const initL = parseFloat(sliderBladeLength.value);

  // Initial calculations
  const tau = initM * g * initR;
  const I = 2 * initMb * (initL ** 2);
  const alpha = tau / I;

  state = {
    time: 0,
    phase: 1,
    m: initM,
    r: initR,
    L: initL,
    mb: initMb,
    tau: tau,
    I: I,
    alpha: alpha,
    omega: 0,
    theta: 0,
    rope_unwound: 0,
    mass_height: 3.0,
    phase2Timer: 0,
    L_conserved: 0
  };

  history = [{ ...state }];
  playbackIndex = 0;
  lastPhase = 1;
  
  timeline.min = 0;
  timeline.max = 0;
  timeline.value = 0;
  isPlaying = false;

  // Reset toast cue
  toastCue.classList.add('hidden');
  
  updatePlayPauseIcon();
  updateSliderDisplays();
  updateSliderLockStates();
  updateHUDVisibility();
  
  // Set pulley position
  const axle_radius_px = state.r * axle_scale;
  py_pulley = cy - axle_radius_px + 16;

  render();
  updateHUD();
}

// Play / Pause Control
playPauseBtn.addEventListener('click', () => {
  isPlaying = !isPlaying;
  updatePlayPauseIcon();
});

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = isPlaying ? '<i class="ph ph-pause"></i>' : '<i class="ph ph-play"></i>';
}

// Reset Control
resetSimBtn.addEventListener('click', init);

// Timeline Scrubbing
timeline.addEventListener('input', (e) => {
  isPlaying = false;
  updatePlayPauseIcon();
  playbackIndex = parseInt(e.target.value);
  loadStateFromHistory(playbackIndex);
});

// Load state from history frame
function loadStateFromHistory(index) {
  if (index >= 0 && index < history.length) {
    state = { ...history[index] };
    
    // Update inputs to match historical values
    sliderMass.value = state.m;
    sliderRadius.value = state.r;
    sliderBladeMass.value = state.mb;
    sliderBladeLength.value = state.L;

    updateSliderDisplays();
    updateSliderLockStates();
    updateHUDVisibility();
    updatePhaseIndicators();

    // Recalculate pulley height based on historical radius
    const axle_radius_px = state.r * axle_scale;
    py_pulley = cy - axle_radius_px + 16;

    render();
    updateHUD();
  }
}

// Slide control listeners
const sliders = [
  { el: sliderMass, valEl: valMass, id: 'mass' },
  { el: sliderRadius, valEl: valRadius, id: 'radius' },
  { el: sliderBladeMass, valEl: valBladeMass, id: 'blade-mass' },
  { el: sliderBladeLength, valEl: valBladeLength, id: 'blade-length' }
];

sliders.forEach(s => {
  s.el.addEventListener('input', () => {
    updateSliderDisplays();
    onSliderInput(s.id);
  });
});

function updateSliderDisplays() {
  valMass.textContent = sliderMass.value;
  valRadius.textContent = parseFloat(sliderRadius.value).toFixed(2);
  valBladeMass.textContent = parseFloat(sliderBladeMass.value).toFixed(1);
  valBladeLength.textContent = parseFloat(sliderBladeLength.value).toFixed(2);
}

// Handle real-time slider manipulation
function onSliderInput(sliderId) {
  if (state.phase === 1 && playbackIndex === 0) {
    // Modify initial setup state
    state.m = parseFloat(sliderMass.value);
    state.r = parseFloat(sliderRadius.value);
    state.mb = parseFloat(sliderBladeMass.value);
    
    state.tau = state.m * g * state.r;
    state.I = 2 * state.mb * (state.L ** 2);
    state.alpha = state.tau / state.I;

    // Recalculate pulley height
    const axle_radius_px = state.r * axle_scale;
    py_pulley = cy - axle_radius_px + 16;
    
    history[0] = { ...state };
  } else if (state.phase === 1 && !isPlaying) {
    // Paused in Phase 1: allow parameter tweaking and re-simulate forward
    state.m = parseFloat(sliderMass.value);
    state.r = parseFloat(sliderRadius.value);
    state.mb = parseFloat(sliderBladeMass.value);
    
    state.tau = state.m * g * state.r;
    state.I = 2 * state.mb * (state.L ** 2);
    state.alpha = state.tau / state.I;

    // Recalculate pulley height
    const axle_radius_px = state.r * axle_scale;
    py_pulley = cy - axle_radius_px + 16;

    history = history.slice(0, playbackIndex + 1);
    history[playbackIndex] = { ...state };
  } else if (state.phase === 3 && !isPlaying) {
    // Paused in Phase 3: allow dragging L and immediately recalculating omega
    state.L = parseFloat(sliderBladeLength.value);
    state.I = 2 * state.mb * (state.L ** 2);
    state.omega = state.L_conserved / state.I;
    
    history = history.slice(0, playbackIndex + 1);
    history[playbackIndex] = { ...state };
  }
  
  render();
  updateHUD();
}

// Lock/unlock sliders based on current phase
function updateSliderLockStates() {
  const p = state.phase;

  const groupMass = sliderMass.closest('.setting-group');
  const groupRadius = sliderRadius.closest('.setting-group');
  const groupBladeMass = sliderBladeMass.closest('.setting-group');
  const groupBladeLength = sliderBladeLength.closest('.setting-group');

  if (p === 1) {
    sliderMass.disabled = false;
    groupMass.classList.remove('locked');
    
    sliderRadius.disabled = false;
    groupRadius.classList.remove('locked');
    
    sliderBladeMass.disabled = false;
    groupBladeMass.classList.remove('locked');
    
    sliderBladeLength.disabled = true;
    groupBladeLength.classList.add('locked');
  } else if (p === 2) {
    sliderMass.disabled = true;
    groupMass.classList.add('locked');
    
    sliderRadius.disabled = true;
    groupRadius.classList.add('locked');
    
    sliderBladeMass.disabled = true;
    groupBladeMass.classList.add('locked');
    
    sliderBladeLength.disabled = true;
    groupBladeLength.classList.add('locked');
  } else if (p === 3) {
    sliderMass.disabled = true;
    groupMass.classList.add('locked');
    
    sliderRadius.disabled = true;
    groupRadius.classList.add('locked');
    
    sliderBladeMass.disabled = true;
    groupBladeMass.classList.add('locked');
    
    sliderBladeLength.disabled = false;
    groupBladeLength.classList.remove('locked');
  }
}

// Hide or fade HUD items based on relevance in current phase
function updateHUDVisibility() {
  const p = state.phase;
  
  document.getElementById('hud-height').className = (p === 1) ? 'hud-item' : 'hud-item hidden-data';
  document.getElementById('hud-torque').className = (p === 1) ? 'hud-item' : 'hud-item hidden-data';
  document.getElementById('hud-inertia').className = (p === 1 || p === 3) ? 'hud-item' : 'hud-item hidden-data';
  document.getElementById('hud-alpha').className = (p === 1) ? 'hud-item' : 'hud-item hidden-data';
  document.getElementById('hud-omega').className = 'hud-item';
  document.getElementById('hud-theta').className = 'hud-item';
  document.getElementById('hud-momentum').className = (p === 3) ? 'hud-item' : 'hud-item hidden-data';
}

// Update phase badge and action prompts
function updatePhaseIndicators() {
  const p = state.phase;
  
  if (p === 1) {
    phaseBadge.textContent = "Fase 1: Torsi";
    phaseBadge.className = "phase-badge phase-1";
    actionPrompt.classList.add('hidden');
  } else if (p === 2) {
    phaseBadge.textContent = "Fase 2: Layap";
    phaseBadge.className = "phase-badge phase-2";
    actionPrompt.classList.add('hidden');
  } else if (p === 3) {
    phaseBadge.textContent = "Fase 3: Kekekalan L";
    phaseBadge.className = "phase-badge phase-3";
    actionPrompt.classList.remove('hidden');
  }
}

// Show a brief glowing toast cue in the center
function triggerToastCue() {
  toastCue.classList.remove('hidden');
  toastCue.style.animation = 'none';
  toastCue.offsetHeight; // force reflow
  toastCue.style.animation = 'pop-fade 1.5s forwards ease-out';
  
  setTimeout(() => {
    // Check if we are still in phase 2 before hiding
    if (state.phase !== 2) {
      toastCue.classList.add('hidden');
    }
  }, 1500);
}

// Simulation Main Physics Loop
let lastFrameTime = performance.now();

function update(currentTime) {
  // Compute frame duration in case of lags, though physics uses fixed dt
  let realDeltaTime = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;

  if (isPlaying) {
    // Truncate future history if playing from a scrubbed past point
    if (playbackIndex < history.length - 1) {
      history = history.slice(0, playbackIndex + 1);
    }

    // Read values of sliders that are unlocked in their respective phases
    if (state.phase === 1) {
      state.m = parseFloat(sliderMass.value);
      state.r = parseFloat(sliderRadius.value);
      state.mb = parseFloat(sliderBladeMass.value);
      // L is locked
    } else if (state.phase === 3) {
      state.L = parseFloat(sliderBladeLength.value);
      // m, r, mb are locked
    }

    // ── Three-Phase Physics ──
    if (state.phase === 1) {
      state.tau = state.m * g * state.r;
      state.I = 2 * state.mb * (state.L ** 2);
      state.alpha = state.tau / state.I;
      
      state.omega += state.alpha * dt;
      state.theta += state.omega * dt;
      
      state.rope_unwound += state.omega * state.r * dt;
      state.mass_height = Math.max(0, 3.0 - state.rope_unwound);

      // Phase transition condition: rope fully unwound (mass hits ground)
      if (state.rope_unwound >= 3.0) {
        state.rope_unwound = 3.0;
        state.mass_height = 0.0;
        state.phase = 2;
        state.phase2Timer = 0.0;
        state.tau = 0;
        state.alpha = 0;
      }
    } 
    else if (state.phase === 2) {
      state.tau = 0;
      state.alpha = 0;
      // omega holds constant (coasting)
      state.theta += state.omega * dt;
      
      state.phase2Timer += dt;
      state.mass_height = 0.0;
      state.rope_unwound = 3.0;

      // Phase transition condition: 1.5 seconds timer
      if (state.phase2Timer >= 1.5) {
        state.phase = 3;
        state.L_conserved = state.I * state.omega;
      }
    } 
    else if (state.phase === 3) {
      state.tau = 0;
      state.alpha = 0;
      state.mass_height = 0.0;
      state.rope_unwound = 3.0;

      // Moment of inertia updates live from length L slider
      state.I = 2 * state.mb * (state.L ** 2);
      
      // Conservation of angular momentum: omega = L_conserved / I_current
      if (state.I > 0) {
        state.omega = state.L_conserved / state.I;
      } else {
        state.omega = 0;
      }
      state.theta += state.omega * dt;
    }

    state.time += dt;

    // Trigger state transition indicator cues
    if (state.phase !== lastPhase) {
      if (state.phase === 2) {
        triggerToastCue();
      }
      updateSliderLockStates();
      updateHUDVisibility();
      updatePhaseIndicators();
      lastPhase = state.phase;
    }

    // Save to history list
    history.push({ ...state });
    playbackIndex = history.length - 1;
    
    timeline.max = playbackIndex;
    timeline.value = playbackIndex;
    
    updateHUD();
  }

  // Render frame
  render();

  requestAnimationFrame(update);
}

// Update HUD texts
function updateHUD() {
  valTime.textContent = state.time.toFixed(1);
  valHeight.textContent = state.mass_height.toFixed(2);
  valTorque.textContent = state.tau.toFixed(2);
  valInertia.textContent = state.I.toFixed(3);
  valAlpha.textContent = state.alpha.toFixed(2);
  valOmega.textContent = state.omega.toFixed(2);
  valTheta.textContent = state.theta.toFixed(2);
  valMomentum.textContent = state.L_conserved.toFixed(3);
}

// Render simulation canvas
function render() {
  ctx.clearRect(0, 0, width, height);

  // 1. Draw polar-coordinate background grid (concentric circles + dashed axes)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '10px monospace';
  ctx.lineWidth = 1;

  // Radial guidelines representing blade lengths (0.5m, 1.0m, 1.5m, 2.0m)
  const gridRadii = [0.5, 1.0, 1.5, 2.0];
  gridRadii.forEach(r => {
    const radiusPx = r * blade_scale;
    ctx.beginPath();
    ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    
    // Label on the horizontal axis
    ctx.fillText(`${r.toFixed(1)}m`, cx + radiusPx - 10, cy - 6);
  });

  // Intersecting horizontal and vertical dashed axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - 320, cy); ctx.lineTo(cx + 320, cy);
  ctx.moveTo(cx, cy - 320); ctx.lineTo(cx, cy + 320);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // 2. Draw Floor Ground
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px_pulley - 80, ground_y);
  ctx.lineTo(px_pulley + 80, ground_y);
  ctx.stroke();

  // Ground patterns (stripes)
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  for (let x = px_pulley - 75; x < px_pulley + 80; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, ground_y);
    ctx.lineTo(x - 5, ground_y + 8);
    ctx.stroke();
  }

  // 3. Draw Pulley support bracket and wheel
  ctx.strokeStyle = '#4b5563';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px_pulley, py_pulley);
  ctx.lineTo(px_pulley, py_pulley - 40); // Bracket going up
  ctx.stroke();

  // Pulley wheel rim
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px_pulley, py_pulley, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pulley center bolt
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(px_pulley, py_pulley, 4, 0, Math.PI * 2);
  ctx.fill();

  // Pulley rotating spokes
  const pulley_theta = state.rope_unwound / 0.05; // angle proportional to unwinding
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
    ctx.beginPath();
    ctx.moveTo(px_pulley, py_pulley);
    ctx.lineTo(px_pulley + 14 * Math.cos(pulley_theta + a), py_pulley + 14 * Math.sin(pulley_theta + a));
    ctx.stroke();
  }

  // 4. Draw Rope Connections
  // Dynamic wrapped rope coils
  const axle_radius_px = state.r * axle_scale;
  const num_coils = Math.ceil(6 * (3.0 - state.rope_unwound) / 3.0);
  
  ctx.strokeStyle = '#b45309'; // Golden brown rope color
  ctx.lineWidth = 2.5;

  if (num_coils > 0) {
    for (let i = 0; i < num_coils; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, axle_radius_px + 2 + i * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Horizontal rope: from top of axle coils to top tangent of pulley
  const ropeStartOffset = num_coils > 0 ? num_coils * 2.5 : 0;
  ctx.beginPath();
  ctx.moveTo(cx, cy - axle_radius_px - ropeStartOffset);
  ctx.lineTo(px_pulley, py_pulley - 16);
  ctx.stroke();

  // Vertical rope: from right tangent of pulley to hanging mass hook
  const mass_width = 44;
  const mass_height = 48;
  const travel_limit = ground_y - py_pulley - mass_height - 20;
  // Hook position
  const mass_y = py_pulley + 20 + (3.0 - state.mass_height) / 3.0 * travel_limit;
  
  const verticalRopeX = px_pulley + 16;
  const verticalRopeStartY = py_pulley;

  if (state.mass_height > 0) {
    // Taut straight vertical rope
    ctx.beginPath();
    ctx.moveTo(verticalRopeX, verticalRopeStartY);
    ctx.lineTo(verticalRopeX, mass_y);
    ctx.stroke();
  } else {
    // Slack rope: draw a loose curve sagging to the right
    ctx.beginPath();
    ctx.moveTo(verticalRopeX, verticalRopeStartY);
    // Control point of quadratic bezier curve is shifted right
    const ctrlX = verticalRopeX + 22;
    const ctrlY = (verticalRopeStartY + mass_y) / 2;
    ctx.quadraticCurveTo(ctrlX, ctrlY, verticalRopeX, mass_y);
    ctx.stroke();
  }

  // 5. Draw Hanging Mass Block
  // Mass top hook
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(verticalRopeX, mass_y + 6, 6, -Math.PI, 0);
  ctx.stroke();

  // Mass body (laboratory hook-weight shape)
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  
  const blockTopY = mass_y + 12;
  const blockBottomY = blockTopY + mass_height - 12;
  
  ctx.beginPath();
  ctx.moveTo(verticalRopeX - mass_width / 2 + 6, blockTopY);
  ctx.lineTo(verticalRopeX + mass_width / 2 - 6, blockTopY);
  ctx.lineTo(verticalRopeX + mass_width / 2, blockBottomY);
  ctx.lineTo(verticalRopeX - mass_width / 2, blockBottomY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Weight text labels
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 10px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`${state.m.toFixed(1)} kg`, verticalRopeX, blockTopY + 22);

  // 6. Draw Propeller (axle hub gandar + blades)
  // Propeller Blades (two opposing arms)
  const L_px = state.L * blade_scale;
  const theta = state.theta;

  // Tracker Blade (coloured amber/orange)
  const tipX1 = cx + L_px * Math.cos(theta);
  const tipY1 = cy + L_px * Math.sin(theta);
  
  // Shadow and shaft background (thick)
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX1, tipY1); ctx.stroke();
  
  // Main shaft line
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX1, tipY1); ctx.stroke();

  // Tracker Blade tip mass (ball size relative to mb)
  const tipRadius = 9 + state.mb * 3;
  
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(tipX1, tipY1, tipRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; // Reset shadow

  ctx.fillStyle = '#fef08a'; // Glowing core
  ctx.beginPath();
  ctx.arc(tipX1, tipY1, tipRadius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Opposing Blade (coloured white/slate)
  const tipX2 = cx + L_px * Math.cos(theta + Math.PI);
  const tipY2 = cy + L_px * Math.sin(theta + Math.PI);

  // Shaft background
  ctx.strokeStyle = 'rgba(209, 213, 219, 0.12)';
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX2, tipY2); ctx.stroke();

  // Main shaft
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX2, tipY2); ctx.stroke();

  // Blade 2 tip mass
  ctx.shadowColor = '#d1d5db';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#d1d5db';
  ctx.beginPath();
  ctx.arc(tipX2, tipY2, tipRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#f9fafb';
  ctx.beginPath();
  ctx.arc(tipX2, tipY2, tipRadius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Live length text near tracker blade tip
  if (state.phase === 3) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(`L = ${state.L.toFixed(2)}m`, tipX1 + tipRadius + 5, tipY1 + 4);
  }

  // 7. Draw Axle Hub (Gandar) - drawn on top of blades center join
  // Metallic hub circles
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, axle_radius_px, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(4, axle_radius_px * 0.5), 0, Math.PI * 2);
  ctx.fill();

  // Hub rotation mark (to visualize spin when radius is large)
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + axle_radius_px * Math.cos(theta), cy + axle_radius_px * Math.sin(theta));
  ctx.stroke();

  // Shiny center screwcap
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Attach window resizing
window.addEventListener('resize', resize);

// Kick off simulation
init();
resize();
requestAnimationFrame(update);
