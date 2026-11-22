const { loadApp, reloadWithState, createChecker, createHelpers } = require('./test-helpers');

// Datum und Info zu einem Feld (beides optional): Datums-Helfer, automatisches Datum beim Markieren, setDetail,
// Speicher, Dialog, Lupe, Hinweispunkt auf dem Feld, langes Drücken, Zurücksetzen.
const GAME = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'k', titel:'K', groesse:3, freiMitte:false, ziel:'linie',
  felder:['a','b','c','d','e','f','g','h', { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }] },
  { id:'f', titel:'F', groesse:3, freiMitte:true, ziel:'linie', felder:['a','b','c','d','e','f','g','h'] }];`;
const TODAY = '2026-11-22';

(async () => {
  const t = createChecker();
  const A = await loadApp({ trackErrors: true, dataScript: GAME });
  const w = A.window, d = A.document, H = createHelpers(w, d);
  w.todayStr = () => TODAY;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const card = () => w.eval('appState.cards.k');
  const det = p => card().details[p];

  // ───────── 1) Datums-Helfer ─────────
  t.check('isValidDate: gültige Kalenderdaten (auch Schaltjahr 2024-02-29) und die Grenzen 1900/2200.', ['2026-11-22', '2024-02-29', '1900-01-01', '2200-12-31'].every(s => w.isValidDate(s)));
  t.check('isValidDate: ungültig sind 2026-02-29, 2026-13-01, 2026-00-10, 2026-04-31, falsche Formate, leere Werte, Jahre außerhalb.', ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-1', '22.11.2026', '', ' 2026-11-22', '1899-12-31', '2201-01-01', 'abc'].every(s => !w.isValidDate(s)) && [null, undefined, 20261122, {}, []].every(s => !w.isValidDate(s)));
  t.check('formatDate: "2026-11-22" -> "22.11.2026"; ungültig -> leer.', w.formatDate('2026-11-22') === '22.11.2026' && w.formatDate('2026-02-30') === '' && w.formatDate('') === '');
  const real = await loadApp();
  const now = new Date();
  t.check('todayStr liefert das heutige Datum (lokal) als JJJJ-MM-TT und ist gültig.', real.window.todayStr() === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` && real.window.isValidDate(real.window.todayStr()));

  // ───────── 2) Automatisches Datum beim Markieren ─────────
  w.localStorage.clear(); w.startGame('k');
  const cells = card().cells, plain = cells.map((c, p) => typeof c === 'string' ? p : -1).filter(p => p >= 0), cp = cells.findIndex(c => c && typeof c === 'object');
  const [p1, p2, p3] = plain;
  t.check('Neue Karte hat leere Details; Einstellung "Datum automatisch" ist standardmäßig an.', JSON.stringify(card().details) === '{}' && w.eval('appState.settings.autoDatum') === true);
  w.toggleMark('k', p1);
  t.check('Beim Markieren wird das heutige Datum eingetragen (ohne Info).', JSON.stringify(det(p1)) === `{"d":"${TODAY}"}`, det(p1));
  w.setDetail('k', p1, { d: '2026-05-01' });
  w.toggleMark('k', p1); w.toggleMark('k', p1);
  t.check('Entmarkieren und erneut Markieren lässt das eigene Datum stehen (es wird nicht überschrieben).', det(p1).d === '2026-05-01');
  w.toggleMark('k', p1);
  t.check('Entmarkieren löscht Datum und Info nicht.', !card().marks.includes(p1) && det(p1).d === '2026-05-01');
  w.toggleMark('k', p1);
  w.setDetail('k', p2, { i: 'Docks' });
  w.toggleMark('k', p2);
  t.check('Ein Feld mit Info, aber ohne Datum, bekommt beim Markieren das Datum und behält die Info (Reihenfolge d, i).', JSON.stringify(det(p2)) === `{"d":"${TODAY}","i":"Docks"}`, det(p2));
  w.setDetail('k', p3, { d: '' });
  w.toggleMark('k', p3);
  t.check('Ein ohne Datum angelegtes Feld bekommt beim Markieren das Datum.', det(p3).d === TODAY);

  w.setDetail('k', p3, { d: '' });
  w.toggleMark('k', p3); w.toggleMark('k', p3);
  t.check('Entferntes Datum: erneutes Markieren trägt wieder das heutige Datum ein.', det(p3).d === TODAY);

  // Kombi-Feld: Datum erst bei Erreichen der Schwelle
  w.toggleCheck('k', cp, 0, true);
  t.check('Kombi-Feld unter der Schwelle: noch kein Datum.', !det(cp));
  w.toggleCheck('k', cp, 1, true);
  t.check('Kombi-Feld erreicht die Schwelle: Datum wird eingetragen.', det(cp) && det(cp).d === TODAY);
  w.toggleCheck('k', cp, 1, false);
  t.check('Fällt das Kombi-Feld wieder unter die Schwelle, bleibt das Datum erhalten.', det(cp) && det(cp).d === TODAY);

  // Einstellung aus
  w.resetMarks('k');
  w.toggleSetting('autoDatum', false);
  w.toggleMark('k', p1);
  t.check('Einstellung "Datum automatisch" aus: beim Markieren wird kein Datum eingetragen.', !det(p1));
  w.setDetail('k', p1, { i: 'Nur Info' }); w.toggleMark('k', p1); w.toggleMark('k', p1);
  t.check('Mit der Einstellung aus bleibt auch eine vorhandene Info ohne Datum.', JSON.stringify(det(p1)) === '{"i":"Nur Info"}');
  w.toggleSetting('autoDatum', true);

  // ───────── 3) setDetail ─────────
  w.resetMarks('k');
  let r = w.setDetail('k', p1, { i: '  Hamburg, Docks  ' });
  t.check('Info wird getrimmt gespeichert.', r.changed && JSON.stringify(det(p1)) === '{"i":"Hamburg, Docks"}');
  r = w.setDetail('k', p1, { d: '2026-12-24' });
  t.check('Datum ergänzen lässt die Info stehen (Reihenfolge d, i).', r.changed && JSON.stringify(det(p1)) === '{"d":"2026-12-24","i":"Hamburg, Docks"}');
  r = w.setDetail('k', p1, { d: '2026-12-24', i: 'Hamburg, Docks' });
  t.check('Gleiche Werte noch einmal setzen ändert nichts.', !r.changed);
  r = w.setDetail('k', p1, { d: 'kein Datum' });
  t.check('Ungültiges Datum entfernt nur das Datum, die Info bleibt.', r.changed && JSON.stringify(det(p1)) === '{"i":"Hamburg, Docks"}');
  w.setDetail('k', p1, { i: 'x'.repeat(300) });
  t.check('Info wird auf 200 Zeichen gekürzt.', det(p1).i.length === 200);
  w.setDetail('k', p1, { i: '   ' });
  t.check('Leere Info und kein Datum: der Eintrag verschwindet ganz.', !(p1 in card().details));
  t.check('Ungültige Aufrufe werden ignoriert (Zahl als Info, unbekanntes Spiel/Feld, kein Objekt).',
    !w.setDetail('k', p1, { i: 5 }).changed && !w.setDetail('nix', p1, { i: 'x' }).changed && !w.setDetail('k', 99, { i: 'x' }).changed && !w.setDetail('k', -1, { i: 'x' }).changed && !w.setDetail('k', 1.5, { i: 'x' }).changed && !w.setDetail('k', p1, null).changed && !w.setDetail('k', p1, 'x').changed && JSON.stringify(card().details) === '{}');
  w.startGame('f');
  t.check('Das Freifeld hat keine Details.', !w.setDetail('f', 4, { i: 'x' }).changed && JSON.stringify(w.eval('appState.cards.f.details')) === '{}');
  w.setDetail('k', cp, { i: 'Kombi' });
  t.check('Auch ein Kombi-Feld kann Details haben.', det(cp).i === 'Kombi');

  w.setDetail('k', p1, { i: 'weg' }); w.resetMarks('k');
  t.check('Markierungen löschen entfernt auch Datum und Info.', JSON.stringify(card().details) === '{}');
  w.setDetail('k', p1, { i: 'weg' }); w.newCardFor('k');
  t.check('Neue Karte startet ohne Details.', JSON.stringify(card().details) === '{}');

  // ───────── 4) Speicher ─────────
  const base = (extra = {}) => ({ seed: 1, cells: ['a', 'b', { t: 'Sprachen', p: ['Eins', 'Zwei'], ab: 1 }, 'd', 'e', 'f', 'g', 'h', 'i'], marks: [], checks: {}, ...extra });
  const load = async (c, data = GAME) => (await loadApp({ dataScript: data, storage: JSON.stringify({ cards: { k: c }, activeGame: 'k' }) })).window.eval('appState.cards.k');
  const ok = await load(base({ details: { 0: { d: '2026-11-22', i: 'Docks' }, 2: { i: 'Kombi' } } }));
  t.check('Gespeicherte Details werden geladen (auch am Kombi-Feld).', JSON.stringify(ok.details) === '{"0":{"d":"2026-11-22","i":"Docks"},"2":{"i":"Kombi"}}', ok.details);
  t.check('Karte ohne details-Eintrag lädt mit leeren Details.', JSON.stringify((await load(base())).details) === '{}');
  const messy = await load(base({ details: { 0: { d: '2026-02-30', i: '  Text  ' }, 1: { d: 'x', i: 5 }, 3: { d: '2026-01-01', i: 'y'.repeat(500) }, 4: 'nope', 5: null, 6: [], 7: {}, abc: { i: 'x' }, '02': { i: 'x' }, '-1': { i: 'x' }, 99: { i: 'x' } } }));
  t.check('Bereinigung: ungültiges Datum und Nicht-Text-Info fallen weg, Info getrimmt und auf 200 gekürzt, leere/ungültige Einträge und fremde Schlüssel entfallen.',
    JSON.stringify(Object.keys(messy.details)) === '["0","3"]' && JSON.stringify(messy.details[0]) === '{"i":"Text"}' && messy.details[3].d === '2026-01-01' && messy.details[3].i.length === 200, messy.details);
  t.check('details als Liste statt Objekt wird ignoriert, die Karte bleibt gültig.', (c => c && JSON.stringify(c.details) === '{}')(await load(base({ details: [1, 2] }))));
  const free = await load({ seed: 1, cells: ['a', 'b', 'c', 'd', null, 'f', 'g', 'h', 'i'], marks: [], details: { 4: { i: 'x' }, 0: { i: 'y' } } }, GAME.replace("id:'k', titel:'K', groesse:3, freiMitte:false", "id:'k', titel:'K', groesse:3, freiMitte:true").replace(", { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','Drei'] }", ""));
  t.check('Details am Freifeld werden verworfen.', free && JSON.stringify(Object.keys(free.details)) === '["0"]', free && free.details);
  const bad = await loadApp({ storage: JSON.stringify({ settings: { autoDatum: 'ja' } }) });
  t.check('Ungültiger Wert der Einstellung fällt auf "an" zurück.', bad.window.eval('appState.settings.autoDatum') === true);

  // ───────── 5) Oberfläche ─────────
  const B = await loadApp({ trackErrors: true, dataScript: GAME });
  const bw = B.window, bd = B.document, BH = createHelpers(bw, bd);
  bw.todayStr = () => TODAY;
  BH.openGameById('k'); bw.setLupeMode('immer');
  const bc = () => bw.eval('appState.cards.k');
  const cellsB = bc().cells, plainB = cellsB.map((c, p) => typeof c === 'string' ? p : -1).filter(p => p >= 0), comboB = cellsB.findIndex(c => c && typeof c === 'object');
  const [q1, q2, q3] = plainB;
  const lupe = () => bd.getElementById('lupe');
  t.check('Lupe zeigt am Anfang den Hinweis samt "Lang drücken: Datum & Info".', /Lang drücken: Datum & Info/.test(lupe().textContent));
  BH.click(BH.cell(q1));
  t.check('Antippen markiert und trägt das heutige Datum ein; die Lupe zeigt "Datum: 22.11.2026" und den Button "Datum & Info bearbeiten".', BH.cell(q1).classList.contains('marked') && bc().details[q1].d === TODAY && /Datum: 22\.11\.2026/.test(lupe().textContent) && lupe().querySelector('.lupe-edit').textContent === 'Datum & Info bearbeiten');
  BH.click(lupe().querySelector('.lupe-edit'));
  const dateIn = bd.getElementById('detailDate'), infoIn = bd.getElementById('detailInfo');
  t.check('Der Button öffnet den Dialog: Titel = Feldtext, Datum = heute, Info leer, Info auf 200 Zeichen begrenzt.', BH.modalOpen('detailModal') && bd.getElementById('detailTitle').textContent === cellsB[q1] && dateIn.value === TODAY && infoIn.value === '' && infoIn.maxLength === 200);
  dateIn.value = '2026-12-24'; dateIn.dispatchEvent(new bw.Event('change', { bubbles: true }));
  t.check('Datum ändern: gespeichert, die Lupe zeigt es sofort.', bc().details[q1].d === '2026-12-24' && /Datum: 24\.12\.2026/.test(lupe().textContent));
  BH.click(bd.querySelector('#detailModal .detail-date-row button:nth-of-type(1)'));
  t.check('"Heute" setzt das heutige Datum ins Feld und speichert es.', dateIn.value === TODAY && bc().details[q1].d === TODAY);
  BH.click(bd.querySelector('#detailModal .detail-date-row button:nth-of-type(2)'));
  t.check('"Entfernen" löscht das Datum (Feld leer, nichts gespeichert); die Lupe zeigt kein Datum und bietet "ergänzen" an.', dateIn.value === '' && !bc().details[q1] && !/Datum:/.test(lupe().textContent) && lupe().querySelector('.lupe-edit').textContent === 'Datum & Info ergänzen');
  t.check('Das Markieren des Felds bleibt davon unberührt.', BH.cell(q1).classList.contains('marked'));
  infoIn.value = 'Hamburg, Docks'; infoIn.dispatchEvent(new bw.Event('input', { bubbles: true }));
  t.check('Info tippen: sofort gespeichert, Hinweispunkt auf dem Feld, Text in der Lupe.', bc().details[q1].i === 'Hamburg, Docks' && BH.cell(q1).classList.contains('info') && lupe().querySelector('.lupe-info').textContent === 'Hamburg, Docks');
  infoIn.value = 'z'.repeat(300); infoIn.dispatchEvent(new bw.Event('input', { bubbles: true }));
  t.check('Zu lange Info wird auf 200 Zeichen gekürzt gespeichert.', bc().details[q1].i.length === 200);
  infoIn.value = ''; infoIn.dispatchEvent(new bw.Event('input', { bubbles: true }));
  t.check('Info leeren: Hinweispunkt weg, Eintrag weg.', !BH.cell(q1).classList.contains('info') && !bc().details[q1]);
  BH.click(bd.getElementById('detailModal'));
  t.check('Tipp auf den Hintergrund schließt den Dialog.', !BH.modalOpen('detailModal'));

  // unmarkiertes Feld: Details vorab, Datum kommt beim Markieren dazu
  bw.openDetails(q2);
  bd.getElementById('detailInfo').value = 'Vorab notiert'; bd.getElementById('detailInfo').dispatchEvent(new bw.Event('input', { bubbles: true }));
  bw.closeModal('detailModal');
  t.check('Details eines noch nicht markierten Felds: Info gespeichert, Feld bleibt unmarkiert, Datum noch leer.', !BH.cell(q2).classList.contains('marked') && JSON.stringify(bc().details[q2]) === '{"i":"Vorab notiert"}' && BH.cell(q2).classList.contains('info'));
  BH.click(BH.cell(q2));
  t.check('Beim Markieren kommt das Datum zur vorhandenen Info.', JSON.stringify(bc().details[q2]) === `{"d":"${TODAY}","i":"Vorab notiert"}`);

  // Kombi-Feld über die Oberfläche
  BH.click(BH.cell(comboB));
  const boxes = () => [...bd.querySelectorAll('#comboList input')];
  [0, 1].forEach(i => { boxes()[i].checked = true; boxes()[i].dispatchEvent(new bw.Event('change', { bubbles: true })); });
  bw.closeModal('comboModal');
  t.check('Kombi-Feld über die Checkliste fertig: Datum automatisch, in der Lupe sichtbar.', bc().details[comboB].d === TODAY && /Datum: 22\.11\.2026/.test(lupe().textContent));
  bw.openDetails(comboB);
  t.check('Dialog für ein Kombi-Feld zeigt dessen Titel und Datum.', BH.modalOpen('detailModal') && bd.getElementById('detailTitle').textContent === 'Sprachen' && bd.getElementById('detailDate').value === TODAY);
  bw.closeModal('detailModal');

  // Langes Drücken
  bw.eval('LONGPRESS_MS = 25');
  const ptr = (type, el, x = 0, y = 0) => { const e = new bw.Event(type, { bubbles: true, cancelable: true }); e.clientX = x; e.clientY = y; el.dispatchEvent(e); return e; };
  const target = () => BH.cell(q3);
  ptr('pointerdown', target(), 10, 10);
  await wait(70);
  t.check('Langes Drücken öffnet den Dialog zu diesem Feld.', BH.modalOpen('detailModal') && bd.getElementById('detailTitle').textContent === cellsB[q3]);
  ptr('pointerup', target(), 10, 10);
  BH.click(target());
  t.check('Der Klick nach dem langen Drücken markiert das Feld nicht.', !BH.cell(q3).classList.contains('marked') && !bc().marks.includes(q3));
  bw.closeModal('detailModal');
  ptr('pointerdown', target(), 10, 10); ptr('pointerup', target(), 10, 10);
  await wait(70);
  BH.click(target());
  t.check('Kurzes Tippen öffnet keinen Dialog und markiert wie gewohnt.', !BH.modalOpen('detailModal') && bc().marks.includes(q3));
  BH.click(target());
  ptr('pointerdown', target(), 10, 10); ptr('pointermove', target(), 40, 10);
  await wait(70);
  t.check('Wird der Finger beim Drücken bewegt (Wischen/Scrollen), öffnet sich nichts.', !BH.modalOpen('detailModal'));
  ptr('pointerdown', target(), 10, 10); ptr('pointermove', target(), 13, 12);
  await wait(70);
  t.check('Kleine Zitterbewegungen (unter 10 px) brechen das lange Drücken nicht ab.', BH.modalOpen('detailModal'));
  ptr('pointerup', target(), 13, 12); bw.closeModal('detailModal');
  BH.click(target());
  t.check('Der Klick direkt nach dem langen Drücken wird verschluckt: das Feld bleibt unmarkiert.', !bc().marks.includes(q3));
  BH.click(target());
  t.check('Danach markiert ein normaler Tipp wieder (der Klick wird nur einmal verschluckt).', bc().marks.includes(q3));
  bw.openGameById && 0;
  const fc = createHelpers(bw, bd);
  bw.switchTab('spiele'); fc.openGameById('f');
  ptr('pointerdown', fc.cell(4), 5, 5);
  await wait(70);
  t.check('Langes Drücken auf das Freifeld öffnet nichts.', !BH.modalOpen('detailModal'));
  ptr('pointerdown', fc.cell(0), 5, 5);
  const cm = ptr('contextmenu', fc.cell(0));
  t.check('Das Kontextmenü des Browsers wird auf dem Spielfeld unterdrückt.', cm.defaultPrevented);
  ptr('pointerup', fc.cell(0));

  // Zurücksetzen mit Rückfrage, wenn nur Details vorhanden sind
  bw.switchTab('spiele'); BH.openGameById('f');
  const fcard = () => bw.eval('appState.cards.f');
  bw.setDetail('f', 0, { i: 'Nur Info' });
  bd.getElementById('btnResetMarks').click();
  t.check('Schon eine Info allein löst die Rückfrage vor "Markierungen löschen" aus.', BH.modalOpen('confirmModal'));
  bd.getElementById('confirmYes').click();
  t.check('Nach der Bestätigung sind Datum und Info weg.', JSON.stringify(fcard().details) === '{}' && !BH.cell(0).classList.contains('info'));

  // Einstellungen, Neustart, Escaping
  t.check('Settings: Checkbox "Datum automatisch eintragen" ist vorhanden und an.', bd.getElementById('settingAutoDatum').checked === true);
  bw.toggleSetting('autoDatum', false);
  const R = await reloadWithState(bw, { dataScript: GAME });
  t.check('Nach Neustart bleibt die Einstellung "Datum automatisch" aus (Checkbox und Wert).', R.window.eval('appState.settings.autoDatum') === false && R.document.getElementById('settingAutoDatum').checked === false);
  bw.toggleSetting('autoDatum', true);
  bw.switchTab('spiele'); BH.openGameById('k');
  const R2 = await reloadWithState(bw, { dataScript: GAME });
  const RH = createHelpers(R2.window, R2.document);
  t.check('Nach Neustart sind Datum, Info und Hinweispunkt noch da, und der Dialog zeigt die Werte.', R2.window.eval('appState.cards.k.details')[q2].i === 'Vorab notiert' && RH.cell(q2).classList.contains('info') && (R2.window.openDetails(q2), R2.document.getElementById('detailInfo').value === 'Vorab notiert' && R2.document.getElementById('detailDate').value === TODAY));

  const E = await loadApp({ trackErrors: true, dataScript: GAME.replace("'a','b','c','d','e','f','g','h', {", "'<img src=x onerror=window.__pwned=1>','b','c','d','e','f','g','h', {") });
  const EH = createHelpers(E.window, E.document);
  EH.openGameById('k'); E.window.setLupeMode('immer');
  const ep = E.window.eval('appState.cards.k.cells').findIndex(c => typeof c === 'string' && c.includes('<img'));
  EH.click(EH.cell(ep)); E.window.openDetails(ep);
  E.document.getElementById('detailInfo').value = '"><img src=x onerror=window.__pwned=1> & <b>fett</b>';
  E.document.getElementById('detailInfo').dispatchEvent(new E.window.Event('input', { bubbles: true }));
  t.check('Sonderzeichen in Feldtext und Info (Titel, Lupe) bleiben Text und werden nicht ausgeführt.',
    !E.window.__pwned && !E.document.querySelector('#lupe img, #lupe b, #detailTitle img, #board img') && E.document.querySelector('#lupe .lupe-info').textContent.includes('<img') && E.document.getElementById('detailTitle').textContent.includes('<img') && E.errors.length === 0, E.errors);

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', A.errors.length === 0 && B.errors.length === 0 && R.errors.length === 0 && R2.errors.length === 0 && E.errors.length === 0, [...A.errors, ...B.errors, ...R.errors]);
  t.finish();
})();
