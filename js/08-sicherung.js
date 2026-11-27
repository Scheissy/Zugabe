// ── js/08-sicherung.js ── Sicherung: Spielstände exportieren und importieren ──
// Teil der App: klassisches Skript im gemeinsamen globalen Bereich (Ladereihenfolge siehe index.html).
(window.BINGO_PARTS = window.BINGO_PARTS || []).push('08-sicherung');

// Die Sicherung ist eine JSON-Datei: { format, version, exportiert, daten, settings, spiele: { <id>: { titel, groesse, karte } } }.
// Beim Import wird jede Karte einzeln gegen das aktuelle Spiel geprüft (siehe checkImportedCard), erst danach wird etwas übernommen.
const BACKUP_FORMAT = 'zugabe-sicherung';
const BACKUP_VERSION = 1;
const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
const BACKUP_MAX_GAMES = 200;

// ── EXPORT ───────────────────────────────────────────────────────────────────
function buildBackup() {
  const spiele = {};
  Object.keys(appState.cards).forEach(id => {
    const card = appState.cards[id];
    const game = allGames.find(g => g && g.id === id);
    spiele[id] = {
      titel: game && typeof game.titel === 'string' ? game.titel : id,
      groesse: game ? game.groesse : (Array.isArray(card.cells) ? Math.round(Math.sqrt(card.cells.length)) : 0),
      karte: card
    };
  });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportiert: new Date().toISOString(), daten: { version: BINGO_DATA_VERSION }, settings: Object.assign({}, appState.settings), spiele: spiele };
}
function downloadText(name, text) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { if (URL.revokeObjectURL) URL.revokeObjectURL(url); }, 1000);
  return true;
}
function exportBackup() {
  if (!Object.keys(appState.cards).length) { showToast('Es gibt noch keine Spielstände zum Sichern.'); return false; }
  const ok = downloadText('zugabe-sicherung-' + todayStr() + '.json', JSON.stringify(buildBackup(), null, 1));
  showToast(ok ? 'Sicherung gespeichert' : 'Export wird in diesem Browser nicht unterstützt');
  return ok;
}

// ── IMPORT: Prüfung ──────────────────────────────────────────────────────────
// Liest den Dateitext. Rückgabe: { backup } oder { error: 'Meldung für den Menschen' }.
function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Die Datei ist leer.' };
  if (text.length > BACKUP_MAX_BYTES) return { error: 'Die Datei ist zu groß für eine Sicherung.' };
  let b;
  try { b = JSON.parse(text); } catch (e) { return { error: 'Die Datei ist keine gültige Sicherung (kein lesbares JSON).' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b) || b.format !== BACKUP_FORMAT) return { error: 'Das ist keine Zugabe-Sicherung.' };
  if (!Number.isInteger(b.version) || b.version < 1) return { error: 'Die Sicherung hat keine gültige Versionsnummer.' };
  if (b.version > BACKUP_VERSION) return { error: 'Die Sicherung stammt aus einer neueren Version der App. Bitte die App aktualisieren.' };
  if (!b.spiele || typeof b.spiele !== 'object' || Array.isArray(b.spiele)) return { error: 'Die Sicherung enthält keine Spielstände.' };
  if (Object.keys(b.spiele).length > BACKUP_MAX_GAMES) return { error: 'Die Sicherung enthält zu viele Spiele.' };
  return { backup: b };
}

