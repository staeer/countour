const fs = require('fs');
const lines = fs.readFileSync('game.js','utf8').split('\n');
// вырезаем DOM-часть: от "const canvas = document" (строка 293, индекс 292) до конца файла
const cut = lines.findIndex(l => l.includes('const canvas = document'));
let src = lines.slice(0, cut).join('\n') + '\nmodule.exports = { generateLevel, computeEnergy, rotateMask, LEVELS, TYPES };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
const { generateLevel, computeEnergy, rotateMask, LEVELS, TYPES } = M;

let fails = 0;
for (let li = 0; li < LEVELS.length; li++) {
  for (let s = 1; s <= 60; s++) {
    const seed = s * 7919 + li * 31;
    const p = generateLevel(li, seed);
    const { grid, N } = p;
    // 1) в состоянии решения (rot=0) обязана быть победа
    for (const c of grid) { c.rot = 0; c.mask = c.solMask; }
    if (!computeEnergy(grid, N).won) { console.log(`FAIL win@solution L${li} seed${s}`); fails++; continue; }
    // 2) стартовое перемешанное состояние не победное
    const p2 = generateLevel(li, seed);
    if (computeEnergy(p2.grid, p2.N).won) { console.log(`FAIL already-won at start L${li} seed${s}`); fails++; }
    // 3) решение достижимо только CW-нажатиями из стартового состояния
    for (const c of p2.grid) {
      if ([TYPES.WIRE, TYPES.SOURCE, TYPES.RECEIVER].includes(c.type)) {
        c.rot = (c.rot + (4 - c.rot) % 4) % 4;
        c.mask = rotateMask(c.solMask, c.rot);
      }
    }
    if (!computeEnergy(p2.grid, p2.N).won) { console.log(`FAIL cw-solve L${li} seed${s}`); fails++; }
    // 4) все приёмники посчитаны корректно
    const e = computeEnergy(p.grid, N);
    if (e.rxOn !== e.rxTotal || e.rxTotal < LEVELS[li].receivers) { console.log(`FAIL rx count L${li} seed${s}: ${e.rxOn}/${e.rxTotal}`); fails++; }
  }
}
// 5) ложная победа невозможна
{
  const p = generateLevel(5, 12345);
  for (const c of p.grid) { c.rot = 0; c.mask = c.solMask; }
  const wire = p.grid.find(c => c.type === TYPES.WIRE);
  wire.rot = 1; wire.mask = rotateMask(wire.solMask, 1);
  if (computeEnergy(p.grid, p.N).won) { console.log('FAIL false victory'); fails++; }
}
console.log(fails === 0 ? 'ALL TESTS PASSED (' + LEVELS.length * 60 + ' puzzles)' : fails + ' FAILURES');
process.exit(fails ? 1 : 0);
