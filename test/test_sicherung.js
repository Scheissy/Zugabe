const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Sicherung: Spielstände exportieren und importieren. Schwerpunkt: der Import prüft jede Karte einzeln gegen das aktuelle Spiel
// (Spiel vorhanden, Größe, Freifeld, jedes Feld im Spiel vorhanden, Kombi-Felder unverändert) und übernimmt nur Geprüftes.
const TODAY = '2026-11-22';
const STR = n => Array.from({ length: n }, (_, i) => `'${String.fromCharCode(66 + i)}${i}'`);
function data({ a = 'Alpha', b = {}, c = true, d = false, v = 1 } = {}) {
  const combo = { text: 'Wetter', ab: 2, punkte: ['Sonne', 'Regen'], eigene: true, ...b };
  if (b.eigene === false) delete combo.eigene;
  const eight = [`'${a}'`, ...STR(7)];
  return `const BINGO_DATA_VERSION=${v}; const BINGO_GAMES=[
    { id:'a', titel:'Spiel A', groesse:3, freiMitte:true, ziel:'linie', felder:[${eight.join(',')}] },
    { id:'b', titel:'Spiel B', groesse:4, freiMitte:false, ziel:'vollbild', felder:[${STR(15).map(x => x.replace(/'(.)/, "'B$1")).join(',')}, ${JSON.stringify(combo)}] },
    ${c ? `{ id:'c', titel:'Spiel C', groesse:3, freiMitte:false, ziel:'linie', felder:[${STR(9).map(x => x.replace(/'(.)/, "'C$1")).join(',')}] },` : ''}
    ${d ? `{ id:'d', titel:'Spiel D', groesse:3, freiMitte:false, ziel:'linie', felder:[${STR(9).map(x => x.replace(/'(.)/, "'D$1")).join(',')}] },` : ''}
  ];`;
}
const json = o => JSON.parse(JSON.stringify(o));

(async () => {
  const t = createChecker();
  // ───────── Ausgangsstand: drei Spiele gespielt ─────────
  const A = await loadApp({ trackErrors: true, dataScript: data() });
  const w = A.window; w.todayStr = () => TODAY;
  ['a', 'b', 'c'].forEach(id => w.startGame(id));
  const ca = () => w.eval('appState.cards.a'), cb = () => w.eval('appState.cards.b'), cc = () => w.eval('appState.cards.c');
  const textPos = (card, n) => card.cells.map((c, p) => typeof c === 'string' ? p : -1).filter(p => p >= 0).slice(0, n);
  const [a1, a2] = textPos(ca(), 2), [c1] = textPos(cc(), 1), comboPos = cb().cells.findIndex(c => c && typeof c === 'object'), [b1] = textPos(cb(), 1);
  w.toggleMark('a', a1); w.toggleMark('a', a2); w.setDetail('a', a1, { i: 'Docks, Hamburg' });
  w.toggleMark('b', b1); w.toggleCheck('b', comboPos, 0, true); w.setEigene('b', comboPos, ['Schnee']);
  w.toggleMark('c', c1);
  w.setLupeMode('immer'); w.toggleSetting('icons', false);

  // ───────── 1) Export ─────────
  const bk = json(w.buildBackup());
  t.check('Sicherung hat Kennung, Version, Zeitstempel (ISO), Datenversion und Einstellungen.', bk.format === 'zugabe-sicherung' && bk.version === 1 && !isNaN(Date.parse(bk.exportiert)) && bk.daten.version === 1 && bk.settings.lupe === 'immer' && bk.settings.icons === false);
  t.check('Alle Spiele mit Karte sind enthalten (a, b, c), je mit Titel, Größe und Karte.', JSON.stringify(Object.keys(bk.spiele).sort()) === '["a","b","c"]' && bk.spiele.a.titel === 'Spiel A' && bk.spiele.b.groesse === 4 && bk.spiele.c.karte.cells.length === 9);
  t.check('Die Karten enthalten Markierungen, Häkchen, eigene Einträge, Datum und Info vollständig.', bk.spiele.a.karte.marks.length === 2 && bk.spiele.a.karte.details[a1].i === 'Docks, Hamburg' && bk.spiele.a.karte.details[a1].d === TODAY && bk.spiele.b.karte.checks[comboPos].join() === '0' && bk.spiele.b.karte.eigene[comboPos].join() === 'Schnee');
  const orphan = await loadApp({ dataScript: data(), storage: JSON.stringify({ cards: { zzz: { seed: 1, cells: ['q'], marks: [] } } }) });
  t.check('Auch eine Karte zu einem Spiel, das es gerade nicht gibt, wird mitgesichert (kann später wieder passen).', 'zzz' in json(orphan.window.buildBackup()).spiele);
  const empty = await loadApp({ dataScript: data() });
  empty.window.URL.createObjectURL = () => { throw new Error('darf nicht aufgerufen werden'); };
  t.check('Ohne Spielstände wird nichts exportiert (Hinweis statt leerer Datei).', empty.window.exportBackup() === false && /noch keine Spielstände/.test(empty.document.getElementById('toast').textContent));

  // ───────── 2) Datei lesen (parseBackup) ─────────
  const parse = x => w.parseBackup(typeof x === 'string' ? x : JSON.stringify(x));
  t.check('Gültige Sicherung wird gelesen.', !!parse(bk).backup && !parse(bk).error);
  const errs = { 'leer': '', 'nur Leerzeichen': '   ', 'kein JSON': '{{{', 'Zahl': '42', 'null': 'null', 'Liste': '[]', 'fremdes Format': { format: 'andere-app', version: 1, spiele: {} }, 'Format fehlt': { version: 1, spiele: {} },
    'Version fehlt': { format: 'zugabe-sicherung', spiele: {} }, 'Version 0': { format: 'zugabe-sicherung', version: 0, spiele: {} }, 'Version als Text': { format: 'zugabe-sicherung', version: '1', spiele: {} }, 'Version 1.5': { format: 'zugabe-sicherung', version: 1.5, spiele: {} },
    'neuere Version': { format: 'zugabe-sicherung', version: 2, spiele: {} }, 'spiele fehlt': { format: 'zugabe-sicherung', version: 1 }, 'spiele als Liste': { format: 'zugabe-sicherung', version: 1, spiele: [] }, 'spiele als Text': { format: 'zugabe-sicherung', version: 1, spiele: 'x' },
    'zu viele Spiele': { format: 'zugabe-sicherung', version: 1, spiele: Object.fromEntries(Array.from({ length: 201 }, (_, i) => ['g' + i, {}])) } };
  const bad = Object.entries(errs).filter(([, v]) => { const r = parse(v); return !r.error || r.backup; }).map(([k]) => k);
  t.check('Ungültige Dateien werden mit einer Meldung abgelehnt (leer, kein JSON, falsches Format, Version, Struktur, zu viele Spiele).', bad.length === 0, bad);
  t.check('Meldungen sind verständlich: neuere Version verweist auf ein Update, fremdes Format sagt "keine Zugabe-Sicherung".', /neueren Version/.test(parse(errs['neuere Version']).error) && /keine Zugabe-Sicherung/.test(parse(errs['fremdes Format']).error));
  t.check('Zu große Dateien werden abgelehnt.', /zu groß/.test(w.parseBackup('x'.repeat(5 * 1024 * 1024 + 1)).error));

  // ───────── 3) Prüfung gegen die Spiele (analyzeBackup) ─────────
  const analyze = async (dataScript, backup = bk, storage) => {
    const X = await loadApp({ dataScript, storage, trackErrors: true });
    X.window.todayStr = () => TODAY;
    const r = X.window.parseBackup(JSON.stringify(backup));
    return { X, an: r.backup ? X.window.analyzeBackup(r.backup) : null, backup: r.backup };
  };
  const status = an => Object.fromEntries(an.games.map(g => [g.id, g.status]));
  const same = await analyze(data());
  t.check('Gleiche Spiele: alle drei Karten sind importierbar, ohne Beanstandung.', JSON.stringify(status(same.an)) === '{"a":"ok","b":"ok","c":"ok"}' && same.an.games.every(g => g.problems.length === 0), same.an.games.map(g => g.problems));
  const ren = await analyze(data({ a: 'Alpha neu' }));
  const ga = ren.an.games.find(g => g.id === 'a');
  t.check('Ein Feld wurde im Spiel umbenannt: Karte A ist nicht importierbar, die fehlende Bezeichnung wird genannt; B und C bleiben importierbar.',
    ga.status === 'fehler' && ga.card === null && ga.problems.some(p => /1 Feld ist im Spiel nicht vorhanden: „Alpha“/.test(p)) && status(ren.an).b === 'ok' && status(ren.an).c === 'ok', ga.problems);
  const gone = await analyze(data({ c: false }));
  t.check('Ein Spiel gibt es in der App nicht mehr: nur dessen Karte wird abgelehnt.', status(gone.an).c === 'fehler' && /nicht (mehr )?|nicht\b/.test(gone.an.games.find(g => g.id === 'c').problems[0]) && status(gone.an).a === 'ok' && status(gone.an).b === 'ok');
  const extra = await analyze(data({ d: true }));
  t.check('Ein zusätzliches Spiel in der App (nicht in der Sicherung) stört nicht.', JSON.stringify(status(extra.an)) === '{"a":"ok","b":"ok","c":"ok"}' && !extra.an.games.some(g => g.id === 'd'));
  for (const [name, b] of [['Punkte geändert', { punkte: ['Sonne', 'Schnee'] }], ['Schwelle geändert', { ab: 3 }], ['eigene Einträge entfernt', { eigene: false }], ['anderer Titel', { text: 'Klima' }]]) {
    const r = await analyze(data({ b }));
    const gb = r.an.games.find(g => g.id === 'b');
    t.check(`Kombi-Feld im Spiel verändert (${name}): Karte B wird abgelehnt, die anderen bleiben importierbar.`, gb.status === 'fehler' && gb.problems.some(p => /Kombi-Feld|nicht vorhanden/.test(p)) && status(r.an).a === 'ok', gb.problems);
  }
  const newer = await analyze(data({ v: 7 }));
  t.check('Andere Datenversion allein ist kein Hindernis: jede Karte wird einzeln geprüft.', JSON.stringify(status(newer.an)) === '{"a":"ok","b":"ok","c":"ok"}');

  // Manipulierte Dateien
  const tamper = fn => { const b = json(bk); fn(b); return b; };
  const check1 = async (name, fn, id, expectOk) => {
    const r = await analyze(data(), tamper(fn));
    const g = r.an.games.find(x => x.id === id);
    t.check(`Manipuliert (${name}): ${expectOk ? 'wird bereinigt übernommen' : 'wird abgelehnt'}.`, expectOk ? g.status === 'ok' : g.status === 'fehler', g && g.problems);
    return g;
  };
  await check1('Kartengröße in der Datei stimmt nicht', b => { b.spiele.a.groesse = 5; }, 'a', false);
  await check1('Zellenzahl falsch', b => { b.spiele.a.karte.cells.pop(); }, 'a', false);
  await check1('Freifeld an falscher Stelle', b => { const c = b.spiele.a.karte.cells; c[4] = 'x'; c[0] = null; }, 'a', false);
  await check1('ein Feld doppelt', b => { const c = b.spiele.c.karte.cells; c[1] = c[0]; }, 'c', false);
  await check1('Feld, das im Spiel nicht vorkommt', b => { b.spiele.c.karte.cells[0] = 'Erfunden'; }, 'c', false);
  await check1('Karte fehlt', b => { delete b.spiele.c.karte; }, 'c', false);
  await check1('Eintrag ist null', b => { b.spiele.c = null; }, 'c', false);
  await check1('Karte ist ein Text', b => { b.spiele.c.karte = 'x'; }, 'c', false);
  await check1('Markierungen außerhalb und doppelt', b => { b.spiele.c.karte.marks = [0, 0, 99, -1, 'x']; }, 'c', true);
  const cleaned = (await analyze(data(), tamper(b => { b.spiele.c.karte.marks = [0, 0, 99, -1, 'x']; }))).an.games.find(g => g.id === 'c');
  t.check('Dabei bleiben nur gültige, eindeutige Markierungen übrig.', JSON.stringify(cleaned.card.marks) === '[0]', cleaned.card.marks);
  await check1('ungültiges Datum und überlange Info', b => { b.spiele.a.karte.details = { [a1]: { d: '2026-02-30', i: 'x'.repeat(500) } }; }, 'a', true);
  const detCard = (await analyze(data(), tamper(b => { b.spiele.a.karte.details = { [a1]: { d: '2026-02-30', i: 'x'.repeat(500) } }; }))).an.games.find(g => g.id === 'a').card;
  t.check('Dabei wird das ungültige Datum verworfen und die Info auf 200 Zeichen gekürzt.', !detCard.details[a1].d && detCard.details[a1].i.length === 200);
  const polluted = await analyze(data(), '{"format":"zugabe-sicherung","version":1,"spiele":{"__proto__":{"titel":"x","karte":{"cells":[]}},"constructor":{"karte":{"cells":["a"]}},"A B":{"karte":{}},"toString":null}}'.replace(/^/, '') && JSON.parse('{"format":"zugabe-sicherung","version":1,"spiele":{"__proto__":{"titel":"x","karte":{"cells":[]}},"constructor":{"karte":{"cells":["a"]}},"A B":{"karte":{}},"toString":null}}'));
  t.check('Gefährliche Spiel-Schlüssel (__proto__, constructor, Leerzeichen) werden als Fehler gemeldet, nichts wird verändert.', polluted.an.games.length >= 3 && polluted.an.games.every(g => g.status === 'fehler') && ({}).titel === undefined && polluted.X.window.eval('Object.keys(appState.cards).length') === 0);

  // ───────── 4) Übernehmen (applyBackup) ─────────
  const B = await loadApp({ dataScript: data(), trackErrors: true });
  B.window.todayStr = () => TODAY;
  const rb = B.window.parseBackup(JSON.stringify(bk));
  const anB = B.window.analyzeBackup(rb.backup);
  const n = B.window.applyBackup(anB, rb.backup, { settings: false });
  const cardsEqual = ['a', 'b', 'c'].every(id => JSON.stringify(B.window.eval(`appState.cards.${id}`)) === JSON.stringify(w.eval(`appState.cards.${id}`)));
  t.check('Import in eine leere App: 3 Karten, danach exakt gleich wie im Original (inkl. Häkchen, eigene Einträge, Datum, Info).', n === 3 && cardsEqual);
  t.check('Ohne Haken "Einstellungen" bleiben die Einstellungen der App unverändert.', B.window.eval('appState.settings.lupe') === 'auto' && B.window.eval('appState.settings.icons') === true);
  const persisted = JSON.parse(B.window.localStorage.getItem('zugabe-v1'));
  t.check('Der Import wird sofort gespeichert (localStorage).', Object.keys(persisted.cards).sort().join() === 'a,b,c' && persisted.cards.a.details[a1].i === 'Docks, Hamburg');
  const rt = await reloadWithState(B.window, { dataScript: data() });
  t.check('Nach einem Neustart sind die importierten Karten noch da.', JSON.stringify(rt.window.eval('appState.cards.b')) === JSON.stringify(w.eval('appState.cards.b')));

  // Teilimport: nur Geprüftes wird übernommen, Vorhandenes bleibt
  const C = await loadApp({ dataScript: data({ a: 'Alpha neu' }), trackErrors: true });
  C.window.startGame('a');
  const aBefore = JSON.stringify(C.window.eval('appState.cards.a'));
  const rc = C.window.parseBackup(JSON.stringify(bk));
  const anC = C.window.analyzeBackup(rc.backup);
  const nC = C.window.applyBackup(anC, rc.backup, { settings: false });
  t.check('Teilimport: nur B und C werden übernommen; die eigene Karte A bleibt unverändert, auch wenn die Sicherung eine A-Karte enthält.', nC === 2 && JSON.stringify(C.window.eval('appState.cards.a')) === aBefore && !!C.window.eval('appState.cards.b') && !!C.window.eval('appState.cards.c'));
  const D = await loadApp({ dataScript: data() });
  D.window.startGame('a'); const dOld = JSON.stringify(D.window.eval('appState.cards.a'));
  const rd2 = D.window.parseBackup(JSON.stringify(tamper(b => { ['a', 'b', 'c'].forEach(k => { b.spiele[k].karte.cells[0] = 'Erfunden'; }); })));
  const nD = D.window.applyBackup(D.window.analyzeBackup(rd2.backup), rd2.backup, {});
  t.check('Wird gar nichts akzeptiert, ändert sich nichts (0 Karten übernommen).', nD === 0 && JSON.stringify(D.window.eval('appState.cards.a')) === dOld && D.window.eval('Object.keys(appState.cards).length') === 1);

  // Einstellungen
  const sb = tamper(b => { b.settings = { lupe: 'quatsch', icons: 'ja', confirmNewCard: false, showCounter: false, extra: 1 }; });
  const E = await loadApp({ dataScript: data() });
  const re = E.window.parseBackup(JSON.stringify(sb));
  E.window.applyBackup(E.window.analyzeBackup(re.backup), re.backup, { settings: true });
  t.check('Einstellungen aus der Sicherung werden geprüft übernommen: falsche Werte fallen auf den Standard, Unbekanntes fällt weg.', E.window.eval('appState.settings.confirmNewCard') === false && E.window.eval('appState.settings.showCounter') === false && E.window.eval('appState.settings.lupe') === 'auto' && E.window.eval('appState.settings.icons') === true && !('extra' in E.window.eval('appState.settings')));
  const noSet = tamper(b => { delete b.settings; });
  t.check('Eine Sicherung ohne Einstellungen ist gültig; es wird nichts an den Einstellungen geändert.', (x => x.hasSettings === false)(E.window.analyzeBackup(E.window.parseBackup(JSON.stringify(noSet)).backup)));

  // ───────── 5) Oberfläche ─────────
  const U = await loadApp({ trackErrors: true, dataScript: data() });
  const uw = U.window, ud = U.document, UH = createHelpers(uw, ud);
  uw.todayStr = () => TODAY;
  const input = ud.getElementById('importFile');
  const pick = async (text, name = 'sicherung.json') => {
    const file = new uw.File([text], name, { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await uw.onImportFile(input);
  };
  t.check('Settings: Bereich "Sicherung" mit Export und Import; die Dateiauswahl nimmt .json an.', [...ud.querySelectorAll('#view-settings .io-section-title')].some(e => e.textContent === 'Sicherung') && /Spielstände exportieren/.test(ud.body.textContent) && /Spielstände importieren/.test(ud.body.textContent) && /json/.test(input.accept));
  // Export über die Oberfläche
  ['a', 'b'].forEach(id => uw.startGame(id)); uw.toggleMark('a', textPos(uw.eval('appState.cards.a'), 1)[0]);
  const blobs = [], clicks = [];
  uw.URL.createObjectURL = b => { blobs.push(b); return 'blob:test'; }; uw.URL.revokeObjectURL = () => {};
  uw.HTMLAnchorElement.prototype.click = function () { clicks.push({ download: this.download, href: this.href }); };
  UH.click(ud.querySelector('#view-settings .io-btn'));
  const text = await new Promise(res => { const r = new uw.FileReader(); r.onload = () => res(r.result); r.readAsText(blobs[0]); });
  const exported = JSON.parse(text);
  t.check('Export: es wird eine Datei "zugabe-sicherung-<Datum>.json" heruntergeladen (Blob, application/json).', clicks.length === 1 && clicks[0].download === `zugabe-sicherung-${TODAY}.json` && clicks[0].href === 'blob:test' && blobs[0].type === 'application/json');
  t.check('Die Datei enthält beide Spiele und lässt sich wieder einlesen.', Object.keys(exported.spiele).join() === 'a,b' && !uw.parseBackup(text).error && /Sicherung gespeichert/.test(ud.getElementById('toast').textContent));
  t.check('Das Anhängsel der Anker-Elemente wird wieder entfernt (kein Müll im Dokument).', ud.querySelectorAll('a[download]').length === 0);

  // Import: Dialog
  const imp = await loadApp({ trackErrors: true, dataScript: data({ a: 'Alpha neu' }) });
  const iw = imp.window, id = imp.document, IH = createHelpers(iw, id), inp = id.getElementById('importFile');
  iw.todayStr = () => TODAY; iw.startGame('c'); iw.toggleMark('c', textPos(iw.eval('appState.cards.c'), 1)[0]);
  const pick2 = async (txt, name = 's.json') => { const f = new iw.File([txt], name); Object.defineProperty(inp, 'files', { value: [f], configurable: true }); await iw.onImportFile(inp); };
  await pick2(JSON.stringify(bk));
  const rows = [...id.querySelectorAll('#importBody .imp-row')];
  t.check('Dialog: eine Zeile je Spiel; A wird abgelehnt (mit Grund und "Wird nicht importiert"), B und C sind importierbar.', IH.modalOpen('importModal') && rows.length === 3 && rows.filter(r => r.classList.contains('imp-ok')).length === 2 && /Alpha/.test(rows.find(r => r.classList.contains('imp-bad')).textContent) && /Wird nicht importiert/.test(rows.find(r => r.classList.contains('imp-bad')).textContent));
  t.check('Für C, wo schon eine Karte mit Fortschritt existiert, steht die Warnung "ersetzt die aktuelle Karte (… von … erledigt)"; für B "legt die Karte neu an".', /ersetzt die aktuelle Karte \(1 von 9 Feldern erledigt\)/.test(rows.find(r => /Spiel C/.test(r.textContent)).textContent) && /legt die Karte neu an/.test(rows.find(r => /Spiel B/.test(r.textContent)).textContent));
  t.check('Der Importieren-Button nennt die Zahl (2 Spielstände), das Datum der Sicherung und die Kopfzeile stimmen, die Checkbox für Einstellungen ist vorhanden und aus.', id.getElementById('importYes').textContent === '2 Spielstände importieren' && !id.getElementById('importYes').disabled && /Sicherung vom \d\d\.\d\d\.\d{4} · 3 Spiele, davon 2 importierbar/.test(id.getElementById('importBody').textContent) && id.getElementById('importSettings').checked === false);
  const cOld = JSON.stringify(iw.eval('appState.cards.c'));
  IH.click(id.querySelector('#importModal .form-btn-cancel'));
  t.check('Abbrechen: nichts wurde verändert.', !IH.modalOpen('importModal') && JSON.stringify(iw.eval('appState.cards.c')) === cOld && !iw.eval('appState.cards.b'));
  await pick2(JSON.stringify(bk));
  id.getElementById('importSettings').checked = true;
  IH.click(id.getElementById('importYes'));
  t.check('Importieren: B und C übernommen, A nicht; Dialog zu, Meldung "2 Spielstände importiert", Einstellungen (Haken gesetzt) übernommen.', !IH.modalOpen('importModal') && !!iw.eval('appState.cards.b') && JSON.stringify(iw.eval('appState.cards.c')) !== cOld && !iw.eval('appState.cards.a') && /2 Spielstände importiert/.test(id.getElementById('toast').textContent) && iw.eval('appState.settings.lupe') === 'immer' && iw.eval('appState.settings.icons') === false);
  t.check('Die Spieleliste zeigt den importierten Stand (Fortschritt von B).', !!id.querySelector('.game-card[data-id="b"] .game-bar-fill'));
  // Fehlerfälle in der Oberfläche
  for (const [name, txt, re] of [['kein JSON', 'hallo', /kein lesbares JSON/], ['fremdes Format', '{"a":1}', /keine Zugabe-Sicherung/], ['neuere Version', JSON.stringify({ format: 'zugabe-sicherung', version: 9, spiele: {} }), /neueren Version/]]) {
    await pick2(txt);
    t.check(`Ungültige Datei (${name}): Fehlermeldung im Dialog, kein Importieren-Button.`, IH.modalOpen('importModal') && re.test(id.getElementById('importBody').textContent) && id.getElementById('importYes').style.display === 'none');
    iw.closeModal('importModal');
  }
  const big = new iw.File(['x'], 'gross.json'); Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
  Object.defineProperty(inp, 'files', { value: [big], configurable: true }); await iw.onImportFile(inp);
  t.check('Zu große Datei: Meldung, ohne sie zu lesen.', /zu groß/.test(id.getElementById('importBody').textContent));
  iw.closeModal('importModal');
  Object.defineProperty(inp, 'files', { value: [], configurable: true });
  await iw.onImportFile(inp);
  t.check('Keine Datei gewählt: es passiert nichts.', !IH.modalOpen('importModal'));
  await pick2(JSON.stringify(tamper(b => { b.spiele.c.karte.cells[0] = 'Erfunden'; b.spiele.b.karte.cells[0] = 'Auch erfunden'; b.spiele.a.karte.cells[0] = 'Drittes'; })));
  t.check('Ist nichts importierbar, ist der Button gesperrt und beschriftet mit "0 Spielstände importieren".', id.getElementById('importYes').disabled === true && id.getElementById('importYes').textContent === '0 Spielstände importieren');
  iw.closeModal('importModal');
  // Sonderzeichen in der Datei
  await pick2(JSON.stringify(tamper(b => { b.spiele.c.karte.cells[0] = '"><img src=x onerror=window.__pwned=1>'; b.spiele.c.titel = '<b>x</b>'; })));
  t.check('Sonderzeichen aus der Datei (Feldname in der Fehlermeldung) werden als Text angezeigt, nicht ausgeführt.', !iw.__pwned && !id.querySelector('#importBody img, #importBody b b') && /<img src=x/.test(id.getElementById('importBody').textContent) && imp.errors.length === 0, imp.errors);
  iw.closeModal('importModal');
  const valueWrites = []; Object.defineProperty(inp, 'value', { configurable: true, get: () => '', set: v => valueWrites.push(v) });
  await pick2(JSON.stringify(bk));
  t.check('Die Dateiauswahl wird nach dem Lesen geleert, damit dieselbe Datei erneut gewählt werden kann.', valueWrites.includes(''));
  t.check('Dieselbe Datei kann nach dem Schließen erneut gewählt werden (die Dateiauswahl wird nach dem Lesen geleert).', IH.modalOpen('importModal') && id.querySelectorAll('#importBody .imp-row').length === 3);
  iw.closeModal('importModal');

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', A.errors.length === 0 && B.errors.length === 0 && C.errors.length === 0 && U.errors.length === 0 && imp.errors.length === 0, [...A.errors, ...imp.errors]);
  t.finish();
})();
