// ─────────────────────────────────────────
//  Skribbl – Canvas Drawing Engine
// ─────────────────────────────────────────

/** Drawing palette colours */
const PAL = [
  '#111111','#ffffff','#888888','#c0c0c0',
  '#e53e3e','#ff7a30','#f6c90e','#22c55e',
  '#2979ff','#7c3aed','#ec4899','#795548',
  '#00bcd4','#ff5722','#4caf50','#9c27b0',
];

/** Default brush sizes per tool */
const TOOL_SIZES = { pen: 4, brush: 14, pencil: 2, eraser: 26 };

// ── helpers ──────────────────────────────
function cv()  { return document.getElementById('g-canvas'); }
function ctx() { return cv().getContext('2d'); }

/**
 * Get canvas-space coordinates from a mouse or touch event.
 * @param {MouseEvent|TouchEvent} e
 * @returns {{x: number, y: number}}
 */
function getPos(e) {
  const c = cv(), r = c.getBoundingClientRect();
  const sx = c.width / r.width, sy = c.height / r.height;
  if (e.touches) {
    const t = e.touches[0];
    return { x: (t.clientX - r.left) * sx, y: (t.clientY - r.top) * sy };
  }
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}

// ── canvas init ───────────────────────────
function initCanvas() {
  if (G.ready) return;
  G.ready = true;
  const c = cv(), x = ctx();
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);

  c.onmousedown  = e => onDown(e);
  c.onmousemove  = e => onMove(e);
  c.onmouseup    = e => onUp(e);
  c.onmouseleave = e => onUp(e);
  c.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive: false });
  c.addEventListener('touchmove',  e => { e.preventDefault(); onMove(e); }, { passive: false });
  c.addEventListener('touchend',   e => { e.preventDefault(); onUp(e);   }, { passive: false });
}

// ── pointer events ────────────────────────
function onDown(e) {
  const { x, y } = getPos(e);
  if (G.tool === 'fill') { flood(Math.round(x), Math.round(y), G.color); return; }

  G.painting = true;

  if (['pen','brush','pencil','eraser'].includes(G.tool)) {
    const col = G.tool === 'eraser' ? '#ffffff' : G.color;
    const sz  = G.tool === 'eraser' ? Math.max(G.size * 2, 20) : G.size;
    G.strokes.push({ type: 'pen', color: col, size: sz, alpha: G.tool === 'pencil' ? 0.5 : 1, points: [{ x, y }] });
    const c = ctx();
    c.beginPath();
    c.moveTo(x, y);
  } else {
    G.shapeStart = { x, y };
    G.snap = ctx().getImageData(0, 0, cv().width, cv().height);
  }
}

function onMove(e) {
  if (!G.painting) return;
  const { x, y } = getPos(e);

  if (['pen','brush','pencil','eraser'].includes(G.tool)) {
    const s = G.strokes[G.strokes.length - 1];
    if (!s) return;
    s.points.push({ x, y });
    const c = ctx();
    c.globalAlpha = s.alpha;
    c.lineTo(x, y);
    c.strokeStyle = s.color;
    c.lineWidth   = s.size;
    c.lineCap     = 'round';
    c.lineJoin    = 'round';
    c.stroke();
    c.globalAlpha = 1;
  } else if (G.shapeStart && G.snap) {
    ctx().putImageData(G.snap, 0, 0);
    drawShape(ctx(), G.tool, G.shapeStart.x, G.shapeStart.y, x, y, G.color, G.size, G.fillShapes);
  }
}

function onUp(e) {
  if (!G.painting) return;

  if (['pen','brush','pencil','eraser'].includes(G.tool)) {
    G.painting = false;
    ctx().beginPath();
    ctx().globalAlpha = 1;
    const stroke = G.strokes[G.strokes.length - 1];
    if (stroke) broadcastEvent('stroke', { stroke });
  } else if (G.shapeStart && G.snap) {
    const pos = e.type === 'touchend' ? G.shapeStart : getPos(e);
    ctx().putImageData(G.snap, 0, 0);
    drawShape(ctx(), G.tool, G.shapeStart.x, G.shapeStart.y, pos.x, pos.y, G.color, G.size, G.fillShapes);
    G.strokes.push({
      type: 'shape', kind: G.tool,
      x1: G.shapeStart.x, y1: G.shapeStart.y,
      x2: pos.x, y2: pos.y,
      color: G.color, size: G.size, filled: G.fillShapes,
    });
    broadcastEvent('stroke', { stroke: G.strokes[G.strokes.length - 1] });
    G.shapeStart = null;
    G.snap       = null;
    G.painting   = false;
  }
}

// ── shape renderer ────────────────────────
/**
 * Draw a shape onto a canvas context.
 */
function drawShape(c, kind, x1, y1, x2, y2, col, sz, filled) {
  c.strokeStyle = col;
  c.fillStyle   = col;
  c.lineWidth   = sz;
  c.lineCap     = 'round';
  c.lineJoin    = 'round';
  c.beginPath();

  if (kind === 'rect') {
    c.rect(x1, y1, x2 - x1, y2 - y1);
  } else if (kind === 'circle') {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    c.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
  } else if (kind === 'line') {
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
  }

  if (filled && kind !== 'line') c.fill();
  c.stroke();
}

