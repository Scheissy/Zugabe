// ── js/06-passung.js ── Text auf die Felder einpassen, Symbole, Zoom des Spielfelds ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('06-passung');

// ── SYMBOLE (Emojis) ─────────────────────────────────────────────────────────
// Entfernt Emojis aus einem Feldtext; besteht der Text nur aus Symbolen, bleibt er unverändert.
function stripIcons(s) {
  const out = String(s).replace(/[\p{Extended_Pictographic}\u200D\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '').replace(/\s+/g, ' ').trim();
  return out || String(s);
}
function displayText(s) { return appState.settings.icons ? String(s) : stripIcons(s); }

// ── TEXT EINPASSEN ───────────────────────────────────────────────────────────
// Ziel: so viel Text wie möglich, aber lesbar. Reihenfolge (erste passende Stufe gewinnt):
//   1. ein Textstand (ganzer Text, dann Kurztext) ohne Wortbruch mit mindestens pref px
//   2. dasselbe bis hinunter zur Mindestschrift min
//   3. mit Silbentrennung mitten im Wort (Trennstrich)
//   4. gekürzt mit "…" - so viele Zeichen wie passen
const FIT = { min: 8, pref: 10, lh: 1.15, safeW: 0.96, safeH: 0.98, step: 0.5 };

// Zeilen per Wortumbruch. null, wenn ein Wort breiter als die Zeile ist und nicht getrennt werden darf.
function layoutLines(text, size, w, measure, allowBreak) {
  const lines = [];
  let cur = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const joined = cur ? cur + ' ' + word : word;
    if (measure(joined, size) <= w) { cur = joined; continue; }
    if (cur) { lines.push(cur); cur = ''; }
    if (measure(word, size) <= w) { cur = word; continue; }
    if (!allowBreak) return null;
    let rest = word;
    while (measure(rest, size) > w) {
      let k = rest.length - 1;
      while (k > 1 && measure(rest.slice(0, k) + '-', size) > w) k--;
      lines.push(rest.slice(0, Math.max(k, 1)) + '-');
      rest = rest.slice(Math.max(k, 1));
    }
    cur = rest;
  }
  if (cur) lines.push(cur);
  return lines;
}

// variants: Textstände in Vorzugsreihenfolge, box: { w, h } in px, o: { measure, max, min?, pref?, reserve? }
// Ergebnis: { text, variant, size, lines, cut } - die Zeilen passen immer in die Box.
function fitText(variants, box, o) {
  const w = box.w * FIT.safeW, hAll = box.h * FIT.safeH;
  const min = o.min !== undefined ? o.min : FIT.min, pref = o.pref !== undefined ? o.pref : FIT.pref;
  const max = Math.max(o.max, min);
  const hAt = s => hAll - (o.reserve ? o.reserve(s) : 0);
  const attempt = (text, s, allowBreak) => {
    const lines = layoutLines(text, s, w, o.measure, allowBreak);
    return lines && lines.length && lines.length * s * FIT.lh <= hAt(s) && lines.every(l => o.measure(l, s) <= w) ? lines : null;
  };
  // größte Schrift (Raster step) ab lo, bei der der Text passt - Passen ist monoton in der Schriftgröße
  const largest = (text, lo, allowBreak) => {
    let best = attempt(text, lo, allowBreak);
    if (!best) return null;
    let bestSize = lo, a = 0, b = Math.floor((max - lo) / FIT.step);
    while (a < b) {
      const mid = Math.ceil((a + b) / 2), s = lo + mid * FIT.step, r = attempt(text, s, allowBreak);
      if (r) { best = r; bestSize = s; a = mid; } else b = mid - 1;
    }
    return { lines: best, size: bestSize };
  };
  const pass = (lo, allowBreak) => {
    for (let vi = 0; vi < variants.length; vi++) {
      const r = largest(variants[vi], lo, allowBreak);
      if (r) return { text: variants[vi], variant: vi, size: r.size, lines: r.lines, cut: false };
    }
    return null;
  };
  const hit = pass(pref, false) || pass(min, false) || pass(min, true);
  if (hit) return hit;
  // 4. Kürzen: der kürzeste Textstand, so viele Zeichen wie passen
  const vi = variants.length - 1, v = String(variants[vi]);
  let lo = 0, hi = v.length, lines = null;
  while (lo < hi) {   // größte Länge, die passt (Kürzen macht das Passen nur leichter)
    const mid = Math.ceil((lo + hi) / 2), r = attempt(v.slice(0, mid).trimEnd() + '…', min, true);
    if (r) { lines = r; lo = mid; } else hi = mid - 1;
  }
  const text = lo ? v.slice(0, lo).trimEnd() + '…' : '…';
  return { text: text, variant: vi, size: min, lines: lines || [text], cut: true };
}

