const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createChecker, ROOT } = require('./test-helpers');

// Service-Worker-Anbindung: syntaktisch gültig, Datendatei und App-Code werden Network-First behandelt,
// Cache-Name ist gesetzt. (Das Zeitlimit-Verhalten selbst prüft test_sw_network_timeout.js.)
(async () => {
  const t = createChecker();
  const code = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf-8');
  let parses = true;
  try { new vm.Script(code); } catch (e) { parses = false; }
  t.check('sw.js ist syntaktisch gültig.', parses);
  t.check('bingo-data.js wird Network-First behandelt (isDataFile).', /isDataFile\s*=[^;]*bingo-data\.js/.test(code));
  t.check('App-Code wird wie index.html Network-First behandelt (isAppFile für css/ und js/).', /isAppFile\s*=/.test(code) && /if \(isHTML \|\| isDataFile \|\| isAppFile\)/.test(code));
  const cache = (code.match(/const CACHE = '([^']+)'/) || [])[1];
  t.check(`Cache-Name ist gesetzt und gehört zu diesem Projekt: "${cache}".`, /^zugabe-v\d+$/.test(cache || ''));
  t.check('Keine Reste aus dem Projekt rbf2027 im Service Worker.', !/rbf/i.test(code));
  t.finish();
})();