// Stimmt ein Kombi-Feld der Karte exakt mit dem Kombi-Feld im Spiel überein (Punkte, Schwelle, eigene Einträge)?
function sameCombo(cell, f) {
  const cut = x => String(x).slice(0, MAX_FELD_LEN);
  return cell.ab === f.ab && !!cell.e === (f.eigene === true) && cell.p.length === f.punkte.length && cell.p.every((x, i) => x === cut(f.punkte[i]));
}
// Prüft eine importierte Karte gegen das Spiel. Rückgabe: { card, problems } - card ist null, sobald etwas nicht passt.
// Geprüft wird: Kartengröße und Freifeld (sanitizeCard), jedes Feld muss im Spiel vorhanden sein, Kombi-Felder müssen
// unverändert sein (sonst passen die Häkchen nicht mehr), kein Feld darf doppelt vorkommen.
function checkImportedCard(game, entry) {
  const problems = [];
  if (!entry || typeof entry !== 'object' || !entry.karte) return { card: null, problems: ['Der Eintrag enthält keine Karte.'], notes: [] };
  if (entry.groesse !== undefined && entry.groesse !== game.groesse) {
    problems.push('Die Kartengröße passt nicht (Sicherung ' + entry.groesse + '×' + entry.groesse + ', Spiel ' + game.groesse + '×' + game.groesse + ').');
  }
  const card = sanitizeCard(game, entry.karte);
  if (!card) { problems.push('Die Karte passt nicht zum Spiel (Größe oder Freifeld).'); return { card: null, problems: problems, notes: [] }; }
  // Textfelder, die im Spiel inzwischen Kombi-Felder sind, werden umgestellt (mit Hinweis) statt abgelehnt
  const migrated = migrateCombos(game, card);
  const notes = migrated.map(m => '„' + m.text + '“ ist jetzt ein Kombi-Feld (Häkchen pro Punkt)' + (m.wasMarked ? '; die frühere einfache Markierung wurde zurückgesetzt.' : '.'));
  const plain = new Set(), combos = new Map();
  game.felder.forEach(f => { if (isComboEntry(f)) combos.set(String(f.text).slice(0, MAX_FELD_LEN), f); else plain.add(String(f).slice(0, MAX_FELD_LEN)); });
  const seen = new Set(), missing = [], changed = [], dups = [];
  card.cells.forEach(c => {
    if (c === null) return;
    const key = isComboEntry(c) ? c.t : c;
    if (seen.has(key)) dups.push(key);
    seen.add(key);
    if (isComboEntry(c)) {
      const f = combos.get(c.t);
      if (!f) missing.push(c.t); else if (!sameCombo(c, f)) changed.push(c.t);
    } else if (!plain.has(c)) missing.push(c);
  });
  const list = a => a.slice(0, 3).map(x => '„' + x + '“').join(', ') + (a.length > 3 ? ' …' : '');
  if (missing.length) problems.push(missing.length + (missing.length === 1 ? ' Feld ist' : ' Felder sind') + ' im Spiel nicht vorhanden: ' + list(missing));
  if (changed.length) problems.push('Kombi-Feld hat sich im Spiel geändert: ' + list(changed));
  if (dups.length) problems.push('Ein Feld kommt mehrfach auf der Karte vor: ' + list(dups));
  return { card: problems.length ? null : card, problems: problems, notes: notes };
}

// Prüft die ganze Sicherung. Jedes Spiel einzeln: status 'ok' (importierbar) oder 'fehler' (mit Gründen).
function analyzeBackup(backup) {
  const games = Object.keys(backup.spiele).map(id => {
    const entry = backup.spiele[id];
    const game = /^[a-z0-9-]+$/.test(id) ? gameById(id) : null;
    const titel = game ? game.titel : String(entry && typeof entry.titel === 'string' ? entry.titel : id).slice(0, 60);
    if (!game) return { id: id, titel: titel, status: 'fehler', problems: ['Dieses Spiel gibt es in der App nicht (mehr) oder es ist fehlerhaft.'], notes: [], card: null, existing: null };
    const r = checkImportedCard(game, entry);
    const cur = appState.cards[id];
    return { id: id, titel: titel, status: r.card ? 'ok' : 'fehler', problems: r.problems, notes: r.card ? r.notes : [], card: r.card,
      existing: cur && Array.isArray(cur.cells) ? { markiert: markedCount(cur), felder: fieldCount(cur) } : null };
  });
  return { games: games, hasSettings: !!backup.settings && typeof backup.settings === 'object' && !Array.isArray(backup.settings),
    datum: typeof backup.exportiert === 'string' ? formatDate(backup.exportiert.slice(0, 10)) : '' };
}

