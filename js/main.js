// ─────────────────────────────────────────
//  Skribbl – Main Entry Point
//  Initialises global state, home/lobby
//  screens, and wires up event listeners.
// ─────────────────────────────────────────

/**
 * Global game state.
 * All modules read/write this object.
 */
const G = {
  // player
  name:   '',
  avatar: 'avatar-0',
  room:   '',
  isHost: true,

  // game
  players:    [],
  drawer:     0,       // index of drawer in G.players
  word:       '',
  round:      1,
  maxRounds:  3,
  roundTime:  60,
  timeLeft:   60,
  wordOpts:   [],
  timer:      null,
  hasGuessed: false,

  // canvas
  strokes:    [],
  color:      '#111111',
  size:       4,
  tool:       'pen',
  fillShapes: true,
  painting:   false,
  shapeStart: null,
  snap:       null,
  ready:      false,   // canvas initialised?

  // theme
  currentPreset: 'ember',
  realtime: null,
  realtimeReady: false,
  clientId: Math.random().toString(36).slice(2),
};

function broadcastEvent(type, payload = {}) {
  if (!G.realtimeReady || !G.realtime) return;
  G.realtime.send({ type: 'broadcast', event: type, payload }).catch(() => {
    G.realtimeReady = false;
  });
}

function setRealtimeStatus(message, state = '') {
  const el = document.getElementById('realtime-status');
  if (!el) return;
  el.textContent = message;
  el.className = `realtime-status ${state}`;
}

function playerPayload() {
  return { name: G.name, avatar: G.avatar, score: 0, idx: G.clientId, hasGuessed: false };
}

function syncPlayers(presences) {
  const players = Object.values(presences || {}).flat().map(p => ({
    name: p.name, avatar: p.avatar, score: Number(p.score) || 0,
    idx: p.idx, hasGuessed: Boolean(p.hasGuessed),
  }));
  if (!players.some(p => p.idx === G.clientId)) players.push(playerPayload());
  players.sort((a, b) => a.idx === G.clientId ? -1 : b.idx === G.clientId ? 1 : a.name.localeCompare(b.name));
  players.forEach((p, i) => { p.idx = p.idx || `player-${i}`; });
  G.players = players.map((p, i) => ({ ...p, idx: p.idx, position: i }));
  updateLobby();
  updateScoreboard();
}

function handleRealtimeEvent(event, payload) {
  if (!payload) return;
  if (event === 'lobby-settings' && !G.isHost) {
    G.maxRounds = Number(payload.maxRounds) || 3;
    G.roundTime = Number(payload.roundTime) || 60;
  } else if (event === 'game-start' && !G.isHost) {
    G.maxRounds = Number(payload.maxRounds) || 3;
    G.roundTime = Number(payload.roundTime) || 60;
    startGame(false);
  } else if (event === 'word-selected' && !G.isHost) {
    G.word = payload.word;
    document.getElementById('w-modal').style.display = 'none';
    document.getElementById('g-word').textContent = payload.mask || '● ● ●';
    startTimer();
  } else if (event === 'chat') {
    addMsg(payload.text, payload.kind, payload.sender, true);
  } else if (event === 'stroke') {
    applyRemoteStroke(payload.stroke);
  } else if (event === 'canvas-clear') {
    clearCanvas(false);
  } else if (event === 'canvas-undo') {
    undoStroke(false);
  }
}

async function setupRealtime() {
  const config = window.SUPABASE_CONFIG;
  if (!window.supabase || !config || !config.url || !config.anonKey) {
    setRealtimeStatus('Local mode · add Supabase config for multiplayer', 'offline');
    return;
  }
  try {
    const client = window.supabase.createClient(config.url, config.anonKey);
    G.realtime = client.channel(`skribbl:${G.room}`, { config: { presence: { key: G.clientId } } });
    G.realtime
      .on('presence', { event: 'sync' }, () => syncPlayers(G.realtime.presenceState()))
      .on('presence', { event: 'join' }, () => syncPlayers(G.realtime.presenceState()))
      .on('presence', { event: 'leave' }, () => syncPlayers(G.realtime.presenceState()))
      .on('broadcast', { event: 'skribbl-event' }, ({ payload }) => handleRealtimeEvent(payload.event, payload.payload));
    const connectionTimeout = setTimeout(() => {
      if (G.realtimeReady) return;
      if (G.realtime) G.realtime.unsubscribe();
      setRealtimeStatus('Multiplayer unavailable · playing locally', 'offline');
    }, 8000);
    await G.realtime.subscribe(async status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        G.realtimeReady = false;
        setRealtimeStatus('Multiplayer unavailable · playing locally', 'offline');
        return;
      }
      if (status !== 'SUBSCRIBED') return;
      clearTimeout(connectionTimeout);
      G.realtimeReady = true;
      await G.realtime.track({ ...playerPayload(), idx: G.clientId });
      syncPlayers(G.realtime.presenceState());
      setRealtimeStatus('Multiplayer connected · invite your friends', 'online');
    });
  } catch (error) {
    console.warn('Realtime unavailable; continuing in local mode.', error);
    setRealtimeStatus('Multiplayer unavailable · playing locally', 'offline');
    G.realtime = null;
    G.realtimeReady = false;
  }
}

