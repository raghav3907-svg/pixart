// ─────────────────────────────────────────
//  Skribbl – Theme Engine
// ─────────────────────────────────────────

/** All built-in theme presets */
const PRESETS = {
  ember: {
    bg1:'#3d1f00', bg2:'#8B4513', bg3:'#5C3317',
    acc:'#e8a020', btn:'#c0392b', btn2:'#2e6ab5',
    card:'#231a0e', cardb:'#5a3e28',
    inp:'#1a100a', inpb:'#4a3020', tx:'#f0e6d3',
  },
  ocean: {
    bg1:'#0a2a4a', bg2:'#1a6fa8', bg3:'#0d4a6e',
    acc:'#5bc8f5', btn:'#1565c0', btn2:'#00838f',
    card:'#0a1929', cardb:'#1a4a6e',
    inp:'#061220', inpb:'#1a4a6e', tx:'#b3e5fc',
  },
  forest: {
    bg1:'#1a3a1a', bg2:'#2e7d32', bg3:'#1b5e20',
    acc:'#a5d6a7', btn:'#388e3c', btn2:'#0288d1',
    card:'#0d2010', cardb:'#2e7d32',
    inp:'#081508', inpb:'#1b5e20', tx:'#c8e6c9',
  },
  cyber: {
    bg1:'#0d0221', bg2:'#190535', bg3:'#0d0221',
    acc:'#00f5ff', btn:'#ff00ff', btn2:'#7c4dff',
    card:'#0a0118', cardb:'#3a0066',
    inp:'#050011', inpb:'#2a0044', tx:'#e0d7ff',
  },
  candy: {
    bg1:'#ff6b9d', bg2:'#c44dff', bg3:'#ff6b6b',
    acc:'#fff176', btn:'#e91e63', btn2:'#9c27b0',
    card:'#4a0030', cardb:'#880060',
    inp:'#330020', inpb:'#660040', tx:'#fff9c4',
  },
  midnight: {
    bg1:'#f13d9d', bg2:'#8bdcf1', bg3:'#fff36a',
    acc:'#fff36a', btn:'#11131a', btn2:'#238dca',
    card:'#fff36a', cardb:'#11131a',
    inp:'#ffffff', inpb:'#11131a', tx:'#11131a',
  },
  lava: {
    bg1:'#200122', bg2:'#6f0000', bg3:'#3d0000',
    acc:'#ff6b35', btn:'#d32f2f', btn2:'#f57c00',
    card:'#150010', cardb:'#5a0000',
    inp:'#0a0008', inpb:'#3d0000', tx:'#ffe0cc',
  },
};

/** Write a single CSS variable on the root #app element */
function cssVar(key, value) {
  document.getElementById('app').style.setProperty('--' + key, value);
}

/** Return a high-contrast foreground for a hex background. */
function readableText(hex) {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return '#11131a';
  const channels = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.48 ? '#11131a' : '#ffffff';
}

/**
 * Apply a theme object (all keys) to the page via CSS variables.
 * @param {Object} t  - theme object
 * @param {string|null} presetKey - name of preset, or null for custom
 */
function applyThemeObj(t, presetKey) {
  Object.entries(t).forEach(([k, v]) => cssVar(k, v));
  cssVar('on-bg', readableText(t.bg2 || t.bg1));
  cssVar('on-card', readableText(t.card));
  cssVar('on-inp', readableText(t.inp));
  cssVar('on-btn', readableText(t.btn));
  cssVar('on-btn2', readableText(t.btn2));
  cssVar('on-acc', readableText(t.acc));
  // update active highlight
  document.querySelectorAll('.tpreset').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tcustom').forEach(el => el.classList.remove('active'));
  if (presetKey) {
    const el = document.getElementById('tp-' + presetKey);
    if (el) el.classList.add('active');
  } else {
    document.getElementById('tp-custom').classList.add('active');
  }
  G.currentPreset = presetKey || 'custom';
}

/**
 * Apply a named preset and sync the custom panel inputs.
 * @param {string} name
 */
function applyPreset(name) {
  if (!PRESETS[name]) return;
  applyThemeObj(PRESETS[name], name);
  syncCustomPanelToTheme(PRESETS[name]);
  document.getElementById('custom-panel').style.display = 'none';
}

/** Populate the custom panel colour inputs from a theme object */
function syncCustomPanelToTheme(t) {
  const fields = ['bg1','bg2','bg3','acc','btn','btn2','card','inp','tx'];
  fields.forEach(f => {
    const sw = document.getElementById('cp-' + f);
    const hx = document.getElementById('cph-' + f);
    if (sw && t[f]) sw.value = t[f];
    if (hx && t[f]) hx.value = t[f];
  });
  updateCustomPreview();
}

/** Show / hide the custom builder panel */
function toggleCustomPanel() {
  const p = document.getElementById('custom-panel');
  const isHidden = p.style.display === 'none';
  p.style.display = isHidden ? '' : 'none';
  if (isHidden) syncCustomPanelToTheme(PRESETS[G.currentPreset] || PRESETS.ember);
}

/**
 * Sync a hex text input → colour picker when the user types.
 * @param {string} field  e.g. 'bg1'
 */
function syncHex(field) {
  const hx = document.getElementById('cph-' + field);
  const sw = document.getElementById('cp-' + field);
  let val = hx.value.trim();
  if (!val.startsWith('#')) val = '#' + val;
  if (/^#[0-9a-fA-F]{6}$/.test(val)) sw.value = val;
  updateCustomPreview();
}

/** Read all custom panel values into a theme object */
function getCustomValues() {
  const fields = ['bg1','bg2','bg3','acc','btn','btn2','card','inp','tx'];
  const t = {};
  fields.forEach(f => { t[f] = document.getElementById('cp-' + f).value; });
  t.cardb = lightenHex(t.card, 30);
  t.inpb  = lightenHex(t.card, 40);
  return t;
}

/**
 * Lighten a hex colour by `amt` (0–255) per channel.
 * @param {string} hex
 * @param {number} amt
 * @returns {string}
 */
function lightenHex(hex, amt) {
  hex = hex.replace('#', '');
  const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amt);
  const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amt);
  const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amt);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Refresh the preview swatches inside the custom panel */
function updateCustomPreview() {
  const t = getCustomValues();
  const cols   = [t.bg1, t.bg2, t.acc, t.btn, t.btn2, t.card, t.inp, t.tx];
  const labels = ['BG1','BG2','Accent','Btn','Btn2','Card','Input','Text'];
  document.getElementById('theme-preview').innerHTML = cols.map((c, i) =>
    `<div title="${labels[i]}: ${c}"
          style="width:28px;height:28px;border-radius:7px;background:${c};
                 border:2px solid rgba(255,255,255,0.25);cursor:help"></div>`
  ).join('');
}

/** Apply whatever the user has built in the custom panel */
function applyCustomTheme() {
  applyThemeObj(getCustomValues(), null);
  document.getElementById('custom-panel').style.display = 'none';
}
