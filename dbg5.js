
const fs = require('fs');
let lines = fs.readFileSync('game.js','utf8').split('\n');
const cut = lines.findIndex(l => l.includes('const canvas = document'));
let src = lines.slice(0, cut).join('\n');
src = src.replace('const cells = [...inTree];', 'console.log("T3 inTree=", inTree.size, "edgesLeft=", edges.length); const cells = [...inTree];');
src += '\nmodule.exports = { buildPuzzleOnce };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
M.buildPuzzleOnce(0, 7919);