/** Original pixel character palettes used for the avatar tiles. */
const AVATAR_COLORS = [
  ['#f2a51a','#6e2d18','#f7d58a'], ['#d7d7d7','#3b4652','#f5f5f5'],
  ['#e77b2f','#6f271b','#f7c06a'], ['#9b5d3d','#4a251c','#e5a36d'],
  ['#d7c274','#48361e','#f5dfa0'], ['#6cc44a','#255b3b','#d4f28c'],
  ['#8c6848','#33231d','#c89d68'], ['#9a633e','#442718','#e2a56e'],
  ['#754f46','#261b1b','#c17b66'], ['#4f9e39','#173c27','#b9e85c'],
  ['#555b68','#202431','#cfd6dd'], ['#eeeeee','#41454b','#ffb7ad'],
  ['#b9a994','#483b35','#eee0bd'], ['#ef9f88','#5c2e2a','#ffd0b7'],
  ['#826343','#32251e','#c49a68'], ['#ec9c24','#30231b','#f8d47b'],
];
const AVATAR_NAMES = ['Tiger', 'Wolf', 'Fox', 'Pig', 'Cat', 'Frog', 'Bear', 'Dog', 'Boar', 'Goblin', 'Panther', 'Rabbit', 'Koala', 'Piglet', 'Badger', 'Deer'];

