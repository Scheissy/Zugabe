// ── js/07-details.js ── Datum und Info zu einem Feld: Dialog, langes Drücken ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('07-details');

// Beim langen Drücken startet der Browser (Android) zusätzlich seine eigene Textauswahl - sie landet dann auf dem Text, der nach dem
// Öffnen des Dialogs unter dem Finger liegt. Neben dem CSS (keine Textauswahl im Dialog) räumen wir eine angefangene Auswahl weg,
// aber nie, solange der Cursor in einem Eingabefeld steht.
function clearSelection() {
  const sel = window.getSelection && window.getSelection();
  const ae = document.activeElement;
  if (sel && sel.rangeCount && !(ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName))) sel.removeAllRanges();
}
function clearSelectionSoon() {
  clearSelection();
  [150, 700].forEach(ms => setTimeout(clearSelection, ms));
}

// Dialog: Datum (Datumsfeld, "Heute", "Entfernen") und Info-Text. Alles ist optional und wird sofort gespeichert.
let detailPos = -1;
function openDetails(p) {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[p];
  if (c === null || c === undefined) return;            // Freifeld und ungültige Felder haben keine Details
  detailPos = p;
  lupePos = p;
  const det = detailsOf(card, p) || {};
  document.getElementById('detailTitle').textContent = isComboEntry(c) ? c.t : c;
  document.getElementById('detailDate').value = det.d || '';
  document.getElementById('detailInfo').value = det.i || '';
  renderLupe();
  renderCountRow();
  clearSelectionSoon();
  openModal('detailModal');
}
// Zähler (nur Textfelder): zeigt, wie oft das Feld geschafft wurde; + auf einem unmarkierten Feld markiert es (= 1).
function renderCountRow() {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[detailPos];
  const row = document.getElementById('detailCountRow');
  const show = typeof c === 'string' && zaehlerAn();
  row.style.display = show ? '' : 'none';
  if (!show) return;
  const n = countOf(card, detailPos);
  document.getElementById('countVal').textContent = String(n);
  document.getElementById('countMinus').disabled = n <= 1;
  document.getElementById('countPlus').disabled = n >= MAX_COUNT;
}
function countStep(dir) {
  const card = appState.cards[appState.activeGame];
  if (!card || !zaehlerAn()) return;
  const r = setCount(appState.activeGame, detailPos, countOf(card, detailPos) + dir);
  if (!r.changed) return;
  document.getElementById('detailDate').value = (detailsOf(card, detailPos) || {}).d || '';   // Datum kann beim Markieren automatisch gesetzt worden sein
  renderBoard();
  renderCountRow();
  if (r.justWon) showToast('Bingo!');
}
function afterDetailChange(r) { if (r.changed) renderBoard(); }   // zeichnet auch die Lupe neu
function onDetailDate(v) { afterDetailChange(setDetail(appState.activeGame, detailPos, { d: v })); }
function onDetailInfo(v) { afterDetailChange(setDetail(appState.activeGame, detailPos, { i: v })); }
function detailToday() {
  const t = todayStr();
  document.getElementById('detailDate').value = t;
  onDetailDate(t);
}
function detailClearDate() {
  document.getElementById('detailDate').value = '';
  onDetailDate('');
}

// Langes Drücken auf ein Feld öffnet den Dialog; der anschließende Klick markiert das Feld nicht.
let LONGPRESS_MS = 550;
(function initLongPress() {
  const board = document.getElementById('board');
  if (!board) return;
  let timer = 0, fired = false, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  board.addEventListener('pointerdown', e => {
    fired = false;
    cancel();
    const cell = e.target.closest && e.target.closest('.cell');
    if (!cell || cell.classList.contains('free') || e.isPrimary === false) return;
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { timer = 0; fired = true; openDetails(+cell.dataset.p); }, LONGPRESS_MS);
  });
  board.addEventListener('pointermove', e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => board.addEventListener(type, cancel));
  board.addEventListener('click', e => { if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  board.addEventListener('contextmenu', e => e.preventDefault());
  // Der Finger wird meist über dem schon geöffneten Dialog losgelassen: nach einem langen Drücken die Auswahl wegräumen
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => { if (fired) { clearSelection(); setTimeout(clearSelection, 80); } }, true));
})();
