const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let originX, originY;
let pixelsPerMeter = 12.5;

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  originX = width / 2;
  originY = height / 2;
}
window.addEventListener('resize', resize);
resize();

// UI Elements
const settingsPanel = document.getElementById('settingsPanel');
const playPauseBtn = document.getElementById('playPauseBtn');
const timeline = document.getElementById('timeline');
const resetSimBtn = document.getElementById('resetSimBtn');

// HUD Elements
const valTime = document.getElementById('val-time');
const valPos = document.getElementById('val-pos');
const valVel = document.getElementById('val-vel');
const valAcc = document.getElementById('val-acc');

// Force Sliders
const sliderFUp = document.getElementById('f-up');
const sliderFDown = document.getElementById('f-down');
const sliderFLeft = document.getElementById('f-left');
const sliderFRight = document.getElementById('f-right');
const valFUp = document.getElementById('val-f-up');
const valFDown = document.getElementById('val-f-down');
const valFLeft = document.getElementById('val-f-left');
const valFRight = document.getElementById('val-f-right');

// Settings Elements
const sliderGridSize = document.getElementById('grid-size');
const valGridSize = document.getElementById('val-grid');
const togglePath = document.getElementById('show-path');
const sliderMass = document.getElementById('mass');
const valMass = document.getElementById('val-mass');

// State
let isPlaying = false;
let state = {
  time: 0,
  x: 0, y: 0,
  vx: 0, vy: 0,
  ax: 0, ay: 0,
  fUp: 0, fDown: 0, fLeft: 0, fRight: 0,
  mass: 10
};
let history = [];
let dt = 1/60; // 60 FPS fixed timestep
let playbackIndex = 0;

// Initialize
function init() {
  state = { time: 0, x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, fUp: 0, fDown: 0, fLeft: 0, fRight: 0, mass: parseFloat(sliderMass.value) };
  history = [ { ...state } ];
  playbackIndex = 0;
  timeline.min = 0;
  timeline.max = 0;
  timeline.value = 0;
  isPlaying = false;
  updatePlayPauseIcon();
  
  // reset sliders UI
  sliderFUp.value = 0; sliderFDown.value = 0; sliderFLeft.value = 0; sliderFRight.value = 0;
  updateSliderDisplays();
}

// UI Event Listeners

playPauseBtn.addEventListener('click', () => {
  isPlaying = !isPlaying;
  updatePlayPauseIcon();
});

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = isPlaying ? '<i class="ph ph-pause"></i>' : '<i class="ph ph-play"></i>';
}

timeline.addEventListener('input', (e) => {
  isPlaying = false;
  updatePlayPauseIcon();
  playbackIndex = parseInt(e.target.value);
  loadStateFromHistory(playbackIndex);
});

resetSimBtn.addEventListener('click', init);

const sliders = [
  { el: sliderFUp, valEl: valFUp },
  { el: sliderFDown, valEl: valFDown },
  { el: sliderFLeft, valEl: valFLeft },
  { el: sliderFRight, valEl: valFRight },
  { el: sliderGridSize, valEl: valGridSize },
  { el: sliderMass, valEl: valMass }
];

sliders.forEach(s => {
  s.el.addEventListener('input', () => {
    s.valEl.textContent = s.el.value;
    if (!isPlaying && s.el !== sliderGridSize && s.el !== sliderMass) {
      state.fUp = parseFloat(sliderFUp.value);
      state.fDown = parseFloat(sliderFDown.value);
      state.fLeft = parseFloat(sliderFLeft.value);
      state.fRight = parseFloat(sliderFRight.value);
      render(); // force render to update force arrows immediately
    }
  });
});

function updateSliderDisplays() {
  valFUp.textContent = sliderFUp.value;
  valFDown.textContent = sliderFDown.value;
  valFLeft.textContent = sliderFLeft.value;
  valFRight.textContent = sliderFRight.value;
  valMass.textContent = sliderMass.value;
}