// Breitenmessung: Canvas mit der echten Schrift; window.BINGO_MEASURE überschreibt (für Tests).
function makeMeasure(el) {
  if (typeof window.BINGO_MEASURE === 'function') return window.BINGO_MEASURE;
  let ctx = null;
  try { ctx = document.createElement('canvas').getContext('2d'); } catch (e) {}
  if (!ctx) return (s, size) => String(s).length * size * 0.56;
  const family = getComputedStyle(el).fontFamily || 'sans-serif';
  return (s, size) => { ctx.font = '600 ' + size + 'px ' + family; return ctx.measureText(s).width; };
}

// Passt den Text aller Felder der Karte an die aktuelle Feldgröße an (läuft nach jedem Zeichnen,
// nach Zoom und Drehen). Ohne Layout (Feldbreite 0, z. B. verstecktes Tab) passiert nichts.
function fitBoard() {
  const board = document.getElementById('board');
  const game = gameById(appState.activeGame);
  const card = game && appState.cards[game.id];
  const first = board && board.querySelector('.cell');
  if (!card || !first) return;
  const cw = first.clientWidth, ch = first.clientHeight;
  if (!cw || !ch) return;
  const cs = getComputedStyle(first);
  const pad = (parseFloat(cs.paddingLeft) || 2) + (parseFloat(cs.paddingRight) || 2);
  const padV = (parseFloat(cs.paddingTop) || 2) + (parseFloat(cs.paddingBottom) || 2);
  const measure = makeMeasure(board);
  const max = Math.max(11, Math.min(22, ch * 0.26));   // größere Felder (Zoom) erlauben größere Schrift
  board.querySelectorAll('.cell').forEach(el => {
    const c = card.cells[+el.dataset.p];
    if (c === null || c === undefined) return;
    const combo = isComboEntry(c), full = combo ? c.t : c;
    const kurz = appState.settings.useKurz ? kurzOf(game, full) : '';
    const variants = [displayText(full)];
    if (kurz && kurz !== full) variants.push(displayText(kurz));
    const res = fitText(variants, { w: cw - pad, h: ch - padV }, { measure: measure, max: max, reserve: combo ? (s => s * 0.98 + 3) : null });
    (combo ? el.querySelector('.cell-text') : el).textContent = res.lines.join('\n');
    el.classList.add('fit');
    el.classList.toggle('kurz', res.variant > 0 && !res.cut);
    el.dataset.shown = res.cut ? 'cut' : (res.variant === 0 ? 'full' : 'kurz');
    el.style.fontSize = res.size + 'px';
    if (res.cut || res.variant > 0) { if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', full); el.title = full; }
  });
}
let fitTimer = 0;
function fitBoardSoon() {
  if (fitTimer) return;
  fitTimer = setTimeout(() => { fitTimer = 0; fitBoard(); }, 60);
}
window.addEventListener('resize', fitBoardSoon);
window.addEventListener('orientationchange', fitBoardSoon);

// ── ZOOM (nur das Spielfeld) ─────────────────────────────────────────────────
const ZOOM_MIN = 100, ZOOM_MAX = 400;
let boardZoom = 100;
function applyZoom() {
  const board = document.getElementById('board'), sc = document.getElementById('boardScroll');
  board.style.width = boardZoom + '%';
  sc.classList.toggle('zoomed', boardZoom > 100);
  document.getElementById('zoomVal').textContent = boardZoom + ' %';
  document.getElementById('zoomOut').disabled = boardZoom <= ZOOM_MIN;
  document.getElementById('zoomIn').disabled = boardZoom >= ZOOM_MAX;
}
// z in Prozent; fx/fy = Brennpunkt im Rahmen (Standard: Mitte), der beim Zoomen an derselben Stelle bleibt.
function setZoom(z, fx, fy) {
  z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)));
  if (!(z > 0)) return;
  const sc = document.getElementById('boardScroll'), board = document.getElementById('board');
  const ox = fx === undefined ? sc.clientWidth / 2 : fx, oy = fy === undefined ? sc.clientHeight / 2 : fy;
  const before = { w: board.offsetWidth || 1, h: board.offsetHeight || 1, x: sc.scrollLeft + ox, y: sc.scrollTop + oy };
  boardZoom = z;
  applyZoom();
  const kx = (board.offsetWidth || 1) / before.w, ky = (board.offsetHeight || 1) / before.h;
  sc.scrollLeft = before.x * kx - ox;
  sc.scrollTop = before.y * ky - oy;
  fitBoard();
}
function zoomStep(dir) { setZoom(boardZoom * (dir > 0 ? 1.25 : 0.8)); }
function resetZoom() { boardZoom = 100; applyZoom(); }

// Zwei-Finger-Zoom auf dem Spielfeld
(function initPinch() {
  const sc = document.getElementById('boardScroll');
  if (!sc) return;
  let pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  sc.addEventListener('touchstart', e => { pinch = e.touches.length === 2 ? { d0: dist(e.touches) || 1, z0: boardZoom } : null; }, { passive: true });
  sc.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const r = sc.getBoundingClientRect();
    setZoom(pinch.z0 * dist(e.touches) / pinch.d0, (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top);
  }, { passive: false });
  const end = e => { if (e.touches.length < 2) pinch = null; };
  sc.addEventListener('touchend', end);
  sc.addEventListener('touchcancel', end);
})();
