// ─────────────────────────────────────────
//  Skribbl – Game Logic
// ─────────────────────────────────────────

/** Escape HTML special chars to prevent XSS */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── screen router ─────────────────────────
/**
 * Show one screen and hide all others.
 * @param {'home'|'lobby'|'game'|'gameover'} s
 */
function showScreen(s) {
  ['home','lobby','game','gameover'].forEach(x => {
    const el = document.getElementById('s-' + x);
    if (el) el.style.display = x === s ? '' : 'none';
  });
}

// ── chat / messages ───────────────────────
/**
 * Append a message bubble to the chat feed.
 * @param {string} text
 * @param {'guess'|'correct'|'system'} type
 * @param {string} [sender]
 */
function addMsg(text, type, sender, remote = false) {
  const feed = document.getElementById('chat-feed');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap anim-su';

  let html = '';
  if (type === 'guess' && sender) {
    html = `<div class="msg-name">${esc(sender)}</div>
            <div class="msg-bubble">${esc(text)}</div>`;
  } else if (type === 'correct') {
    html = `<div class="msg-bubble correct">🎉 ${esc(text)}</div>`;
  } else {
    html = `<div class="msg-bubble system">${esc(text)}</div>`;
  }

  wrap.innerHTML = html;
  feed.appendChild(wrap);
  feed.scrollTop = feed.scrollHeight;
  if (!remote && type !== 'system') {
    broadcastEvent('chat', { text, kind: type, sender: sender || G.name });
  }
}

// ── scoreboard ────────────────────────────
function updateScoreboard() {
  const el     = document.getElementById('scoreboard');
  const sorted = [...G.players].sort((a, b) => b.score - a.score);

  el.innerHTML = sorted.map(p => `
    <div class="srow${p.hasGuessed && p.idx !== G.drawer ? ' guessed' : ''}">
      <span class="avatar-mini">${avatarMarkup(p.avatar)}</span>
      <span class="sname">${esc(p.name)}${p.idx === G.drawer ? ' ✏️' : ''}</span>
      ${p.hasGuessed && p.idx !== G.drawer ? '<span class="check-badge">✓</span>' : ''}
      <span class="sscore">${p.score}</span>
    </div>`
  ).join('');
}

// ── guess submission ──────────────────────
function sendGuess() {
  const inp  = document.getElementById('g-input');
  const text = inp.value.trim();
  if (!text) return;
  inp.value = '';

  if (G.drawer === 0) { addMsg('You are the drawer!', 'system'); return; }
  if (G.hasGuessed)   { addMsg('You already guessed correctly!', 'system'); return; }

  addMsg(text, 'guess', G.name);

  if (text.toLowerCase() === G.word.toLowerCase()) {
    G.hasGuessed = true;
    const bonus  = Math.round(400 * (G.timeLeft / G.roundTime));
    G.players[1].score += bonus;
    G.players[1].hasGuessed = true;
    G.players[0].score += 50;   // drawer bonus
    addMsg(`${G.name} guessed the word! (+${bonus} pts)`, 'correct');
    document.getElementById('ginput-label').textContent = '✅ You guessed it!';
    document.getElementById('g-input').classList.add('locked');
    document.getElementById('g-input').disabled = true;
    updateScoreboard();
  }
}

// ── timer ─────────────────────────────────
function startTimer() {
  if (G.timer) clearInterval(G.timer);
  G.timeLeft = G.roundTime;
  const tb = document.getElementById('g-timer');
  tb.textContent = G.roundTime + 's';
  tb.classList.remove('urgent');

  G.timer = setInterval(() => {
    G.timeLeft--;
    tb.textContent = G.timeLeft + 's';
    if (G.timeLeft <= 10) tb.classList.add('urgent');
    if (G.timeLeft <= 0)  endRound();
  }, 1000);
}

// ── round flow ────────────────────────────
function startDrawTurn() {
  G.hasGuessed = false;
  G.players.forEach(p => p.hasGuessed = false);
  clearCanvas();
  G.strokes = [];

  document.getElementById('g-round').textContent  = `Round ${G.round}/${G.maxRounds}`;
  const words = randWords(3);
  G.wordOpts  = words;
  ['wo1','wo2','wo3'].forEach((id, i) => document.getElementById(id).textContent = words[i]);
  document.getElementById('w-modal').style.display   = 'flex';
  document.getElementById('g-word').textContent      = 'Choose a word...';
  document.getElementById('ginput-label').textContent = 'Type your guess below 👇';
  document.getElementById('g-input').classList.remove('locked');
  document.getElementById('g-input').disabled = false;
  updateScoreboard();
}

/**
 * Called when the drawer picks a word from the modal.
 * @param {number} i  index 0–2
 */
function pickWord(i) {
  G.word = G.wordOpts[i];
  document.getElementById('w-modal').style.display = 'none';
  document.getElementById('g-word').textContent    = G.word;
  broadcastEvent('word-selected', { word: G.word, mask: G.word.replace(/[a-z]/gi, '●') });
  addMsg(`Round ${G.round}/${G.maxRounds} — Drawing: ${G.word}`, 'system');
  startTimer();
  updateScoreboard();
}

function endRound() {
  clearInterval(G.timer);
  addMsg(`The word was: "${G.word}"`, 'system');
  if (G.round >= G.maxRounds) {
    setTimeout(showGameOver, 2200);
  } else {
    G.round++;
    setTimeout(startDrawTurn, 2500);
  }
}

function showGameOver() {
  clearInterval(G.timer);
  showScreen('gameover');
  const sorted = [...G.players].sort((a, b) => b.score - a.score);
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('go-scores').innerHTML = sorted.map((p, i) => `
    <div class="podrow">
      <span style="font-size:20px">${medals[i] || '#' + (i + 1)}</span>
      <span class="avatar-mini">${avatarMarkup(p.avatar)}</span>
      <div style="flex:1;font-size:15px;font-weight:800">${esc(p.name)}</div>
      <div style="font-size:20px;font-weight:900">${p.score}</div>
    </div>`
  ).join('');
}