function avatarSvg(index) {
  const [fur, dark, light] = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const features = [
    `<path d="M7 15V4h9v5h16V4h9v11" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="20" y="23" width="8" height="5" fill="${dark}"/>`,
    `<path d="M5 10h10v7h18v-7h10v22H5z" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="20" y="24" width="8" height="7" fill="${dark}"/>`,
    `<path d="M6 17V4h10l8 9 8-9h10v13" fill="${fur}" stroke="${dark}" stroke-width="4"/><path d="M17 31h14v4H17z" fill="${dark}"/>`,
    `<path d="M6 13V3h10l8 9 8-9h10v10" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="18" y="27" width="12" height="7" fill="${light}"/>`,
    `<path d="M5 14V5h9v6h20V5h9v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="18" y="25" width="12" height="8" fill="${dark}"/>`,
    `<path d="M5 13V4h9v7h20V4h9v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="16" y="16" width="7" height="7" fill="${dark}"/><rect x="25" y="16" width="7" height="7" fill="${dark}"/>`,
    `<path d="M4 14V5h11v7h18V5h11v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="19" y="26" width="10" height="8" fill="${light}"/>`,
    `<path d="M5 12V3h12v8h14V3h12v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="15" y="25" width="18" height="10" fill="${light}"/>`,
    `<path d="M3 15V7h9v4h24V7h9v8" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="19" y="27" width="10" height="7" fill="${dark}"/>`,
    `<path d="M5 15V4h10l9 8 9-8h10v11" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="18" y="25" width="12" height="8" fill="${light}"/>`,
    `<path d="M4 16V8h8l4-5h16l4 5h8v8" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="17" y="27" width="14" height="6" fill="${dark}"/>`,
    `<path d="M4 14V5h11v7h18V5h11v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="11" y="16" width="9" height="8" fill="${dark}"/><rect x="28" y="16" width="9" height="8" fill="${dark}"/>`,
    `<path d="M5 13V4h10v8h18V4h10v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="17" y="24" width="14" height="9" fill="${light}"/>`,
    `<path d="M6 14V5h10v7h16V5h10v9" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="19" y="25" width="10" height="8" fill="${light}"/>`,
    `<path d="M4 14V6h10v6h20V6h10v8" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="14" y="24" width="20" height="10" fill="${dark}"/>`,
    `<path d="M5 14V3h11v9h16V3h11v11" fill="${fur}" stroke="${dark}" stroke-width="4"/><rect x="18" y="26" width="12" height="7" fill="${light}"/>`,
  ][index % 16];
  const faces = [
    `<rect x="12" y="15" width="7" height="7" fill="#111"/><rect x="29" y="15" width="7" height="7" fill="#111"/><rect x="21" y="25" width="6" height="4" fill="#f06a45"/>`,
    `<rect x="12" y="16" width="8" height="5" fill="#111"/><rect x="28" y="16" width="8" height="5" fill="#111"/><rect x="18" y="26" width="12" height="7" fill="${light}"/>`,
    `<rect x="13" y="16" width="6" height="8" fill="#111"/><rect x="29" y="16" width="6" height="8" fill="#111"/><path d="M19 28h10v4H19z" fill="#111"/>`,
    `<rect x="12" y="15" width="8" height="8" fill="#111"/><rect x="28" y="15" width="8" height="8" fill="#111"/><rect x="22" y="26" width="4" height="4" fill="#111"/>`,
    `<rect x="13" y="16" width="6" height="6" fill="#111"/><rect x="29" y="16" width="6" height="6" fill="#111"/><rect x="18" y="27" width="12" height="5" fill="${light}"/>`,
    `<rect x="13" y="14" width="8" height="9" fill="#111"/><rect x="27" y="14" width="8" height="9" fill="#111"/><rect x="20" y="27" width="8" height="5" fill="#111"/>`,
    `<rect x="12" y="16" width="7" height="7" fill="#111"/><rect x="29" y="16" width="7" height="7" fill="#111"/><rect x="17" y="26" width="14" height="8" fill="${light}"/>`,
    `<rect x="11" y="15" width="9" height="8" fill="#111"/><rect x="28" y="15" width="9" height="8" fill="#111"/><rect x="16" y="27" width="16" height="6" fill="${dark}"/>`,
    `<rect x="13" y="17" width="6" height="6" fill="#111"/><rect x="29" y="17" width="6" height="6" fill="#111"/><rect x="20" y="27" width="8" height="5" fill="#111"/>`,
    `<rect x="12" y="16" width="8" height="8" fill="#111"/><rect x="28" y="16" width="8" height="8" fill="#111"/><path d="M18 28h12v5H18z" fill="${light}"/>`,
    `<rect x="12" y="15" width="8" height="8" fill="#111"/><rect x="28" y="15" width="8" height="8" fill="#111"/><rect x="18" y="27" width="12" height="5" fill="#111"/>`,
    `<rect x="13" y="16" width="6" height="7" fill="#111"/><rect x="29" y="16" width="6" height="7" fill="#111"/><rect x="19" y="26" width="10" height="7" fill="${light}"/>`,
    `<rect x="12" y="15" width="8" height="8" fill="#111"/><rect x="28" y="15" width="8" height="8" fill="#111"/><rect x="20" y="26" width="8" height="7" fill="${dark}"/>`,
    `<rect x="13" y="16" width="6" height="6" fill="#111"/><rect x="29" y="16" width="6" height="6" fill="#111"/><rect x="18" y="26" width="12" height="7" fill="#e65f69"/>`,
    `<rect x="11" y="15" width="9" height="8" fill="#111"/><rect x="28" y="15" width="9" height="8" fill="#111"/><rect x="17" y="26" width="14" height="7" fill="${light}"/>`,
    `<rect x="13" y="16" width="7" height="7" fill="#111"/><rect x="28" y="16" width="7" height="7" fill="#111"/><path d="M18 27h12v5H18z" fill="${dark}"/>`,
  ][index % 16];
  const extras = [
    '', '', '', '',
    `<rect x="8" y="10" width="8" height="8" fill="${light}"/><rect x="32" y="10" width="8" height="8" fill="${light}"/>`,
    `<rect x="18" y="27" width="12" height="8" fill="${light}"/><rect x="21" y="29" width="6" height="4" fill="${dark}"/>`,
    `<rect x="17" y="25" width="14" height="10" fill="${light}"/><rect x="21" y="28" width="6" height="5" fill="${dark}"/>`,
    `<path d="M12 8L16 2l4 7M28 9l4-7 4 6" fill="${light}" stroke="${dark}" stroke-width="3"/>`,
    `<rect x="7" y="17" width="8" height="10" fill="${dark}"/><rect x="33" y="17" width="8" height="10" fill="${dark}"/>`,
    `<rect x="9" y="12" width="7" height="12" fill="${dark}"/><rect x="32" y="12" width="7" height="12" fill="${dark}"/>`,
    `<rect x="7" y="10" width="34" height="5" fill="${dark}"/><rect x="10" y="27" width="28" height="7" fill="${light}"/>`,
    `<rect x="8" y="14" width="9" height="12" fill="${dark}"/><rect x="31" y="14" width="9" height="12" fill="${dark}"/>`,
    `<path d="M15 24h18v10H15z" fill="${light}"/><rect x="21" y="26" width="6" height="6" fill="${dark}"/>`,
    `<rect x="7" y="17" width="9" height="8" fill="${dark}"/><rect x="32" y="17" width="9" height="8" fill="${dark}"/>`,
    `<rect x="10" y="25" width="28" height="9" fill="${light}"/><rect x="20" y="27" width="8" height="6" fill="${dark}"/>`,
    `<path d="M16 25h16v9H16z" fill="${light}"/><rect x="21" y="27" width="6" height="5" fill="${dark}"/>`,
    `<rect x="7" y="12" width="8" height="13" fill="${dark}"/><rect x="33" y="12" width="8" height="13" fill="${dark}"/>`,
  ][index % 16];
  return `<svg viewBox="0 0 48 48" aria-hidden="true" shape-rendering="crispEdges">
    <rect width="48" height="48" fill="#fff"/>
    ${features}
    <rect x="4" y="11" width="40" height="25" fill="${fur}"/>
    <rect x="8" y="36" width="32" height="6" fill="${dark}"/>
    <rect x="12" y="15" width="8" height="8" fill="${light}"/>
    <rect x="28" y="15" width="8" height="8" fill="${light}"/>
    <rect x="15" y="18" width="4" height="5" fill="${dark}"/>
    <rect x="29" y="18" width="4" height="5" fill="${dark}"/>
    <rect x="20" y="26" width="8" height="6" fill="${light}"/>
    <rect x="16" y="32" width="16" height="4" fill="${dark}"/>
    ${faces}
    ${extras}
  </svg>`;
}

