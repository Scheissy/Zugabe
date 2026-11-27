const fs = require('fs');
const path = require('path');
const { ROOT, loadApp, createChecker, createHelpers } = require('./test-helpers');

// Eigene Einträge eines Kombi-Felds sehen aus wie die festen Punkte der Checkliste: eine Zeile pro Eintrag mit Häkchen links
// (zeigt, ob der Eintrag zählt) und dem Text als Eingabefeld ohne Rahmen, ohne eigene Überschrift, mit durchgehender Linie.
const GAME = `const BINGO_DATA_VERSION=1; const BINGO_GAMES=[{ id:'k', titel:'K', groesse:3, freiMitte:false, ziel:'linie',
  felder:['a','b','c','d','e','f','g', { text: 'Wetter', ab: 2, punkte: ['Sonne','Regen'] }, { text: 'Sprachen', ab: 3, punkte: ['Deutsch','Englisch'], eigene: true, eigeneHinweis: 'Weitere Sprache' }] }];`;

(async () => {
  const t = createChecker();
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf-8');
  const rule = sel => ((css.match(new RegExp('\\n' + sel.replace(/[.\[\]=:()]/g, '\\$&') + ' \\{([^}]*)\\}')) || [])[1]) || '';

  // ───────── 1) Aussehen (CSS) ─────────
  const inp = rule('.combo-own-input');
  t.check('CSS: Das Eingabefeld hat keinen Kasten (kein Rahmen, kein Hintergrund), nimmt die Schrift der Liste (15 px) und füllt die Zeile.', /border:\s*none/.test(inp) && /background:\s*none/.test(inp) && /font-size:\s*15px/.test(inp) && /font:\s*inherit/.test(inp) && /flex:\s*1/.test(inp) && !/box-shadow|outline:\s*\d/.test(inp), inp);
  t.check('CSS: Die Zeile ist eine normale Listenzeile (gleiche Schrift, Abstand und Linie wie die festen Punkte; ".combo-row" gilt auch für sie).', /font-size:\s*15px/.test(rule('.combo-row')) && /padding:\s*12px 4px/.test(rule('.combo-row')) && /border-bottom:\s*1px solid/.test(rule('.combo-row')));
  t.check('CSS: Das Häkchen in der eigenen Zeile hat dieselbe Größe wie bei den festen Punkten (gleiche Regel) und ist nicht antippbar.', /width:\s*22px/.test(rule('.combo-row input[type=checkbox]')) && /pointer-events:\s*none/.test(rule('.combo-own-check')) && !/width|height/.test(rule('.combo-own-check')));
  t.check('CSS: Zwischen letztem festen Punkt und erster eigener Zeile steht die Trennlinie (Klasse has-own).', /border-bottom:\s*1px solid/.test(rule('.combo-list.has-own .combo-row:last-child')));
  t.check('CSS: Fokus zeigt sich als Linie unter der Zeile; ein doppelter Eintrag wird abgeblendet und durchgestrichen; Platzhalter gedämpft.', /box-shadow:\s*inset 0 -2px 0 var\(--accent\)/.test(rule('.combo-own-row:focus-within')) && /line-through/.test(rule('.combo-own-input.dup')) && /color:\s*var\(--text3\)/.test(rule('.combo-own-input::placeholder')));
  t.check('CSS: Die frühere Überschrift-Gestaltung und der Kasten (combo-own-title, Hintergrund surface2 am Eingabefeld) sind weg.', !/combo-own-title/.test(css) && !/combo-own-input \{[^}]*surface2/.test(css));
  t.check('index.html: Die Überschrift "Weitere Einträge" ist entfernt, der Hinweis bleibt.', (h => !/combo-own-title/.test(h) && !/>Weitere Einträge</.test(h) && /Jeder Eintrag zählt als Häkchen/.test(h))(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8')));

  // ───────── 2) Aufbau und Verhalten ─────────
  const A = await loadApp({ trackErrors: true, dataScript: GAME });
  const w = A.window, d = A.document, H = createHelpers(w, d);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  H.openGameById('k');
  const pos = name => w.eval('appState.cards.k.cells').findIndex(c => c && typeof c === 'object' && c.t === name);
  const rows = () => [...d.querySelectorAll('#comboOwnList > .combo-row')];
  const own = () => [...d.querySelectorAll('#comboOwnList .combo-own-input')];
  const type = (i, v) => { own()[i].value = v; own()[i].dispatchEvent(new w.Event('input', { bubbles: true })); };
  w.openCombo(pos('Sprachen'));
  t.check('Die eigenen Einträge sind Zeilen der Klasse combo-row; jede Zeile hat zuerst ein Häkchen, dann das Eingabefeld.', rows().length === 1 && rows().every(r => r.classList.contains('combo-row') && r.classList.contains('combo-own-row') && r.children.length === 2 && r.children[0].type === 'checkbox' && r.children[0].classList.contains('combo-own-check') && r.children[1].classList.contains('combo-own-input')));
  t.check('Das Häkchen der eigenen Zeile ist reine Anzeige (aus der Tab-Reihenfolge, für Screenreader versteckt); das Eingabefeld trägt den Platzhalter als Beschriftung.', rows()[0].children[0].tabIndex === -1 && rows()[0].children[0].getAttribute('aria-hidden') === 'true' && own()[0].getAttribute('aria-label') === 'Weitere Sprache');
  t.check('Die Liste trägt die Klasse has-own (für die durchgehende Linie); keine Überschrift mehr.', d.getElementById('comboList').classList.contains('has-own') && !d.querySelector('#comboOwn .combo-own-title'));
  t.check('Die leere Zeile hat kein Häkchen.', rows()[0].children[0].checked === false);
  type(0, 'Latein');
  t.check('Ein Eintrag wird getippt: sein Häkchen ist gesetzt (er zählt), und eine neue leere Zeile (ohne Häkchen) erscheint darunter.', rows().length === 2 && rows()[0].children[0].checked === true && rows()[1].children[0].checked === false && own()[1].value === '');
  type(1, 'deutsch');
  t.check('Ein Eintrag, der einem festen Punkt gleicht, zählt nicht: Häkchen aus, abgeblendet (dup) und mit Hinweis im Tooltip.', rows()[1].children[0].checked === false && own()[1].classList.contains('dup') && own()[1].title === 'Zählt nicht doppelt');
  type(1, 'Japanisch');
  t.check('Wird daraus ein echter neuer Eintrag, ist das Häkchen wieder gesetzt, die Abblendung und der Hinweis verschwinden.', rows()[1].children[0].checked === true && !own()[1].classList.contains('dup') && own()[1].title === '');
  type(1, '');
  t.check('Leeren des Felds setzt das Häkchen zurück.', rows()[1].children[0].checked === false);
  t.check('Zu jedem Eingabefeld gibt es genau ein Häkchen in derselben Zeile (keine losen Teile).', d.querySelectorAll('#comboOwnList .combo-own-check').length === own().length && rows().length === own().length && rows().every(r => r.querySelectorAll('input').length === 2));
  // Aufräumen mitten in der Liste entfernt die ganze Zeile
  type(1, 'Koreanisch'); type(0, '');
  own()[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  t.check('Wird ein Eintrag mitten in der Liste geleert und das Feld verlassen, verschwindet die ganze Zeile (Häkchen und Eingabefeld), nichts bleibt zurück.', rows().length === own().length && d.querySelectorAll('#comboOwnList .combo-own-check').length === own().length && own().map(i => i.value).join('|') === 'Koreanisch|', own().map(i => i.value));
  // Tipp auf die Zeile (nicht auf das Eingabefeld) setzt den Cursor ins Feld
  const row = rows()[0];
  row.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  t.check('Ein Tipp auf die Zeile (außerhalb des Eingabefelds) setzt den Cursor in dessen Feld.', d.activeElement === own()[0]);
  d.activeElement.blur();
  // Maximal 10 Zeilen, jede mit Häkchen
  w.closeModal('comboModal'); w.resetMarks('k'); w.openCombo(pos('Sprachen'));
  for (let i = 0; i < 12; i++) type(Math.min(i, own().length - 1), 'Sprache ' + i);
  t.check('Bei 10 Einträgen: 10 Zeilen mit je einem gesetzten Häkchen, keine elfte Zeile.', rows().length === 10 && rows().every(r => r.children[0].checked === true));
  w.closeModal('comboModal');
  // Wieder öffnen: gespeicherte Einträge als Zeilen mit Häkchen
  w.openCombo(pos('Sprachen'));
  t.check('Beim erneuten Öffnen stehen die gespeicherten Einträge als Zeilen mit gesetztem Häkchen da (und 10 sind das Maximum, keine leere Zeile mehr).', rows().length === 10 && own().every(i => i.value) && rows().every(r => r.children[0].checked));
  w.closeModal('comboModal');
  // Kombi-Feld ohne eigene Einträge
  w.openCombo(pos('Wetter'));
  t.check('Ein Kombi-Feld ohne eigene Einträge: kein Bereich, keine Zeilen, die Liste trägt die Klasse has-own nicht (letzte Zeile ohne Linie).', d.getElementById('comboOwn').style.display === 'none' && d.querySelectorAll('#comboOwnList > *').length === 0 && !d.getElementById('comboList').classList.contains('has-own'));
  w.closeModal('comboModal');
  w.openCombo(pos('Sprachen'));
  t.check('Öffnet man danach wieder das Feld mit eigenen Einträgen, ist die Klasse has-own wieder da.', d.getElementById('comboList').classList.contains('has-own'));
  w.closeModal('comboModal');
  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', A.errors.length === 0, A.errors);
  t.finish();
})();
