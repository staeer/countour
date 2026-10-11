
const fs = require('fs');
let lines = fs.readFileSync('game.js','utf8').split('\n');
const cut = lines.findIndex(l => l.includes('const canvas = document'));
// инструментирование: добавляем trace-логи внутри buildPuzzleOnce
let src = lines.slice(0, cut).join('\n');
src = src.replace('while (blocked.size < L.blocks', 'console.log("T1 blocks start"); while (blocked.size < L.blocks');
src = src.replace('if (isSetConnected(N, testBlocked)) blocked.add(cand);', 'if (isSetConnected(N, testBlocked)) blocked.add(cand); else console.log("T1b reject", cand);');
src = src.replace('const isFree = k', 'console.log("T2 blocked=", [...blocked]); const isFree = k');
src = src.replace('const cells = [...inTree];', 'console.log("T3 tree done, edges loop"); const cells = [...inTree];');
src = src.replace('const endpoints = cells.filter', 'console.log("T4 spread"); const endpoints = cells.filter');
src = src.replace('const srcSet = new Set(picked', 'console.log("T5 picked", picked); const srcSet = new Set(picked');
src = src.replace('for (const rk of rxSet) {', 'console.log("T6 extra edges"); for (const rk of rxSet) {');
src = src.replace('if (!validateSolution(N, tree', 'console.log("T7 validate"); if (!validateSolution(N, tree');
src += '\nmodule.exports = { buildPuzzleOnce };';
global.localStorage = { getItem: () => '[]', setItem: () => {} };
const M = eval(src);
M.buildPuzzleOnce(0, 7919);
console.log('DONE');