function loadStateFromHistory(index) {
  if (index >= 0 && index < history.length) {
    state = { ...history[index] };
    sliderFUp.value = state.fUp;
    sliderFDown.value = state.fDown;
    sliderFLeft.value = state.fLeft;
    sliderFRight.value = state.fRight;
    if (state.mass) sliderMass.value = state.mass;
    updateSliderDisplays();
  }
}

// Simulation Loop
let lastTime = performance.now();

function update(currentTime) {
  let realDeltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (isPlaying) {
    // If playing from a past state, truncate future history
    if (playbackIndex < history.length - 1) {
      history = history.slice(0, playbackIndex + 1);
    }

    state.fUp = parseFloat(sliderFUp.value);
    state.fDown = parseFloat(sliderFDown.value);
    state.fLeft = parseFloat(sliderFLeft.value);
    state.fRight = parseFloat(sliderFRight.value);
    state.mass = parseFloat(sliderMass.value);

    // Physics Newton 2nd Law: F = m*a
    let Fx = state.fRight - state.fLeft;
    let Fy = state.fUp - state.fDown;

    state.ax = Fx / state.mass;
    state.ay = Fy / state.mass;

    state.vx += state.ax * dt;
    state.vy += state.ay * dt;

    state.x += state.vx * dt;
    state.y += state.vy * dt;
    state.time += dt;

    history.push({ ...state });
    playbackIndex = history.length - 1;
    
    timeline.max = playbackIndex;
    timeline.value = playbackIndex;
  }

  render();
  updateHUD();

  requestAnimationFrame(update);
}

function updateHUD() {
  valTime.textContent = state.time.toFixed(1);
  valPos.textContent = `${state.x.toFixed(1)}, ${state.y.toFixed(1)}`;
  
  let speed = Math.sqrt(state.vx**2 + state.vy**2);
  valVel.textContent = speed.toFixed(2);
  
  let acc = Math.sqrt(state.ax**2 + state.ay**2);
  valAcc.textContent = acc.toFixed(2);
}

function render() {
  ctx.clearRect(0, 0, width, height);
  
  // Draw Grid
  let gridSizeMeters = parseFloat(sliderGridSize.value);
  let gridSizePx = gridSizeMeters * pixelsPerMeter;
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  
  let startX = (originX % gridSizePx + gridSizePx) % gridSizePx;
  for (let x = startX; x < width; x += gridSizePx) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  let startY = (originY % gridSizePx + gridSizePx) % gridSizePx;
  for (let y = startY; y < height; y += gridSizePx) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  
  // Draw Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, originY); ctx.lineTo(width, originY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(originX, 0); ctx.lineTo(originX, height); ctx.stroke();

  // Draw Path as dots (one per frame)
  if (togglePath.checked && history.length > 1) {
    for (let i = 0; i <= playbackIndex; i++) {
      // Draw a dot every 8 frames, plus always the latest position
      if (i % 8 !== 0 && i !== playbackIndex) continue;

      let h = history[i];
      let dpx = originX + h.x * pixelsPerMeter;
      let dpy = originY - h.y * pixelsPerMeter; // Y inverted

      // Fade older dots slightly
      let alpha = 0.3 + 0.7 * (i / playbackIndex);
      ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
      ctx.beginPath();
      ctx.arc(dpx, dpy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Particle
  let px = originX + state.x * pixelsPerMeter;
  let py = originY - state.y * pixelsPerMeter;
  
  ctx.fillStyle = '#f8fafc';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(px, py, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0; 
  
  // Draw Force Vectors (Scale visually)
  drawArrow(px, py, px, py - state.fUp * 3, '#10b981'); // Up (Green)
  drawArrow(px, py, px, py + state.fDown * 3, '#ef4444'); // Down (Red)
  drawArrow(px, py, px - state.fLeft * 3, py, '#f59e0b'); // Left (Orange)
  drawArrow(px, py, px + state.fRight * 3, py, '#a855f7'); // Right (Purple)
}

function drawArrow(fromX, fromY, toX, toY, color) {
  if (fromX === toX && fromY === toY) return;
  const headlen = 10;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.lineTo(toX, toY);
  ctx.fill();
}

// Start
init();
requestAnimationFrame(update);
