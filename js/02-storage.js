// ── js/02-storage.js ── localStorage, Einstellungen, PWA-Registrierung ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('02-storage');

// lupe: 'auto' (bei Karten mit Kurztexten und ab 7×7), 'immer' oder 'aus'; useKurz: Kurztexte auf den Feldern zeigen
const LUPE_MODES = ['auto', 'immer', 'aus'];
const DEFAULT_SETTINGS = { confirmNewCard: true, showCounter: true, useKurz: true, icons: true, autoDatum: true, lupe: 'auto' };
// cards[gameId] = { seed, cells: [Text | Kombi-Feld { t, p, ab } | null (Freifeld)], marks: [Positionen von Textfeldern],
//                    checks: { Position: [Nummern der abgehakten Punkte] },
//                    eigene: { Position: [selbst eingetragene Texte] } (nur Kombi-Felder mit e: true),
//                    details: { Position: { d: 'JJJJ-MM-TT', i: 'Info' } } (beides optional) }
// Die Feldtexte werden mitgespeichert: eine laufende Karte bleibt auch dann gleich, wenn bingo-data.js geändert wird.
let appState = { cards: {}, settings: { ...DEFAULT_SETTINGS }, activeGame: '' };
let stateVersion = 0;

// Bereinigt eine gespeicherte Zelle: Text, Kombi-Feld { t, p, ab } oder null (Freifeld).
// undefined = ungültig.
function sanitizeCell(c) {
  if (c === null) return null;
  if (typeof c === 'string') return c ? c.slice(0, MAX_FELD_LEN) : undefined;
  if (!isComboEntry(c) || typeof c.t !== 'string' || !c.t || !Array.isArray(c.p)) return undefined;
  const eig = c.e === true;
  if (c.p.length < (eig ? 0 : 2) || c.p.length > MAX_PUNKTE || c.p.some(x => typeof x !== 'string' || !x)
    || !Number.isInteger(c.ab) || c.ab < 1 || c.ab > c.p.length + (eig ? MAX_EIGENE : 0)) return undefined;
  const out = { t: c.t.slice(0, MAX_FELD_LEN), p: c.p.map(x => x.slice(0, MAX_FELD_LEN)), ab: c.ab };
  if (eig) {
    out.e = true;
    if (typeof c.h === 'string' && c.h.trim()) out.h = c.h.trim().slice(0, MAX_EIGENE_LEN);
  }
  return out;
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
  // Eigene Einträge (Freitext) gibt es nur bei Kombi-Feldern mit e: true.
  const eigene = {};
  const re = raw.eigene && typeof raw.eigene === 'object' && !Array.isArray(raw.eigene) ? raw.eigene : {};
  Object.keys(re).forEach(k => {
    const p = Number(k);
    if (!Number.isInteger(p) || String(p) !== k || !isComboEntry(cells[p]) || !cells[p].e) return;
    const list = (Array.isArray(re[k]) ? re[k] : []).filter(x => typeof x === 'string')
      .map(x => x.trim().slice(0, MAX_EIGENE_LEN).trim()).filter(Boolean).slice(0, MAX_EIGENE);
    if (list.length) eigene[p] = list;
  });
  // Datum und Info je Feld (optional); Einträge ohne gültiges Datum und ohne Text fallen weg.
  const details = {};
  const rdt = raw.details && typeof raw.details === 'object' && !Array.isArray(raw.details) ? raw.details : {};
  Object.keys(rdt).forEach(k => {
    const p = Number(k);
    const e = rdt[k];
    if (!Number.isInteger(p) || String(p) !== k || p < 0 || p >= total || cells[p] === null || !e || typeof e !== 'object' || Array.isArray(e)) return;
    const out = {};
    if (typeof e.d === 'string' && isValidDate(e.d)) out.d = e.d;
    const info = typeof e.i === 'string' ? e.i.trim().slice(0, MAX_INFO).trim() : '';
    if (info) out.i = info;
    if (out.d || out.i) details[p] = out;
  });
  return { seed: Number.isInteger(raw.seed) ? raw.seed : 0, cells: cells, marks: marks, checks: checks, eigene: eigene, details: details };
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
      showCounter: typeof s.showCounter === 'boolean' ? s.showCounter : DEFAULT_SETTINGS.showCounter,
      useKurz: typeof s.useKurz === 'boolean' ? s.useKurz : DEFAULT_SETTINGS.useKurz,
      icons: typeof s.icons === 'boolean' ? s.icons : DEFAULT_SETTINGS.icons,
      autoDatum: typeof s.autoDatum === 'boolean' ? s.autoDatum : DEFAULT_SETTINGS.autoDatum,
      lupe: LUPE_MODES.includes(s.lupe) ? s.lupe : DEFAULT_SETTINGS.lupe
    };
    appState.activeGame = typeof data.activeGame === 'string' && games.some(g => g.id === data.activeGame) ? data.activeGame : '';
  } catch (e) { safeLog('Load error', e); }
}

function safeLog(...args) { try { console.error(...args); } catch (e) {} }

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(e => safeLog('SW:', e));
}
