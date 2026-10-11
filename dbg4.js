
const fs = require('fs');
let lines = fs.readFileSync('game.js','utf8').split('\n');
const cut = lines.findIndex(l => l.includes('const canvas = document'));
let src = lines.slice(0, cut).join('\n');
src = src.replace('if (picked.length < need) return null;', 'console.log("NULL-A cells=",cells.length,"endpoints=",endpoints.length,"picked=",picked.length); if (picked.length < need) return null;');
src = src.replace('if (!validateSolution(N, tree', 'console.log("T7 picked=",picked,"blocked=",[...blocked]); if (!validateSolution(N, tree');
src += '\nmodule.exports = { buildPuzzleOnce };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
for (let s = 0; s < 6; s++) {
  const r = M.buildPuzzleOnce(0, 7919 + s * 104729);
  console.log('attempt', s, r ? 'OK' : 'null');
}
