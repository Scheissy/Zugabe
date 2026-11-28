// ── js/04-ansicht.js ── Tabs, Spieleliste, Karte, Modals, Toast ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('04-ansicht');

// ── MODALS ───────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
// Tipp auf den abgedunkelten Hintergrund schließt; Tipp auf die Karte selbst nicht.
function modalBackdropClick(e) {
  const el = e.target;
  if (el && el.classList && el.classList.contains('modal-backdrop')) closeModal(el.id);
}

// Gemeinsamer Bestätigungsdialog: askConfirm(Titel, Text, Beschriftung, Aktion)
let pendingConfirm = null;
function askConfirm(title, text, yesLabel, action) {
  pendingConfirm = action;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmYes').textContent = yesLabel;
  openModal('confirmModal');
}
function runConfirm() {
  const action = pendingConfirm;
  pendingConfirm = null;
  closeModal('confirmModal');
  if (action) action();
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── TABS ─────────────────────────────────────────────────────────────────────
const TABS = ['spiele', 'spiel', 'settings'];
let currentTab = 'spiele';
function switchTab(name) {
  if (!TABS.includes(name)) return;
  currentTab = name;
  TABS.forEach(t => {
    document.getElementById('view-' + t).classList.toggle('hidden', t !== name);
    document.getElementById('nav-' + t).classList.toggle('active', t === name);
  });
  if (name === 'spiele') renderSpiele();
  if (name === 'spiel') renderBoard();
  if (name === 'settings') renderValidationPanel();
  updateTopbarSub();
}
function updateTopbarSub() {
  const game = gameById(appState.activeGame);
  document.getElementById('topbarSub').textContent =
    currentTab === 'spiel' && game ? game.titel : currentTab === 'settings' ? 'Einstellungen' : 'Bingo für Konzerte';
}

// ── SPIELELISTE ──────────────────────────────────────────────────────────────
function zielLabel(game) { return game.ziel === 'vollbild' ? 'Vollbild' : 'Linie'; }
function renderSpiele() {
  const games = playableGames();
  const el = document.getElementById('gameList');
  if (!games.length) {
    el.innerHTML = '<div class="board-empty"><p>Keine spielbaren Spiele gefunden. Unter Settings → Datenqualität steht, was in bingo-data.js nicht stimmt.</p></div>';
    return;
  }
  el.innerHTML = games.map(g => {
    const card = appState.cards[g.id];
    const won = card && isWon(g, card);
    const total = felderBenoetigt(g);
    const done = card ? markedCount(card) : 0;
    const progress = card && appState.settings.showCounter ? `${done}/${total}` : (card ? 'läuft' : 'neu');
    return `<button type="button" class="game-card${g.id === appState.activeGame ? ' active' : ''}" data-id="${esc(g.id)}" onclick="openGame('${esc(g.id)}')">
      <div class="game-card-top"><span class="game-card-title">${esc(g.titel)}</span>${won ? '<span class="game-badge">Bingo</span>' : ''}</div>
      ${g.beschreibung ? `<div class="game-card-desc">${esc(g.beschreibung)}</div>` : ''}
      <div class="game-card-meta">${g.groesse}×${g.groesse} · ${zielLabel(g)}${g.freiMitte && g.groesse % 2 ? ' · Freifeld' : ''} · ${progress}</div>
      ${card ? `<div class="game-bar"><div class="game-bar-fill" style="width:${Math.round(done / total * 100)}%"></div></div>` : ''}
    </button>`;
  }).join('');
}
function openGame(id) {
  if (!startGame(id)) return;
  lupePos = -1;
  resetZoom();
  switchTab('spiel');
}

// ── KARTE ────────────────────────────────────────────────────────────────────
function renderBoard() {
  const game = gameById(appState.activeGame);
  const card = game && appState.cards[game.id];
  document.getElementById('boardEmpty').style.display = card ? 'none' : '';
  document.getElementById('boardContent').style.display = card ? '' : 'none';
  if (!card) { renderLupe(); return; }
  const n = game.groesse;
  const win = new Set();
  if (game.ziel === 'linie') winningLines(card, n).forEach(line => line.forEach(p => win.add(p)));
  const won = isWon(game, card);
  document.getElementById('boardTitle').textContent = game.titel;
  document.getElementById('boardMeta').textContent = appState.settings.showCounter
    ? `${markedCount(card)} von ${fieldCount(card)} Feldern · ${zielLabel(game)}` : zielLabel(game);
  const banner = document.getElementById('boardBanner');
  banner.style.display = won ? '' : 'none';
  if (won) {
    const k = winningLines(card, n).length;
    banner.textContent = game.ziel === 'vollbild' ? 'Vollbild! Alle Felder sind markiert.' : `Bingo! ${k} ${k === 1 ? 'Reihe' : 'Reihen'} voll.`;
  }
  const board = document.getElementById('board');
  board.style.setProperty('--n', n);
  board.classList.toggle('big', n >= 7);
  board.innerHTML = card.cells.map((c, p) => {
    const w = win.has(p) ? ' win' : '';
    if (c === null) return `<div class="cell n${n} free marked${w}" data-p="${p}">Frei</div>`;
    if (isCounterCell(c)) {
      const k = zahlOf(card, p), m = isMarked(card, p);
      const lab = displayText(appState.settings.useKurz && kurzOf(game, c.t) || c.t);
      return `<button type="button" class="cell n${n} counter${lab !== displayText(c.t) ? ' kurz' : ''}${m ? ' marked' : ''}${w}${hasInfo(card, p) ? ' info' : ''}" data-p="${p}" aria-haspopup="dialog" aria-label="${esc(c.t)}, ${esc(zahlText(c, k))} von ${c.ab}" title="${esc(c.t)}" onclick="openZahl(${p})"><span class="cell-text">${esc(lab)}</span><span class="cell-progress">${m ? '✓ ' + k : k + '/' + c.ab}</span></button>`;
    }
    if (isComboEntry(c)) {
      const k = comboCount(card, p);
      const lab = displayText(appState.settings.useKurz && kurzOf(game, c.t) || c.t);
      return `<button type="button" class="cell n${n} combo${lab !== displayText(c.t) ? ' kurz' : ''}${isMarked(card, p) ? ' marked' : ''}${w}${hasInfo(card, p) ? ' info' : ''}" data-p="${p}" aria-haspopup="dialog" aria-label="${esc(c.t)}, ${k} von ${c.ab} Häkchen" title="${esc(c.t)}" onclick="openCombo(${p})"><span class="cell-text">${esc(lab)}</span><span class="cell-progress">☑ ${k}/${c.ab}</span></button>`;
    }
    const m = card.marks.includes(p);
    const lab = displayText(appState.settings.useKurz && kurzOf(game, c) || c);
    const cnt = zaehlerAn() ? countOf(card, p) : 0;
    const ariaText = esc(c) + (cnt > 1 ? ', ' + cnt + ' mal' : '');
    const full = lab !== displayText(c) ? ` aria-label="${ariaText}" title="${esc(c)}"` : (cnt > 1 ? ` aria-label="${ariaText}"` : '');
    return `<button type="button" class="cell n${n}${lab !== displayText(c) ? ' kurz' : ''}${m ? ' marked' : ''}${w}${hasInfo(card, p) ? ' info' : ''}" data-p="${p}"${cnt > 1 ? ` data-n="${cnt}"` : ''}${full} aria-pressed="${m}" onclick="onCell(${p})">${esc(lab)}</button>`;
  }).join('');
  renderLupe();
  fitBoard();
}
function onCell(p) {
  const card = appState.cards[appState.activeGame];
  const n = card && zaehlerAn() ? countOf(card, p) : 0;
  if (n > 1) {   // Entmarkieren würde die Zählung löschen: vorher nachfragen
    lupePos = p;
    askConfirm('Markierung entfernen?', `Dieses Feld wurde ${n}× gezählt. Beim Entfernen der Markierung geht die Zählung verloren.`, 'Entfernen', () => toggleCell(p));
    renderLupe();
    return;
  }
  toggleCell(p);
}
function toggleCell(p) {
  lupePos = p;
  const r = toggleMark(appState.activeGame, p);
  if (!r.changed) { renderLupe(); return; }
  renderBoard();
  if (r.justWon) showToast('Bingo!');
}

// ── LUPE: ganzer Text des zuletzt angetippten Felds unter der Karte ───────────
let lupePos = -1;
function lupeActive(game) {
  const mode = appState.settings.lupe;
  if (mode === 'immer') return true;
  if (mode === 'aus') return false;
  return game.groesse >= 7 || Object.keys(game.kurz || {}).length > 0;
}
function renderLupe() {
  const el = document.getElementById('lupe');
  const game = gameById(appState.activeGame);
  const card = game && appState.cards[game.id];
  const on = !!card && lupeActive(game);
  el.style.display = on ? '' : 'none';
  if (!on) return;
  const c = lupePos >= 0 ? card.cells[lupePos] : null;
  if (c === null || c === undefined) { el.innerHTML = '<small>Tippe ein Feld an, um den ganzen Text hier zu lesen. Lang drücken: Datum &amp; Info.</small>'; return; }
  const full = isSpecialEntry(c) ? c.t : c;
  const meta = isCounterCell(c) ? (isMarked(card, lupePos) ? `geschafft · ${zahlText(c, zahlOf(card, lupePos))}` : `${zahlOf(card, lupePos)}/${c.ab}${c.u ? ' ' + c.u : ''}`)
    : isComboEntry(c) ? `☑ ${comboCount(card, lupePos)}/${c.ab}` : (card.marks.includes(lupePos) ? 'markiert' + (zaehlerAn() && countOf(card, lupePos) > 1 ? ' · ' + countOf(card, lupePos) + '×' : '') : 'nicht markiert');
  const det = detailsOf(card, lupePos);
  el.innerHTML = `<span class="lupe-text">${esc(full)}</span><small>${esc(meta)}</small>`
    + (det && det.d ? `<span class="lupe-detail">Datum: ${esc(formatDate(det.d))}</span>` : '')
    + (det && det.i ? `<span class="lupe-info">${esc(det.i)}</span>` : '')
    + `<button type="button" class="lupe-edit" onclick="openDetails(${lupePos})">${det ? 'Datum &amp; Info bearbeiten' : 'Datum &amp; Info ergänzen'}</button>`;
}

// ── KOMBI-FELDER: Checkliste im Dialog ───────────────────────────────────────
let comboPos = -1;
function currentCombo() {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[comboPos];
  return isComboEntry(c) ? { card: card, c: c } : null;
}
function openCombo(p) {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[p];
  if (!isComboEntry(c)) return;
  comboPos = p;
  lupePos = p;
  renderLupe();
  const checked = card.checks[p] || [];
  document.getElementById('comboTitle').textContent = c.t;
  document.getElementById('comboList').innerHTML = c.p.map((name, i) =>
    `<label class="combo-row"><input type="checkbox" data-i="${i}"${checked.includes(i) ? ' checked' : ''} onchange="onComboCheck(${i}, this.checked)"><span>${esc(name)}</span></label>`).join('');
  // Eigene Einträge: gespeicherte Texte, danach immer ein leeres Feld für den nächsten
  document.getElementById('comboOwn').style.display = c.e ? '' : 'none';
  document.getElementById('comboList').classList.toggle('has-own', !!c.e);
  document.getElementById('comboOwnList').innerHTML = '';
  if (c.e) { eigeneList(card, p).forEach(v => addOwnInput(v)); fillTrailingInput(); }
  updateComboProgress();
  openModal('comboModal');
}
function ownInputs() { return [...document.querySelectorAll('#comboOwnList .combo-own-input')]; }
function ownValues() { return ownInputs().map(i => i.value); }
function addOwnInput(value) {
  const cur = currentCombo();
  // Zeile wie bei den festen Punkten: Häkchen links (zeigt nur, ob der Eintrag zählt) und der Text als Eingabefeld
  const row = document.createElement('div');
  row.className = 'combo-row combo-own-row';
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'combo-own-check';
  check.tabIndex = -1;
  check.setAttribute('aria-hidden', 'true');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'combo-own-input';
  input.maxLength = MAX_EIGENE_LEN;
  input.placeholder = (cur && cur.c.h) || 'Weiteren Punkt eintragen';
  input.setAttribute('aria-label', input.placeholder);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('oninput', 'onOwnInput()');
  input.setAttribute('onchange', 'onOwnChange()');
  input.value = value || '';
  row.addEventListener('click', e => { if (e.target !== input) input.focus(); });
  row.appendChild(check);
  row.appendChild(input);
  document.getElementById('comboOwnList').appendChild(row);
}
// Es gibt immer genau ein leeres Feld am Ende - bis MAX_EIGENE Felder erreicht sind.
function fillTrailingInput() {
  let inputs = ownInputs();
  while (inputs.length > 1 && !inputs[inputs.length - 1].value.trim() && !inputs[inputs.length - 2].value.trim()) {
    inputs[inputs.length - 1].parentNode.remove();
    inputs = ownInputs();
  }
  if (!inputs.length || (inputs[inputs.length - 1].value.trim() && inputs.length < MAX_EIGENE)) addOwnInput('');
}
// Statustext eines Kombi-Felds (Checklisten-Dialog und Dialog „Datum & Info“).
function comboStatusText(card, p) {
  const c = card.cells[p], k = comboCount(card, p), done = k >= c.ab;
  if (c.e) return done ? `Geschafft: ${k} gezählt (nötig: ${c.ab}).` : `${k} gezählt – ab ${c.ab} zählt das Feld.`;
  return done ? `Geschafft: ${k} von ${c.p.length} abgehakt (nötig: ${c.ab}).` : `${k} von ${c.p.length} abgehakt – ab ${c.ab} zählt das Feld.`;
}
// Nur den Fortschrittstext aktualisieren, damit Checkboxen und Eingabefelder (und ihr Fokus) stehen bleiben.
function updateComboProgress() {
  const cur = currentCombo();
  if (!cur) return;
  const { card, c } = cur;
  const k = comboCount(card, comboPos);
  const done = k >= c.ab;
  const el = document.getElementById('comboProgress');
  el.textContent = comboStatusText(card, comboPos);
  el.classList.toggle('done', done);
  if (c.e) { // doppelte Einträge zählen nicht - sichtbar machen
    const seen = new Set(c.p.map(normEintrag));
    ownInputs().forEach(inp => {
      const key = normEintrag(inp.value);
      inp.classList.toggle('dup', !!key && seen.has(key));
      const chk = inp.parentNode.querySelector('.combo-own-check');
      if (chk) chk.checked = !!key && !inp.classList.contains('dup');   // Häkchen = der Eintrag zählt
      inp.title = inp.classList.contains('dup') ? 'Zählt nicht doppelt' : '';
      if (key) seen.add(key);
    });
  }
}
function onComboCheck(i, checked) {
  const r = toggleCheck(appState.activeGame, comboPos, i, checked);
  if (!r.changed) return;
  renderBoard();
  updateComboProgress();
  if (r.justWon) showToast('Bingo!');
}
// Tippen in einem Eingabefeld: sofort speichern, neues leeres Feld ergänzen.
function onOwnInput() {
  const r = setEigene(appState.activeGame, comboPos, ownValues());
  fillTrailingInput();
  if (r.changed) {
    renderBoard();
    if (r.justWon) showToast('Bingo!');
  }
  updateComboProgress();
}
// Feld verlassen: leere Felder mitten in der Liste aufräumen (das Feld mit dem Fokus bleibt).
function onOwnChange() {
  const inputs = ownInputs();
  inputs.forEach((el, i) => { if (!el.value.trim() && i < inputs.length - 1 && el !== document.activeElement) el.parentNode.remove(); });
  fillTrailingInput();
  updateComboProgress();
}

// ── ZÄHLFELDER: Zählerstand im Dialog ────────────────────────────────────────
let zahlPos = -1;
function currentZahl() {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[zahlPos];
  return isCounterCell(c) ? { card: card, c: c } : null;
}
function openZahl(p) {
  const card = appState.cards[appState.activeGame];
  const c = card && card.cells[p];
  if (!isCounterCell(c)) return;
  zahlPos = p;
  lupePos = p;
  renderLupe();
  document.getElementById('zahlTitle').textContent = c.t;
  renderZahlDialog(false);
  openModal('zahlModal');
}
// Statustext eines Zählfelds (Zähl-Dialog und Dialog „Datum & Info“).
function zahlStatusText(c, k) {
  return k >= c.ab ? `Geschafft: ${zahlText(c, k)} (nötig: ${c.ab}).` : `${zahlText(c, k)} – ab ${c.ab} zählt das Feld.`;
}
// Eingetippte Zahl auswerten: { n, keep } mit n auf MAX_ZAHL begrenzt (keep = false, wenn begrenzt werden musste), oder null bei Leerem/Ungültigem.
function parseZahlEingabe(v) {
  const s = String(v).trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return { n: Math.min(n, MAX_ZAHL), keep: n <= MAX_ZAHL };
}
// keepInput = true: das Eingabefeld nicht neu schreiben (sonst springt der Cursor beim Tippen).
function renderZahlDialog(keepInput) {
  const cur = currentZahl();
  if (!cur) return;
  const { card, c } = cur;
  const k = zahlOf(card, zahlPos), done = k >= c.ab;
  if (!keepInput) document.getElementById('zahlInput').value = String(k);
  document.getElementById('zahlUnit').textContent = c.u || '';
  const el = document.getElementById('zahlProgress');
  el.textContent = zahlStatusText(c, k);
  el.classList.toggle('done', done);
  document.getElementById('zahlMinus').disabled = k <= 0;
  document.getElementById('zahlPlus').disabled = k >= MAX_ZAHL;
  document.getElementById('zahlReset').disabled = k === 0;
}
function applyZahl(n, keepInput) {
  const r = setZahl(appState.activeGame, zahlPos, n);
  if (r.changed) {
    renderBoard();
    if (r.justWon) showToast('Bingo!');
  }
  renderZahlDialog(keepInput);
}
function zahlStep(dir) {
  const cur = currentZahl();
  if (cur) applyZahl(zahlOf(cur.card, zahlPos) + dir, false);
}
// Zahl direkt eintippen (z. B. 15): sofort speichern; Leeres oder Ungültiges ändert nichts, beim Verlassen des Felds zeigt es wieder den gespeicherten Stand.
function onZahlInput(v) {
  const z = parseZahlEingabe(v);
  if (z) applyZahl(z.n, z.keep);
}
function zahlReset() { applyZahl(0, false); }

function hasMarks() {
  const card = appState.cards[appState.activeGame];
  return !!card && markedCount(card) + Object.keys(card.checks || {}).length + Object.keys(card.eigene || {}).length + Object.keys(card.details || {}).length + Object.keys(card.stand || {}).length > 0;
}
function askNewCard() {
  const id = appState.activeGame;
  const run = () => { newCardFor(id); lupePos = -1; renderBoard(); showToast('Neue Karte'); };
  if (appState.settings.confirmNewCard && hasMarks()) askConfirm('Neue Karte?', 'Die aktuelle Karte mit ihren Markierungen wird ersetzt.', 'Neue Karte', run);
  else run();
}
function askResetMarks() {
  const id = appState.activeGame;
  const run = () => { resetMarks(id); renderBoard(); };
  if (appState.settings.confirmNewCard && hasMarks()) askConfirm('Markierungen löschen?', 'Die Karte bleibt, alle Markierungen werden entfernt.', 'Löschen', run);
  else run();
}
