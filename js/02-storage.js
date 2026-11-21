// ── js/02-storage.js ── localStorage, Einstellungen, PWA-Registrierung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('02-storage');

const DEFAULT_SETTINGS = { confirmNewCard: true, showCounter: true };
// cards[gameId] = { seed, cells: [Text | Kombi-Feld { t, p, ab } | null (Freifeld)], marks: [Positionen von Textfeldern],
//                    checks: { Position: [Nummern der abgehakten Punkte] } }
// Die Feldtexte werden mitgespeichert: eine laufende Karte bleibt auch dann gleich, wenn bingo-data.js geändert wird.
let appState = { cards: {}, settings: { ...DEFAULT_SETTINGS }, activeGame: '' };
let stateVersion = 0;

// Bereinigt eine gespeicherte Zelle: Text, Kombi-Feld { t, p, ab } oder null (Freifeld).
// undefined = ungültig.
function sanitizeCell(c) {
  if (c === null) return null;
  if (typeof c === 'string') return c ? c.slice(0, MAX_FELD_LEN) : undefined;
  if (!isComboEntry(c) || typeof c.t !== 'string' || !c.t || !Array.isArray(c.p) || c.p.length < 2 || c.p.length > MAX_PUNKTE
    || c.p.some(x => typeof x !== 'string' || !x) || !Number.isInteger(c.ab) || c.ab < 1 || c.ab > c.p.length) return undefined;
  return { t: c.t.slice(0, MAX_FELD_LEN), p: c.p.map(x => x.slice(0, MAX_FELD_LEN)), ab: c.ab };
}

// Macht aus einem gespeicherten Eintrag eine gültige Karte - oder null, wenn er nicht zum Spiel passt.
function sanitizeCard(game, raw) {
  if (!game || !raw || typeof raw !== 'object') return null;
  const total = game.groesse * game.groesse;
  if (!Array.isArray(raw.cells) || raw.cells.length !== total) return null;
  const free = freePositions(game);
  const cells = [];
  for (let p = 0; p < total; p++) {
    const c = sanitizeCell(raw.cells[p]);
    if (c === undefined) return null;
    if ((c === null) !== free.includes(p)) return null;           // Freifelder genau dort, wo das Spiel sie vorsieht
    cells.push(c);
  }
  // Einfache Markierungen gibt es nur bei Textfeldern; Kombi-Felder zählen über ihre Häkchen.
  const marks = [...new Set((Array.isArray(raw.marks) ? raw.marks : [])
    .filter(p => Number.isInteger(p) && p >= 0 && p < total && typeof cells[p] === 'string'))].sort((a, b) => a - b);
  const checks = {};
  const rc = raw.checks && typeof raw.checks === 'object' && !Array.isArray(raw.checks) ? raw.checks : {};
  Object.keys(rc).forEach(k => {
    const p = Number(k);
    if (!Number.isInteger(p) || String(p) !== k || !isComboEntry(cells[p])) return;
    const idx = [...new Set((Array.isArray(rc[k]) ? rc[k] : []).filter(i => Number.isInteger(i) && i >= 0 && i < cells[p].p.length))].sort((a, b) => a - b);
    if (idx.length) checks[p] = idx;
  });
  return { seed: Number.isInteger(raw.seed) ? raw.seed : 0, cells: cells, marks: marks, checks: checks };
}

function saveToStorage() {
  stateVersion++;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      cards: appState.cards, settings: appState.settings, activeGame: appState.activeGame, dataVersion: BINGO_DATA_VERSION
    }));
    const el = document.getElementById('saveIndicator');
    el.textContent = '✓ gespeichert';
    setTimeout(() => { el.textContent = ''; }, 2000);
  } catch (e) { safeLog('Storage error', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;
    const games = playableGames();
    const cards = {};
    Object.keys(data.cards && typeof data.cards === 'object' ? data.cards : {}).forEach(id => {
      const game = games.find(g => g.id === id);
      // Karten zu Spielen, die es gerade nicht gibt, bleiben unangetastet erhalten (Spiel kann zurückkommen).
      const card = game ? sanitizeCard(game, data.cards[id]) : data.cards[id];
      if (card) cards[id] = card;
    });
    appState.cards = cards;
    const s = data.settings && typeof data.settings === 'object' ? data.settings : {};
    appState.settings = {
      confirmNewCard: typeof s.confirmNewCard === 'boolean' ? s.confirmNewCard : DEFAULT_SETTINGS.confirmNewCard,
      showCounter: typeof s.showCounter === 'boolean' ? s.showCounter : DEFAULT_SETTINGS.showCounter
    };
    appState.activeGame = typeof data.activeGame === 'string' && games.some(g => g.id === data.activeGame) ? data.activeGame : '';
  } catch (e) { safeLog('Load error', e); }
}

function safeLog(...args) { try { console.error(...args); } catch (e) {} }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(e => safeLog('SW:', e));
}
