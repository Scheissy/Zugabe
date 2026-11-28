const { loadApp, createChecker, createHelpers } = require('./test-helpers');

// Dialog „Datum & Info“ (langes Drücken auf ein Feld) bei Spezial-Feldern:
//   Kombi-Feld: Überblick mit Stand und allen Punkten (abgehakt/offen, auch eigene Einträge), „Checkliste bearbeiten“ führt zur Checkliste.
//   Zählfeld:   Zählerstand mit − / ＋ und Zahleneingabe, direkt im Dialog änderbar.
//   Textfeld:   kein zusätzlicher Bereich.
const GAME = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'s', titel:'S', groesse:3, freiMitte:false, ziel:'linie', fest:true,
  felder:['a','b','c','d','e', { text: 'Tage', zaehlfeld: true, ab: 5, einheit: 'Tage' }, { text: 'Sprachen', ab: 2, punkte: ['Eins','Zwei','<b>Drei</b>'], eigene: true, eigeneHinweis: 'Weitere' }, { text: 'Farben', ab: 1, punkte: ['Rot','Blau'] }, 'f'] }];`;
const TODAY = '2026-11-28';
const TAGE = 5, SPRACHEN = 6, FARBEN = 7;

(async () => {
  const t = createChecker();
  const A = await loadApp({ trackErrors: true, dataScript: GAME });
  const w = A.window, d = A.document, H = createHelpers(w, d);
  w.todayStr = () => TODAY;
  w.localStorage.clear(); w.switchTab('spiele'); H.openGameById('s');
  const card = () => w.eval('appState.cards.s');
  const $ = id => d.getElementById(id);
  const shown = id => $(id).style.display !== 'none';
  const lis = () => [...d.querySelectorAll('#detailPoints li')];
  const type = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };

  // ───────── Textfeld ─────────
  w.openDetails(0);
  t.check('Textfeld: kein Überblick-Bereich (nur Anzahl, Datum, Info wie bisher).', H.modalOpen('detailModal') && !shown('detailSpecial') && shown('detailCountRow'));
  w.closeModal('detailModal');

  // ───────── Kombi-Feld ohne eigene Einträge ─────────
  w.openDetails(FARBEN);
  t.check('Kombi-Feld: Bereich „Checkliste“ mit Stand und allen Punkten, noch nichts abgehakt.',
    shown('detailSpecial') && $('detailSpecialLabel').textContent === 'Checkliste' && $('detailSpecialProgress').textContent === '0 von 2 abgehakt – ab 1 zählt das Feld.'
    && !$('detailSpecialProgress').classList.contains('done') && lis().map(l => l.textContent).join('|') === '☐Rot|☐Blau' && lis().every(l => l.classList.contains('off')));
  t.check('Kombi-Feld: Zählerzeile ausgeblendet, „Checkliste bearbeiten“ sichtbar; die Zeile „Anzahl“ gibt es nicht.', !shown('detailZahlRow') && shown('detailSpecialEdit') && shown('detailPoints') && !shown('detailCountRow'));
  t.check('Barrierefreiheit: Häkchen-Symbole tragen die Bezeichnung „offen“/„abgehakt“.', [...d.querySelectorAll('#detailPoints .pt-mark')].every(m => m.getAttribute('role') === 'img' && m.getAttribute('aria-label') === 'offen'));
  w.closeModal('detailModal');
  w.toggleCheck('s', FARBEN, 1, true);
  w.openDetails(FARBEN);
  t.check('Nach dem Abhaken zeigt der Überblick den Haken, „Geschafft“ und die Hervorhebung.',
    lis().map(l => l.textContent).join('|') === '☐Rot|☑Blau' && lis()[1].classList.contains('on') && $('detailSpecialProgress').textContent === 'Geschafft: 1 von 2 abgehakt (nötig: 1).'
    && $('detailSpecialProgress').classList.contains('done') && lis()[1].querySelector('.pt-mark').getAttribute('aria-label') === 'abgehakt');
  w.closeModal('detailModal');

  // ───────── Kombi-Feld mit eigenen Einträgen, Escaping ─────────
  w.openDetails(SPRACHEN);
  t.check('Kombi-Feld mit eigenen Einträgen: Statustext „gezählt“, drei feste Punkte, Sonderzeichen werden als Text gezeigt.',
    $('detailSpecialProgress').textContent === '0 gezählt – ab 2 zählt das Feld.' && lis().length === 3 && lis()[2].textContent === '☐<b>Drei</b>' && !d.querySelector('#detailPoints b'));
  w.closeModal('detailModal');
  w.toggleCheck('s', SPRACHEN, 0, true);
  w.setEigene('s', SPRACHEN, ['Klingonisch', 'eins', '  ', '<i>x</i>', 'KLINGONISCH']);
  w.openDetails(SPRACHEN);
  t.check('Eigene Einträge: nur zählende erscheinen (Duplikate zu festen Punkten und untereinander, leere fehlen), kursiv markiert und abgehakt; Sonderzeichen als Text.',
    lis().map(l => l.textContent).join('|') === '☑Eins|☐Zwei|☐<b>Drei</b>|☑Klingonisch|☑<i>x</i>' && lis().slice(3).every(l => l.classList.contains('own') && l.classList.contains('on')) && !d.querySelector('#detailPoints i'));
  t.check('Der Stand zählt feste Punkte und eigene Einträge zusammen: 1 + 2 = 3 gezählt, geschafft.', $('detailSpecialProgress').textContent === 'Geschafft: 3 gezählt (nötig: 2).' && $('detailSpecialProgress').classList.contains('done'));

  // Weiter zur Checkliste
  H.click($('detailSpecialEdit'));
  t.check('„Checkliste bearbeiten“ schließt „Datum & Info“ und öffnet die Checkliste dieses Felds.', !H.modalOpen('detailModal') && H.modalOpen('comboModal') && $('comboTitle').textContent === 'Sprachen');
  const box = d.querySelector('#comboList input[data-i="1"]');
  box.checked = true; box.dispatchEvent(new w.Event('change', { bubbles: true }));
  w.closeModal('comboModal');
  w.openDetails(SPRACHEN);
  t.check('Zurück im Überblick steht der neue Haken („Zwei“ abgehakt, 4 gezählt).', lis()[1].textContent === '☑Zwei' && $('detailSpecialProgress').textContent === 'Geschafft: 4 gezählt (nötig: 2).');
  w.closeModal('detailModal');

  // ───────── Zählfeld ─────────
  w.openDetails(TAGE);
  t.check('Zählfeld: Bereich „Zählerstand“ mit Stand 0, Einheit und Hinweis; Liste und „Checkliste bearbeiten“ ausgeblendet, „Anzahl“ ebenso.',
    shown('detailSpecial') && $('detailSpecialLabel').textContent === 'Zählerstand' && $('detailSpecialProgress').textContent === '0 Tage – ab 5 zählt das Feld.' && shown('detailZahlRow')
    && !shown('detailPoints') && !shown('detailSpecialEdit') && !shown('detailCountRow') && $('detailZahlInput').value === '0' && $('detailZahlUnit').textContent === 'Tage'
    && $('detailZahlMinus').disabled && !$('detailZahlPlus').disabled && !$('detailDate').value);
  for (let i = 0; i < 4; i++) H.click($('detailZahlPlus'));
  t.check('4× ＋: Stand 4, noch nicht geschafft, Karte „4/5“, kein Datum.', $('detailZahlInput').value === '4' && card().stand[TAGE] === 4 && H.cell(TAGE).querySelector('.cell-progress').textContent === '4/5' && !$('detailDate').value && !$('detailSpecialProgress').classList.contains('done'));
  w.toggleMark('s', 3); w.toggleMark('s', 4);
  H.click($('detailZahlPlus'));
  t.check('5× ＋: geschafft – Status „Geschafft“, Karte „✓ 5“ und markiert, Datum im Dialog sofort sichtbar, Bingo-Hinweis (Reihe 4-5-6 voll).',
    $('detailSpecialProgress').textContent === 'Geschafft: 5 Tage (nötig: 5).' && $('detailSpecialProgress').classList.contains('done') && H.cell(TAGE).classList.contains('marked')
    && $('detailDate').value === TODAY && card().details[TAGE].d === TODAY && $('toast').textContent === 'Bingo!');
  type('detailZahlInput', '15');
  t.check('Zahl eintippen (15): gespeichert, Eingabefeld bleibt stehen, Karte „✓ 15“.', card().stand[TAGE] === 15 && $('detailZahlInput').value === '15' && H.cell(TAGE).querySelector('.cell-progress').textContent === '✓ 15');
  type('detailZahlInput', '');
  type('detailZahlInput', 'abc');
  type('detailZahlInput', '-2');
  t.check('Leere und ungültige Eingaben ändern nichts.', card().stand[TAGE] === 15);
  $('detailZahlInput').dispatchEvent(new w.Event('change', { bubbles: true }));
  t.check('Beim Verlassen zeigt das Feld wieder den gespeicherten Stand.', $('detailZahlInput').value === '15');
  type('detailZahlInput', '5000');
  t.check('Zu große Zahl wird auf 999 begrenzt, ＋ ist dann aus.', card().stand[TAGE] === 999 && $('detailZahlInput').value === '999' && $('detailZahlPlus').disabled);
  type('detailZahlInput', '0');
  t.check('0 eintippen setzt zurück: Eintrag weg, − aus, Feld nicht mehr geschafft; das Datum bleibt erhalten.', !(TAGE in card().stand) && $('detailZahlMinus').disabled && !H.cell(TAGE).classList.contains('marked') && card().details[TAGE].d === TODAY);
  H.click($('detailZahlMinus'));
  t.check('− bei 0 tut nichts.', !(TAGE in card().stand) && $('detailZahlInput').value === '0');
  type('detailZahlInput', '7');
  H.click($('detailZahlMinus'));
  t.check('− zählt herunter (7 → 6).', card().stand[TAGE] === 6 && $('detailZahlInput').value === '6');

  // Datum und Info funktionieren wie bei allen Feldern
  $('detailInfo').value = 'Festival-Woche'; $('detailInfo').dispatchEvent(new w.Event('input', { bubbles: true }));
  t.check('Info zum Zählfeld lässt sich weiter eintragen und wird gespeichert.', card().details[TAGE].i === 'Festival-Woche' && card().details[TAGE].d === TODAY);
  w.closeModal('detailModal');

  // Ein anderes Feld öffnen: Bereich passt sich an, nichts bleibt vom Zählfeld stehen
  w.openDetails(FARBEN);
  t.check('Danach ein Kombi-Feld öffnen: Zählerzeile weg, Liste da; danach ein Textfeld: Bereich weg.', !shown('detailZahlRow') && shown('detailPoints') && (w.closeModal('detailModal'), w.openDetails(1), !shown('detailSpecial')));
  w.closeModal('detailModal');

  // Zugriff über Lupe und langes Drücken
  w.eval("appState.settings.lupe = 'immer'"); w.renderBoard();
  H.click(H.cell(FARBEN)); w.closeModal('comboModal');
  H.click(d.querySelector('#lupe .lupe-edit'));
  t.check('„Datum & Info ergänzen“ in der Lupe öffnet den Dialog mit Überblick.', H.modalOpen('detailModal') && shown('detailSpecial') && $('detailTitle').textContent === 'Farben');
  w.closeModal('detailModal');
  w.eval('LONGPRESS_MS = 25');
  const ptr = (type2, el, x = 0, y = 0) => { const e = new w.Event(type2, { bubbles: true, cancelable: true }); e.clientX = x; e.clientY = y; el.dispatchEvent(e); return e; };
  ptr('pointerdown', H.cell(TAGE), 10, 10);
  await H.sleep(70);
  t.check('Langes Drücken auf das Zählfeld öffnet den Dialog mit Zählerstand (6 Tage).', H.modalOpen('detailModal') && $('detailZahlInput').value === '6' && $('detailSpecialProgress').textContent === 'Geschafft: 6 Tage (nötig: 5).');
  ptr('pointerup', H.cell(TAGE), 10, 10);
  w.closeModal('detailModal');

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', A.errors.length === 0, A.errors);
  t.finish();
})();