function avatarMarkup(value) {
  const match = /^avatar-(\d+)$/.exec(String(value));
  if (!match) return `<span>${esc(value)}</span>`;
  const index = Number(match[1]) % 16;
  const col = index % 8;
  const row = Math.floor(index / 8);
  return `<span class="avatar-sprite" style="--sprite-left:${-(col * 45.3 + 24)}px;--sprite-top:${-(row * 52 + 23)}px;--mini-left:${-(col * 32 + 17)}px;--mini-top:${-(row * 36.5 + 16)}px" aria-hidden="true"></span>`;
}

// ── avatar grid ───────────────────────────
function buildAvatars() {
  const grid = document.getElementById('av-grid');
  grid.innerHTML = '';
  AVATAR_COLORS.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'av' + (i === 0 ? ' sel' : '');
    d.innerHTML = avatarMarkup(`avatar-${i}`);
    d.title = `${AVATAR_NAMES[i]} avatar`;
    d.setAttribute('aria-label', `${AVATAR_NAMES[i]} avatar`);
    d.setAttribute('role', 'button');
    d.tabIndex = 0;
    d.onclick = () => {
      G.avatar = `avatar-${i}`;
      document.querySelectorAll('.av').forEach(x => x.classList.remove('sel'));
      d.classList.add('sel');
    };
    d.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') d.click(); };
    grid.appendChild(d);
  });
}

// ── home screen validation ────────────────
function validateHome() {
  const n = document.getElementById('h-name').value.trim();
  const r = document.getElementById('h-room').value.trim();
  document.getElementById('btn-c').disabled = !n;
  document.getElementById('btn-j').disabled = !n || r.length < 4;
}