// ── full redraw ───────────────────────────
function redraw() {
  const c = cv(), x = ctx();
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);

  G.strokes.forEach(s => {
    if (s.type === 'pen') {
      if (!s.points.length) return;
      x.globalAlpha = s.alpha || 1;
      x.beginPath();
      x.strokeStyle = s.color;
      x.lineWidth   = s.size;
      x.lineCap     = 'round';
      x.lineJoin    = 'round';
      x.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) x.lineTo(s.points[i].x, s.points[i].y);
      x.stroke();
      x.globalAlpha = 1;
    } else if (s.type === 'shape') {
      drawShape(x, s.kind, s.x1, s.y1, s.x2, s.y2, s.color, s.size, s.filled);
    } else if (s.type === 'fill') {
      x.putImageData(s.img, 0, 0);
    }
  });
}

// ── clear / undo ──────────────────────────
function clearCanvas(broadcast = true) {
  G.strokes = [];
  const c = cv(), x = ctx();
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  if (broadcast) broadcastEvent('canvas-clear');
}

function undoStroke(broadcast = true) {
  if (G.strokes.length) {
    G.strokes.pop();
    redraw();
    if (broadcast) broadcastEvent('canvas-undo');
  }
}

function applyRemoteStroke(stroke) {
  if (!stroke || !stroke.type) return;
  G.strokes.push(stroke);
  redraw();
}

// ── flood fill ────────────────────────────
/**
 * Flood-fill from pixel (sx, sy) with fillColor.
 */
function flood(sx, sy, fillColor) {
  const c = cv(), x = ctx(), w = c.width, h = c.height;
  const img = x.getImageData(0, 0, w, h);
  const d   = img.data;
  const i0  = (sy * w + sx) * 4;
  const sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2], sa = d[i0 + 3];
  const fc = hexToRgb(fillColor);
  if (!fc) return;
  if (sr === fc.r && sg === fc.g && sb === fc.b) return;

  const stack = [sx + sy * w];
  const vis   = new Uint8Array(w * h);
  vis[sx + sy * w] = 1;

  function match(i) { return d[i] === sr && d[i+1] === sg && d[i+2] === sb && d[i+3] === sa; }
  function set(i)   { d[i] = fc.r; d[i+1] = fc.g; d[i+2] = fc.b; d[i+3] = 255; }

  while (stack.length) {
    const p = stack.pop(), px = p % w, py = Math.floor(p / w), pi = p * 4;
    if (!match(pi)) continue;
    set(pi);
    [[px-1,py],[px+1,py],[px,py-1],[px,py+1]].forEach(([nx, ny]) => {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const np = nx + ny * w;
        if (!vis[np]) { vis[np] = 1; stack.push(np); }
      }
    });
  }

  x.putImageData(img, 0, 0);
  G.strokes.push({ type: 'fill', img: x.getImageData(0, 0, w, h) });
}

/**
 * Convert a 6-digit hex string to { r, g, b }.
 * @param {string} hex
 * @returns {{r:number, g:number, b:number}|null}
 */
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ── tool selector UI ─────────────────────
function setTool(t) {
  G.tool = t;
  G.shapeStart = null;
  G.snap       = null;
  document.querySelectorAll('.tbig').forEach(b => b.classList.remove('atool'));
  const btn = document.getElementById('tl-' + t);
  if (btn) btn.classList.add('atool');
  if (TOOL_SIZES[t]) {
    G.size = TOOL_SIZES[t];
    const sl = document.getElementById('c-size');
    if (sl) { sl.value = G.size; document.getElementById('c-sv').textContent = G.size; }
  }
}

// ── palette UI ───────────────────────────
function buildPalette() {
  const row = document.getElementById('pal-row');
  row.innerHTML = '';
  PAL.forEach(c => {
    const d = document.createElement('div');
    d.className = 'csw' + (c === G.color ? ' ac' : '');
    d.style.cssText = `background:${c};${c === '#ffffff' ? 'outline:1px solid rgba(255,255,255,0.5)' : ''}`;
    d.onclick = () => {
      G.color = c;
      if (G.tool === 'eraser') setTool('pen');
      document.querySelectorAll('.csw').forEach(x => x.classList.remove('ac'));
      d.classList.add('ac');
    };
    row.appendChild(d);
  });

  document.getElementById('c-custom').oninput = e => {
    G.color = e.target.value;
    if (G.tool === 'eraser') setTool('pen');
    document.querySelectorAll('.csw').forEach(x => x.classList.remove('ac'));
  };

  document.getElementById('c-size').oninput = e => {
    G.size = +e.target.value;
    document.getElementById('c-sv').textContent = e.target.value;
  };

  document.getElementById('fill-chk').onchange = e => {
    G.fillShapes = e.target.checked;
  };
}
