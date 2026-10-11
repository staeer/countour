
const fs = require('fs');
let lines = fs.readFileSync('game.js','utf8').split('\n');
const cut = lines.findIndex(l => l.includes('const canvas = document'));
let src = lines.slice(0, cut).join('\n');
src = src.replace('if (!validateSolution(N, tree', 'console.log("T7 validate; picked=", picked, "blocked=", [...blocked]); if (!validateSolution(N, tree');
src = src.replace('if (picked.length < need) return null;', 'console.log("EARLY NULL"); if (picked.length < need) return null;');
src += '\nmodule.exports = { buildPuzzleOnce };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
M.buildPuzzleOnce(0, 7919);
console.log('DONE');
