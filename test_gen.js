
const fs = require('fs');
const lines = fs.readFileSync('game.js','utf8').split('\n');
const cut = lines.findIndex(l => l.includes('const canvas = document'));
let src = lines.slice(0, cut).join('\n') + '\nmodule.exports = { generateLevel, computeEnergy, rotateMask, LEVELS, TYPES };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
for (let li = 0; li < M.LEVELS.length; li++) {
  for (let s = 1; s <= 5; s++) {
    process.stdout.write(`gen L${li} seed${s}...`);
    M.generateLevel(li, s * 7919 + li * 31);
    console.log(' ok');
  }
}
