
const fs = require('fs');
const lines = fs.readFileSync('game.js','utf8').split('\n');
const cut = lines.findIndex(l => l.includes('const canvas = document'));
let src = lines.slice(0, cut).join('\n') + '\nmodule.exports = { buildPuzzleOnce, generateLevel, computeEnergy, rotateMask, LEVELS, TYPES };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
console.log('calling buildPuzzleOnce(0, 7919)...');
const p = M.buildPuzzleOnce(0, 7919);
console.log('result:', p ? 'OK grid=' + p.grid.length : 'null');