// ── create room ───────────────────────────
function doCreate() {
  const n = document.getElementById('h-name').value.trim();
  if (!n) return;

  document.getElementById('custom-panel').style.display = 'none';
  G.name   = n;
  G.maxRounds = Number(document.getElementById('room-rounds').value);
  G.roundTime = Number(document.getElementById('room-time').value);
  G.isHost = true;
  G.room   = Math.random().toString(36).substr(2, 6).toUpperCase();
  G.players = [{ name: n, avatar: G.avatar, score: 0, idx: 0, hasGuessed: false }];
  setupRealtime();

  document.getElementById('l-code').textContent    = G.room;
  document.getElementById('btn-start').style.display = '';
  document.getElementById('l-wait').style.display  = 'none';

  updateLobby();
  showScreen('lobby');
}

// ── join room ─────────────────────────────
function doJoin() {
  const n = document.getElementById('h-name').value.trim();
  const r = document.getElementById('h-room').value.trim();
  if (!n || !r) return;

  document.getElementById('custom-panel').style.display = 'none';
  G.name   = n;
  G.isHost = false;
  G.room   = r.toUpperCase();

  // Simulate a pre-existing host for demo purposes
  G.players = [playerPayload()];
  setupRealtime();

  document.getElementById('l-code').textContent      = G.room;
  document.getElementById('btn-start').style.display = 'none';
  document.getElementById('l-wait').style.display    = '';

  updateLobby();
  showScreen('lobby');

  // Simulate players appearing
  setTimeout(() => addMsg(n + ' joined the room!', 'system'), 300);
}

// ── lobby ─────────────────────────────────
function updateLobby() {
  document.getElementById('l-players').innerHTML = G.players.map((p, i) => `
    <div class="pchip">
      <div class="avatar-mini">${avatarMarkup(p.avatar)}</div>
      <div>
        <div style="font-size:13px;font-weight:700">${esc(p.name)}${i === 0 ? ' 👑' : ''}</div>
        <div style="font-size:10px;opacity:0.45">${p.score} pts</div>
      </div>
    </div>`
  ).join('');
}

function copyCode() {
  navigator.clipboard && navigator.clipboard.writeText(G.room);
  const el   = document.getElementById('l-code');
  const orig = el.textContent;
  el.textContent = 'Copied!';
  setTimeout(() => el.textContent = orig, 1200);
}

// ── start game ────────────────────────────
function startGame(announce = true) {
  G.ready  = false;
  G.round  = 1;
  G.drawer = 0;

  if (announce && G.isHost) broadcastEvent('game-start', { maxRounds: G.maxRounds, roundTime: G.roundTime });
  document.getElementById('loading-overlay').style.display = 'flex';
  showScreen('game');
  initCanvas();
  buildPalette();
  setTool('pen');

  document.getElementById('g-round').textContent = `Round 1/${G.maxRounds}`;
  addMsg('Game started! Get ready…', 'system');
  setTimeout(() => {
    document.getElementById('loading-overlay').style.display = 'none';
    if (G.isHost) startDrawTurn();
    else {
      document.getElementById('g-word').textContent = 'Waiting for the drawer...';
      updateScoreboard();
    }
  }, 500);
}

// ── go home / restart ─────────────────────
function goHome() {
  clearInterval(G.timer);
  G.ready      = false;
  G.players    = [];
  G.word       = '';
  G.round      = 1;
  G.strokes    = [];
  G.hasGuessed = false;
  G.timeLeft   = 60;
  G.maxRounds  = 3;
  G.roundTime  = 60;

  document.getElementById('chat-feed').innerHTML = '';
  if (G.realtime) G.realtime.removeAllListeners();
  G.realtime = null;
  G.realtimeReady = false;
  showScreen('home');
}

// ── event listeners ───────────────────────
document.getElementById('h-name').addEventListener('input', validateHome);
document.getElementById('h-room').addEventListener('input', function () {
  this.value = this.value.toUpperCase();
  validateHome();
});
document.getElementById('room-rounds').addEventListener('change', e => {
  G.maxRounds = Number(e.target.value);
  if (G.isHost) broadcastEvent('lobby-settings', { maxRounds: G.maxRounds, roundTime: G.roundTime });
});
document.getElementById('room-time').addEventListener('change', e => {
  G.roundTime = Number(e.target.value);
  if (G.isHost) broadcastEvent('lobby-settings', { maxRounds: G.maxRounds, roundTime: G.roundTime });
});

// ── boot ──────────────────────────────────
buildAvatars();
applyPreset('midnight');
updateCustomPreview();
