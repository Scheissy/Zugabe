const fs = require('fs');
const path = require('path');
const { ROOT, loadApp, createChecker, createHelpers } = require('./test-helpers');

// Langes Drücken auf ein Feld (Dialog "Datum & Info"): der Browser startet dabei zusätzlich eine eigene Textauswahl, die nach dem
// Öffnen des Dialogs auf dem Text unter dem Finger landet. Geprüft: keine Textauswahl im Dialog (CSS) und Wegräumen einer angefangenen Auswahl.
(async () => {
  const t = createChecker();
  const css = fs.readFileSync(path.join(ROOT, 'css/app.css'), 'utf-8');
  const rule = sel => ((css.match(new RegExp('\\n' + sel.replace(/\./g, '\\.') + ' \\{([^}]*)\\}')) || [])[1]) || '';
  t.check('CSS: Der Dialog (.modal und der Hintergrund) erlaubt keine Textauswahl und kein Callout (Android und iOS).', ['.modal', '.modal-backdrop'].every(s => /(^|[\s;])user-select:\s*none/.test(rule(s)) && /-webkit-user-select:\s*none/.test(rule(s)) && /-webkit-touch-callout:\s*none/.test(rule(s))), [rule('.modal'), rule('.modal-backdrop')]);
  t.check('CSS: Eingabefelder im Dialog bleiben auswählbar (Info-Text, Datum).', /(^|[\s;])user-select:\s*text/.test(rule('.modal input, .modal textarea')) && /-webkit-user-select:\s*text/.test(rule('.modal input, .modal textarea')));
  t.check('CSS: Auch die Felder auf der Karte haben keine Textauswahl und kein Callout.', /-webkit-user-select:\s*none/.test(rule('.cell')) && /(^|[\s;])user-select:\s*none/.test(rule('.cell')) && /-webkit-touch-callout:\s*none/.test(rule('.cell')));

  const { window: w, document: d, errors } = await loadApp({ trackErrors: true });
  const H = createHelpers(w, d);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  w.switchTab('spiele'); H.openGameById('klubnacht');
  const sel = () => w.getSelection();
  const select = el => { const r = d.createRange(); r.selectNodeContents(el); sel().removeAllRanges(); sel().addRange(r); };
  const target = () => H.cells().find(c => !c.classList.contains('free'));
  const p = +target().dataset.p;

  // 1) Öffnen räumt eine bestehende Auswahl weg
  select(d.getElementById('topbarSub'));
  t.check('Vorbereitung: eine Auswahl ist da.', sel().rangeCount === 1);
  w.openDetails(p);
  t.check('Beim Öffnen des Dialogs wird eine bestehende Auswahl sofort entfernt.', sel().rangeCount === 0);
  w.closeModal('detailModal');

  // 2) Auswahl, die der Browser etwas später startet (nach dem Öffnen)
  w.openDetails(p);
  await wait(60); select(d.getElementById('detailTitle'));
  await wait(200);
  t.check('Eine kurz nach dem Öffnen gestartete Auswahl (z. B. auf dem Titel) wird nach etwa 150 ms entfernt.', sel().rangeCount === 0);
  await wait(300); select(d.querySelector('#detailModal .detail-label'));
  await wait(500);
  t.check('Auch eine noch spätere Auswahl (nach ca. 0,5 s, z. B. auf "Ort") wird entfernt.', sel().rangeCount === 0);
  w.closeModal('detailModal');

  // 3) Langes Drücken wie auf dem Handy: Auswahl entsteht während des Haltens, Finger wird über dem Dialog losgelassen
  w.eval('LONGPRESS_MS = 25');
  const ptr = (type, el, x = 5, y = 5) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.clientX = x; e.clientY = y; el.dispatchEvent(e); };
  ptr('pointerdown', target());
  await wait(70);
  t.check('Langes Drücken öffnet den Dialog.', H.modalOpen('detailModal'));
  select(d.getElementById('detailTitle'));                    // der Browser startet jetzt "seine" Auswahl
  ptr('pointerup', d.getElementById('countVal'));              // Finger wird über dem Dialog losgelassen
  t.check('Wird der Finger über dem Dialog losgelassen, ist die Auswahl sofort weg.', sel().rangeCount === 0);
  select(d.querySelector('#detailModal .detail-hint'));
  await wait(150);
  t.check('Auch eine gerade nach dem Loslassen entstandene Auswahl verschwindet (kurze Nachkontrolle).', sel().rangeCount === 0);
  ptr('pointercancel', d.body);
  w.closeModal('detailModal');

  // 4) Ohne langes Drücken wird nichts weggeräumt (normales Antippen / Auswählen bleibt möglich)
  select(d.getElementById('topbarSub'));
  ptr('pointerdown', target()); ptr('pointerup', target());
  await wait(70);
  t.check('Ein kurzes Antippen räumt keine Auswahl weg (kein langes Drücken).', sel().rangeCount === 1);

  // 5) Schutz: Während der Cursor im Info-Feld steht, wird nichts weggeräumt
  w.openDetails(p);
  const ta = d.getElementById('detailInfo');
  ta.focus();
  select(d.getElementById('detailTitle'));
  w.clearSelection();
  t.check('Steht der Cursor im Info-Feld (Fokus), wird die Auswahl nicht angetastet.', d.activeElement === ta && sel().rangeCount === 1);
  ta.blur(); w.closeModal('detailModal');

  // 6) Robust ohne Auswahl-Funktion
  const orig = w.getSelection;
  w.getSelection = undefined;
  let threw = false; try { w.clearSelection(); w.clearSelectionSoon(); } catch (e) { threw = true; }
  w.getSelection = orig;
  t.check('Ohne window.getSelection (alte Browser) gibt es keinen Fehler.', !threw);

  t.check('Während des gesamten Ablaufs gab es keine JS-Fehler.', errors.length === 0, errors);
  t.finish();
})();