// Übernimmt alle als 'ok' geprüften Karten (ersetzt die aktuelle Karte des jeweiligen Spiels); alles andere bleibt unangetastet.
function applyBackup(analysis, backup, opts) {
  let n = 0;
  analysis.games.forEach(g => { if (g.status === 'ok') { appState.cards[g.id] = g.card; n++; } });
  if (opts && opts.settings && analysis.hasSettings) appState.settings = sanitizeSettings(backup.settings);
  saveToStorage();
  return n;
}

// ── IMPORT: Oberfläche ───────────────────────────────────────────────────────
let pendingImport = null;
function chooseImportFile() { document.getElementById('importFile').click(); }
function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
function showImportError(msg) {
  pendingImport = null;
  document.getElementById('importBody').innerHTML = `<div class="imp-error" role="alert">${esc(msg)}</div>`;
  document.getElementById('importYes').style.display = 'none';
  openModal('importModal');
}
async function onImportFile(input) {
  const file = input.files && input.files[0];
  input.value = '';                 // dieselbe Datei lässt sich später noch einmal wählen
  if (!file) return;
  if (file.size > BACKUP_MAX_BYTES) { showImportError('Die Datei ist zu groß für eine Sicherung.'); return; }
  let text;
  try { text = await readFileText(file); } catch (e) { showImportError('Die Datei konnte nicht gelesen werden.'); return; }
  const parsed = parseBackup(text);
  if (parsed.error) { showImportError(parsed.error); return; }
  pendingImport = { backup: parsed.backup, analysis: analyzeBackup(parsed.backup) };
  renderImportDialog();
}
function renderImportDialog() {
  const { analysis } = pendingImport;
  const ok = analysis.games.filter(g => g.status === 'ok').length;
  const rows = analysis.games.map(g => {
    if (g.status === 'ok') {
      const note = g.existing ? `ersetzt die aktuelle Karte (${g.existing.markiert} von ${g.existing.felder} Feldern erledigt)` : 'legt die Karte neu an';
      return `<div class="imp-row imp-ok"><b>✓ ${esc(g.titel)}</b><small>${esc(note)}</small>${g.notes.map(n => `<small>${esc(n)}</small>`).join('')}</div>`;
    }
    return `<div class="imp-row imp-bad"><b>✕ ${esc(g.titel)}</b>${g.problems.map(p => `<small>${esc(p)}</small>`).join('')}<small>Wird nicht importiert.</small></div>`;
  }).join('');
  document.getElementById('importBody').innerHTML =
    `<div class="imp-head">${analysis.datum ? 'Sicherung vom ' + esc(analysis.datum) + ' · ' : ''}${analysis.games.length} ${analysis.games.length === 1 ? 'Spiel' : 'Spiele'}, davon ${ok} importierbar</div>` + (rows || '<div class="imp-row imp-bad"><small>Die Sicherung enthält keine Spielstände.</small></div>')
    + (analysis.hasSettings ? '<label class="imp-settings"><input type="checkbox" id="importSettings"> Einstellungen ebenfalls übernehmen</label>' : '');
  const yes = document.getElementById('importYes');
  yes.style.display = '';
  yes.disabled = ok === 0;
  yes.textContent = ok === 1 ? '1 Spielstand importieren' : ok + ' Spielstände importieren';
  openModal('importModal');
}
function runImport() {
  if (!pendingImport) return;
  const backup = pendingImport.backup;
  const analysis = analyzeBackup(backup);      // frisch prüfen: der Stand der App kann sich seit dem Öffnen des Dialogs geändert haben
  const box = document.getElementById('importSettings');
  const n = applyBackup(analysis, backup, { settings: !!(box && box.checked) });
  pendingImport = null;
  closeModal('importModal');
  lupePos = -1;
  applySettingsUI();
  renderSpiele();
  renderBoard();
  showToast(n === 1 ? '1 Spielstand importiert' : n + ' Spielstände importiert');
}
