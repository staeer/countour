/* ============================================================
   КОНТУР: СИГНАЛЬНЫЙ КОД — браузерная головоломка с цепями
   Генерация: строим гарантированно решаемую сеть (остовное
   дерево + связывание источников), затем перемешиваем повороты.
   ============================================================ */
"use strict";

/* ---------- утилиты ---------- */
const DIRS = [[0,-1],[1,0],[0,1],[-1,0]]; // N,E,S,W
const OPP = d => (d + 2) % 4;
const mulberry32 = a => () => {
  a |= 0; a = a + 0x6D2B79F5 | 0;
  let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

/* ---------- уровни ---------- */
const LEVELS = [
  { size: 5,  sources: 1, receivers: 1, blocks: 1,  name: "Обучение",   desc: "Один источник, один приёмник" },
  { size: 6,  sources: 1, receivers: 2, blocks: 2,  name: "Простая игра", desc: "Первые разветвления" },
  { size: 7,  sources: 2, receivers: 3, blocks: 3,  name: "Два ядра",   desc: "Два источника, три приёмника" },
  { size: 8,  sources: 2, receivers: 4, blocks: 4,  name: "Разветвление", desc: "Плотная сеть соединений" },
  { size: 9,  sources: 3, receivers: 5, blocks: 5,  name: "Магистраль", desc: "Сложная электрическая сеть" },
  { size: 10, sources: 3, receivers: 6, blocks: 6,  name: "Максимум",   desc: "Предельная нагрузка контура" },
];

const TYPES = { EMPTY: 0, BLOCK: 1, WIRE: 2, SOURCE: 3, RECEIVER: 4 };

/* ---------- генерация уровня ---------- */
function buildPuzzleOnce(levelIdx, seed) {
  const L = LEVELS[levelIdx];
  const N = L.size;
  const rnd = mulberry32(seed);
  const key = (x, y) => y * N + x;
  const kx = k => k % N, ky = k => Math.floor(k / N);

  const blocked = new Set();
  const tree = Array.from({ length: N * N }, () => new Set()); // соединённые стороны (решение)

  /* блокируем клетки так, чтобы свободные оставались связными */
  let guard = 0;
  while (blocked.size < L.blocks && guard++ < 400) {
    const cand = Math.floor(rnd() * N * N);
    if (blocked.has(cand)) continue;
    const testBlocked = new Set(blocked); testBlocked.add(cand);
    if (isSetConnected(N, testBlocked)) blocked.add(cand);
  }

  const isFree = k => !blocked.has(k);
  const neighbors = k => DIRS.map((d, i) => [kx(k) + d[0], ky(k) + d[1], i])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N)
      .map(([x, y, i]) => [key(x, y), i]);

  /* остовное дерево случайным ростом (randomized Prim) из центра */
  const startK = key(Math.floor(N / 2), Math.floor(N / 2));
  const inTree = new Set([startK]);
  let frontier = neighbors(startK).filter(([nk]) => isFree(nk));
  const edges = []; // {a, dir}
  frontier.forEach(f => edges.push({ a: f[0], b: startK, dir: f[1] }));

  while (edges.length) {
    const idx = Math.floor(rnd() * edges.length);
    const e = edges.splice(idx, 1)[0];
    if (inTree.has(e.b)) continue;
    inTree.add(e.b);
    tree[e.a].add(e.dir);
    tree[e.b].add(OPP(e.dir));
    for (const [nk, nd] of neighbors(e.b)) {
      if (isFree(nk) && !inTree.has(nk)) edges.push({ a: e.b, b: nk, dir: nd });
    }
  }

  const cells = [...inTree];

  /* выбрать источники и приёмники — листья/концевые узлы, подальше друг от друга */
  const degree = k => tree[k].size;
  const need = L.sources + L.receivers;
  // жадный farthest-point sampling: каждый следующий элемент максимально далёк от выбранных
  const spreadPick = (pool, count) => {
    if (!pool.length) return [];
    const chosen = [pool[Math.floor(rnd() * pool.length)]];
    while (chosen.length < Math.min(count, pool.length)) {
      let best = -1, bestD = -1;
      for (const k of pool) {
        if (chosen.includes(k)) continue;
        let dm = Infinity;
        for (const c of chosen) dm = Math.min(dm, Math.abs(kx(k) - kx(c)) + Math.abs(ky(k) - ky(c)));
        if (dm > bestD || (dm === bestD && rnd() < 0.5)) { bestD = dm; best = k; }
      }
      if (best < 0) break;
      chosen.push(best);
    }
    return chosen;
  };

  const endpoints = cells.filter(k => degree(k) <= 1);
  const picked = spreadPick(endpoints, need);
  if (picked.length < need) {
    // добрать из концевых клеток дерева (степень <= 2), затем из любых
    const extraPool = cells.filter(k => degree(k) <= 2 && !picked.includes(k));
    picked.push(...spreadPick(extraPool, need - picked.length));
  }
  while (picked.length < need) {
    const k = cells[Math.floor(rnd() * cells.length)];
    if (!picked.includes(k)) picked.push(k); else break;
  }
  if (picked.length < need) return null; // слишком мало клеток — перегенерация
  const srcSet = new Set(picked.slice(0, L.sources));
  const rxSet = new Set(picked.slice(L.sources));

  /* все источники уже в одном дереве; добавляем доп. рёбра (петли) для интересности сети */
  if (L.sources >= 2) {
    const extraEdges = Math.floor(N / 3);
    for (let e = 0; e < extraEdges; e++) {
      const candidates = [];
      for (const ka of cells) for (const [kb, nd] of neighbors(ka)) {
        if (isFree(kb) && !tree[ka].has(nd) && ka < kb) candidates.push([ka, kb, nd]);
      }
      if (!candidates.length) break;
      const [ka, kb, nd] = candidates[Math.floor(rnd() * candidates.length)];
      tree[ka].add(nd); tree[kb].add(OPP(nd));
    }
  }

  /* приёмники не должны иметь степень >1 после назначений? нет — можно,
     но сделаем их концевыми: отрежем лишние ветки у приёмников, оставив 1 связь */
  for (const rk of rxSet) {
    if (degree(rk) > 1) {
      const ds = [...tree[rk]];
      const keep = ds[Math.floor(rnd() * ds.length)];
      for (const d of ds) if (d !== keep) {
        tree[rk].delete(d);
        const nk = key(kx(rk) + DIRS[d][0], ky(rk) + DIRS[d][1]);
        tree[nk].delete(OPP(d));
      }
    }
  }
  /* источники оставляем как есть (могут ветвиться) */

  /* проверка: все приёмники соединены с источниками в решении */
  if (!validateSolution(N, tree, srcSet, rxSet, blocked)) return null; // будет перегенерировано с новым сидом

  /* собрать клетки: тип + маска решения + случайный поворот (перемешивание) */
  const grid = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = key(x, y);
      if (blocked.has(k)) {
        grid.push({ x, y, type: TYPES.BLOCK, mask: 0, solMask: 0, rot: 0 });
      } else if (tree[k] && tree[k].size > 0) {
        let m = 0; tree[k].forEach(d => m |= (1 << d));
        let type = TYPES.WIRE;
        if (srcSet.has(k)) type = TYPES.SOURCE;
        else if (rxSet.has(k)) type = TYPES.RECEIVER;
        // случайный начальный поворот (гарантирует решаемость: игрок может провернуть к solMask)
        const rot = Math.floor(rnd() * 4);
        grid.push({ x, y, type, solMask: m, rot, mask: rotateMask(m, rot) });
      } else {
        grid.push({ x, y, type: TYPES.EMPTY, mask: 0, solMask: 0, rot: 0 });
      }
    }
  }

  // перемешивание не должно случайно дать уже собранную сеть — если собрано, крутнём одну не-блокированную клетку
  if (computeEnergy(grid, N).won) {
    for (const c of grid) if (c.type === TYPES.WIRE || c.type === TYPES.RECEIVER) {
      c.rot = (c.rot + 1) % 4; c.mask = rotateMask(c.solMask, c.rot); break;
    }
  }

  return { grid, N, levelIdx, sources: [...srcSet].length, receivers: [...rxSet].length };
}

/* Обёртка: гарантированно возвращает валидный уровень (циклический перезапуск, без рекурсии) */
function generateLevel(levelIdx, seed) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const p = buildPuzzleOnce(levelIdx, (seed + attempt * 104729) % 2147483647);
    if (p) return p;
  }
  throw new Error("Не удалось сгенерировать уровень");
}

function rotateMask(mask, rot) {
  let r = mask & 0xF;
  for (let i = 0; i < rot; i++) r = ((r << 1) | (r >> 3)) & 0xF; // поворот CW: N->E->S->W
  return r;
}

/* Быстрая проверка: множество blocked НЕ рассекает свободные клетки на части */
function isSetConnected(N, blocked) {
  const total = N * N, freeTotal = total - blocked.size;
  if (freeTotal <= 0) return false;
  let start = 0;
  while (blocked.has(start)) start++;
  const seen = new Uint8Array(total);
  const st = [start];
  seen[start] = 1;
  let cnt = 1;
  while (st.length) {
    const k = st.pop(), x = k % N, y = (k - x) / N;
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const nk = ny * N + nx;
      if (seen[nk] || blocked.has(nk)) continue;
      seen[nk] = 1; cnt++; st.push(nk);
    }
  }
  return cnt === freeTotal;
}

function areFreeConnected(N, blocked) {
  const key = (x, y) => y * N + x;
  let first = -1, cnt = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
    if (!blocked.has(key(x, y))) { if (first < 0) first = key(x, y); cnt++; }
  if (cnt === 0) return false;
  const seen = new Set([first]);
  const st = [first];
  while (st.length) {
    const k = st.pop();
    const x = k % N, y = Math.floor(k / N);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const nk = key(nx, ny);
      if (blocked.has(nk) || seen.has(nk)) continue;
      seen.add(nk); st.push(nk);
    }
  }
  return seen.size === cnt;
}

function validateSolution(N, tree, srcSet, rxSet, blocked) {
  const key = (x, y) => y * N + x;
  if (!srcSet.size || !rxSet.size) return false;
  for (const s of srcSet) if (!tree[s] || tree[s].size === 0) return false;
  const seen = new Set();
  const st = [...srcSet]; st.forEach(s => seen.add(s));
  while (st.length) {
    const k = st.pop(), x = k % N, y = Math.floor(k / N);
    tree[k].forEach(d => {
      const nk = key(x + DIRS[d][0], y + DIRS[d][1]);
      if (!blocked.has(nk) && tree[nk] && tree[nk].has(OPP(d)) && !seen.has(nk)) {
        seen.add(nk); st.push(nk);
      }
    });
  }
  for (const r of rxSet) if (!seen.has(r)) return false;
  for (const s of srcSet) if (!seen.has(s)) return false;
  return true;
}

/* ---------- распространение энергии (BFS от источников) ---------- */
function computeEnergy(grid, N) {
  const idx = (x, y) => y * N + x;
  const powered = new Uint8Array(grid.length);
  const dist = new Int32Array(grid.length).fill(-1);
  const q = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i].type === TYPES.SOURCE) { powered[i] = 1; dist[i] = 0; q.push(i); }
  }
  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const c = grid[i];
    for (let d = 0; d < 4; d++) {
      if (!(c.mask & (1 << d))) continue;
      const nx = c.x + DIRS[d][0], ny = c.y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = idx(nx, ny);
      const n = grid[j];
      if (powered[j]) continue;
      if (n.type === TYPES.BLOCK || n.type === TYPES.EMPTY) continue;
      if (!(n.mask & (1 << OPP(d)))) continue; // сосед должен смотреть назад
      powered[j] = 1; dist[j] = dist[i] + 1; q.push(j);
    }
  }
  let rxTotal = 0, rxOn = 0, srcSeen = 0;
  const srcKeys = new Set();
  for (let i = 0; i < grid.length; i++) {
    const g = grid[i];
    if (g.type === TYPES.RECEIVER) { rxTotal++; if (powered[i]) rxOn++; }
    if (g.type === TYPES.SOURCE) { srcSeen++; if (powered[i]) srcKeys.add(i); }
  }
  // объединение источников: все ли источники достижимы друг из друга через energized-путь
  // (т.к. энергия расходится от всех источников, источники "объединены", если они в одном
  //  связном компоненте проводников независимо от питания)
  const unionOK = sourcesConnected(grid, N);
  const won = rxTotal > 0 && rxOn === rxTotal && unionOK && srcSeen > 0;
  return { powered, dist, rxTotal, rxOn, won };
}

function sourcesConnected(grid, N) {
  const srcs = [];
  for (let i = 0; i < grid.length; i++) if (grid[i].type === TYPES.SOURCE) srcs.push(i);
  if (srcs.length <= 1) return true;
  const idx = (x, y) => y * N + x;
  const seen = new Set([srcs[0]]);
  const st = [srcs[0]];
  while (st.length) {
    const i = st.pop(), c = grid[i];
    for (let d = 0; d < 4; d++) {
      if (!(c.mask & (1 << d))) continue;
      const nx = c.x + DIRS[d][0], ny = c.y + DIRS[d][1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = idx(nx, ny), n = grid[j];
      if (seen.has(j) || n.type === TYPES.BLOCK || n.type === TYPES.EMPTY) continue;
      if (!(n.mask & (1 << OPP(d)))) continue;
      seen.add(j); st.push(j);
    }
  }
  return srcs.every(s => seen.has(s));
}

/* ---------- состояние ---------- */
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const state = {
  levelIdx: 0,
  puzzle: null,
  moves: 0,
  startTime: 0,
  elapsed: 0,
  timerId: null,
  done: new Set(JSON.parse(localStorage.getItem("contour_done") || "[]")),
  animRot: new Map(), // cellIndex -> {from,to,start}
  pulses: [],         // {i, dir, t}
  hintCell: -1, hintUntil: 0,
  won: false,
};

const CELL_PX = 64;
function boardPx() { return state.puzzle ? state.puzzle.N * CELL_PX : 640; }

function newPuzzle(idx, seedBase) {
  state.levelIdx = idx;
  state.puzzle = generateLevel(idx, (seedBase || Date.now()) % 2**31);
  state.moves = 0;
  state.won = false;
  state.pulses = [];
  state.hintCell = -1;
  resizeCanvas();
  restartTimer();
  updateHUD();
  renderLevelList();
  hideWin();
}

function resizeCanvas() {
  const px = boardPx();
  const dpr = window.devicePixelRatio || 1;
  const maxCss = Math.min(window.innerWidth - 80, 640);
  const css = Math.min(px, maxCss);
  canvas.style.width = css + "px";
  canvas.style.height = css + "px";
  canvas.width = px * dpr;
  canvas.height = px * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------- таймер / HUD ---------- */
function restartTimer() {
  clearInterval(state.timerId);
  state.startTime = performance.now();
  state.elapsed = 0;
  state.timerId = setInterval(() => {
    if (state.won) return;
    state.elapsed = Math.floor((performance.now() - state.startTime) / 1000);
    document.getElementById("timer").textContent = fmtTime(state.elapsed);
  }, 500);
}
const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function updateHUD() {
  const e = computeEnergy(state.puzzle.grid, state.puzzle.N);
  document.getElementById("moves").textContent = state.moves;
  document.getElementById("powered").textContent = `${e.rxOn}/${e.rxTotal}`;
  return e;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add("hidden"), 2200);
}

/* ---------- ввод ---------- */
canvas.addEventListener("pointerdown", ev => {
  if (state.won) return;
  const rect = canvas.getBoundingClientRect();
  const scale = boardPx() / rect.width;
  const x = Math.floor((ev.clientX - rect.left) * scale / CELL_PX);
  const y = Math.floor((ev.clientY - rect.top) * scale / CELL_PX);
  const N = state.puzzle.N;
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = y * N + x;
  const c = state.puzzle.grid[i];
  if (c.type === TYPES.BLOCK || c.type === TYPES.EMPTY) return;
  // поворот по часовой: rot+1
  state.animRot.set(i, { from: c.rot, to: c.rot + 1, start: performance.now() });
  c.rot = (c.rot + 1) % 4;
  c.mask = rotateMask(c.solMask, c.rot);
  state.moves++;
  const e = updateHUD();
  checkWin(e);
});

function checkWin(e) {
  if (e.won && !state.won) {
    state.won = true;
    clearInterval(state.timerId);
    state.done.add(state.levelIdx);
    localStorage.setItem("contour_done", JSON.stringify([...state.done]));
    renderLevelList();
    spawnConfettiPulses();
    setTimeout(showWin, 900);
  }
}

function spawnConfettiPulses() {
  const g = state.puzzle.grid;
  for (let i = 0; i < g.length; i++) {
    if (g[i].type === TYPES.SOURCE) {
      for (let d = 0; d < 4; d++) if (g[i].mask & (1 << d)) state.pulses.push({ i, dir: d, t: Math.random() });
    }
  }
}

/* подсказка: показать неверно повёрнутую клетку решения */
document.getElementById("btnHint").addEventListener("click", () => {
  if (state.won) return;
  const g = state.puzzle.grid;
  const wrong = [];
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c.type === TYPES.WIRE || c.type === TYPES.SOURCE || c.type === TYPES.RECEIVER) {
      if (c.rot % 4 !== 0) wrong.push(i);
    }
  }
  if (!wrong.length) { showToast("Всё подключено — сеть работает!"); return; }
  state.hintCell = wrong[Math.floor(Math.random() * wrong.length)];
  state.hintUntil = performance.now() + 2500;
  showToast("💡 Эта клетка повёрнута неверно");
});

document.getElementById("btnShuffle").addEventListener("click", () => {
  if (state.won) return;
  const g = state.puzzle.grid;
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c.type === TYPES.WIRE || c.type === TYPES.SOURCE || c.type === TYPES.RECEIVER) {
      const add = 1 + Math.floor(Math.random() * 3);
      state.animRot.set(i, { from: c.rot, to: c.rot + add, start: performance.now() });
      c.rot = (c.rot + add) % 4;
      c.mask = rotateMask(c.solMask, c.rot);
    }
  }
  state.moves = 0;
  updateHUD();
  showToast("Схема перемешана");
});

document.getElementById("btnReset").addEventListener("click", () => {
  newPuzzle(state.levelIdx, Date.now());
  showToast("Новая схема уровня");
});

/* ---------- список уровней ---------- */
function renderLevelList() {
  const list = document.getElementById("levelList");
  list.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const b = document.createElement("button");
    b.className = "level-btn" + (i === state.levelIdx ? " active" : "") + (state.done.has(i) ? " done" : "");
    b.innerHTML = `<span class="lvl-size">${L.size}×${L.size}</span>
      <span class="lvl-meta"><b>${L.name}</b><br>${L.sources} ист. · ${L.receivers} приём.</span>
      <span class="lvl-check">${state.done.has(i) ? "✔" : "○"}</span>`;
    b.onclick = () => newPuzzle(i, Date.now());
    list.appendChild(b);
  });
}

/* ---------- экран победы ---------- */
function showWin() {
  const ov = document.getElementById("winOverlay");
  const last = state.levelIdx >= LEVELS.length - 1;
  document.getElementById("winText").textContent = last
    ? "Все контуры активированы! Ты — мастер сигнальных сетей."
    : `Уровень «${LEVELS[state.levelIdx].name}» пройден!`;
  document.getElementById("winStats").innerHTML =
    `<div class="win-stat"><b>${state.moves}</b><span>ХОДОВ</span></div>
     <div class="win-stat"><b>${fmtTime(state.elapsed)}</b><span>ВРЕМЯ</span></div>
     <div class="win-stat"><b>${LEVELS[state.levelIdx].size}×${LEVELS[state.levelIdx].size}</b><span>КОНТУР</span></div>`;
  document.getElementById("btnNext").style.display = last ? "none" : "";
  ov.classList.remove("hidden");
}
function hideWin() { document.getElementById("winOverlay").classList.add("hidden"); }
document.getElementById("btnNext").onclick = () => newPuzzle(Math.min(state.levelIdx + 1, LEVELS.length - 1), Date.now());
document.getElementById("btnReplay").onclick = () => newPuzzle(state.levelIdx, Date.now());

/* ============================================================
   РЕНДЕР
   ============================================================ */
const COL = {
  bgCell: "#0d1626",
  bgCellAlt: "#0f1a2d",
  gridLine: "rgba(70,120,200,0.10)",
  wireOff: "#28405e",
  wireCapOff: "#3a5a80",
  neon: "#3ee6ff",
  neonCore: "#d8fbff",
  srcOff: "#1e5c40",
  srcOn: "#3dff9a",
  rxOff: "#6b5a26",
  rxOn: "#ffc94d",
  block: "#141d2e",
  blockEdge: "#2b3a52",
};

function draw(ts) {
  requestAnimationFrame(draw);
  if (!state.puzzle) return;
  const N = state.puzzle.N, g = state.puzzle.grid;
  const px = N * CELL_PX;
  const energy = computeEnergy(g, N);
  ctx.clearRect(0, 0, px, px);

  /* фон-подложка */
  ctx.fillStyle = "#0a111f";
  roundRect(ctx, 0, 0, px, px, 12); ctx.fill();

  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    const cx = c.x * CELL_PX, cy = c.y * CELL_PX;
    drawCellBg(cx, cy, i);
    if (c.type === TYPES.BLOCK) { drawBlock(cx, cy); continue; }
    if (c.type === TYPES.EMPTY) continue;

    /* анимация поворота */
    let rotAnim = 0;
    const a = state.animRot.get(i);
    if (a) {
      const dur = 220, t = (ts - a.start) / dur;
      if (t >= 1) { state.animRot.delete(i); rotAnim = 0; }
      else rotAnim = (1 - easeOutCubic(t)) * (a.to - a.from);
    }
    const angle = (c.rot * Math.PI / 2) + rotAnim * Math.PI / 2;
    // рисуем маску решения (solMask без поворота), повёрнутую на angle
    drawWires(cx, cy, c, angle, energy.powered[i], i, ts, energy.dist[i]);

    if (c.type === TYPES.SOURCE) drawSource(cx, cy, energy.powered[i], ts);
    else if (c.type === TYPES.RECEIVER) drawReceiver(cx, cy, energy.powered[i], ts);

    /* подсветка подсказки */
    if (state.hintCell === i && ts < state.hintUntil) {
      const p = 0.5 + 0.5 * Math.sin(ts / 120);
      ctx.strokeStyle = `rgba(255,201,77,${0.4 + 0.5 * p})`;
      ctx.lineWidth = 3;
      roundRect(ctx, cx + 3, cy + 3, CELL_PX - 6, CELL_PX - 6, 8);
      ctx.stroke();
    }
  }

  drawPulses(ts, g, N, energy);
}

function drawCellBg(cx, cy, i) {
  const c = (Math.floor(i / state.puzzle.N) + i) % 2 ? COL.bgCellAlt : COL.bgCell;
  ctx.fillStyle = c;
  roundRect(ctx, cx + 2, cy + 2, CELL_PX - 4, CELL_PX - 4, 7); ctx.fill();
  ctx.strokeStyle = COL.gridLine; ctx.lineWidth = 1;
  roundRect(ctx, cx + 2, cy + 2, CELL_PX - 4, CELL_PX - 4, 7); ctx.stroke();
}

/* Провода: маска solMask в локальных координатах, поворот на angle вокруг центра */
function drawWires(cx, cy, c, angle, on, idx, ts, dist) {
  const S = CELL_PX, h = S / 2;
  ctx.save();
  ctx.translate(cx + h, cy + h);
  ctx.rotate(angle);

  const arms = [];
  for (let d = 0; d < 4; d++) if (c.solMask & (1 << d)) arms.push(d);

  const baseCol = on ? COL.neon : COL.wireOff;
  const glowCol = "rgba(62,230,255,";

  // внешнее свечение
  if (on) {
    ctx.lineCap = "round";
    ctx.strokeStyle = glowCol + "0.22)";
    ctx.lineWidth = 14;
    ctx.shadowColor = COL.neon; ctx.shadowBlur = 16;
    arms.forEach(d => strokeArm(d, h));
    ctx.shadowBlur = 0;
  }
  // корпус дорожки (тёмная оплётка)
  ctx.lineCap = "round";
  ctx.strokeStyle = on ? "rgba(10,40,60,0.9)" : "#16263d";
  ctx.lineWidth = 12;
  arms.forEach(d => strokeArm(d, h));
  // основная линия
  ctx.strokeStyle = baseCol;
  ctx.lineWidth = 5.5;
  arms.forEach(d => strokeArm(d, h));
  // яркая сердцевина
  if (on) {
    ctx.strokeStyle = "rgba(216,251,255,0.85)";
    ctx.lineWidth = 2;
    arms.forEach(d => strokeArm(d, h));
  }
  // центральный контакт-пятачок (как на печатной плате)
  ctx.beginPath();
  ctx.arc(0, 0, on ? 7 : 6, 0, Math.PI * 2);
  ctx.fillStyle = on ? COL.neonCore : "#1d3049";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = on ? COL.neon : COL.wireCapOff;
  ctx.stroke();
  if (on) {
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff"; ctx.fill();
  }
  ctx.restore();
}
function strokeArm(d, h) {
  const [dx, dy] = DIRS[d];
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(dx * h, dy * h);
  ctx.stroke();
}

function drawSource(cx, cy, on, ts) {
  const h = CELL_PX / 2, cxm = cx + h, cym = cy + h;
  const pulse = on ? 1 + 0.08 * Math.sin(ts / 200) : 1;
  ctx.save();
  ctx.translate(cxm, cym); ctx.scale(pulse, pulse);
  if (on) { ctx.shadowColor = COL.srcOn; ctx.shadowBlur = 22; }
  // ромб-аккумулятор
  ctx.beginPath();
  ctx.moveTo(0, -17); ctx.lineTo(17, 0); ctx.lineTo(0, 17); ctx.lineTo(-17, 0); ctx.closePath();
  ctx.fillStyle = on ? "rgba(61,255,154,0.25)" : "rgba(40,90,66,0.3)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = on ? COL.srcOn : COL.srcOff;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // молния внутри
  ctx.beginPath();
  ctx.moveTo(2.5, -9); ctx.lineTo(-4.5, 1); ctx.lineTo(-0.5, 1); ctx.lineTo(-2.5, 9); ctx.lineTo(4.5, -1); ctx.lineTo(0.5, -1); ctx.closePath();
  ctx.fillStyle = on ? "#eaffef" : "#2c5645";
  ctx.fill();
  ctx.restore();
  // кольца энергии
  if (on) {
    const t = (ts / 1400) % 1;
    ctx.beginPath();
    ctx.arc(cxm, cym, 18 + 12 * t, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(61,255,154,${0.5 * (1 - t)})`;
    ctx.lineWidth = 2; ctx.stroke();
  }
}

function drawReceiver(cx, cy, on, ts) {
  const h = CELL_PX / 2, cxm = cx + h, cym = cy + h;
  ctx.save();
  if (on) { ctx.shadowColor = COL.rxOn; ctx.shadowBlur = 20; }
  ctx.beginPath();
  roundRectPath(ctx, cxm - 15, cym - 15, 30, 30, 7);
  ctx.fillStyle = on ? "rgba(255,201,77,0.22)" : "rgba(80,68,35,0.25)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = on ? COL.rxOn : COL.rxOff;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // лампочка-индикатор
  const blink = on ? 0.7 + 0.3 * Math.sin(ts / 160) : 0.25;
  ctx.beginPath();
  ctx.arc(cxm, cym, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = on ? `rgba(255,230,150,${blink})` : "#3d3a24";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = on ? COL.rxOn : COL.rxOff;
  ctx.stroke();
  ctx.restore();
}

function drawBlock(cx, cy) {
  ctx.save();
  ctx.fillStyle = COL.block;
  roundRect(ctx, cx + 8, cy + 8, CELL_PX - 16, CELL_PX - 16, 6); ctx.fill();
  ctx.strokeStyle = COL.blockEdge; ctx.lineWidth = 2;
  roundRect(ctx, cx + 8, cy + 8, CELL_PX - 16, CELL_PX - 16, 6); ctx.stroke();
  // диагональные штрихи "заглушка"
  ctx.beginPath();
  ctx.rect(cx + 8, cy + 8, CELL_PX - 16, CELL_PX - 16); ctx.clip();
  ctx.strokeStyle = "rgba(90,110,140,0.35)"; ctx.lineWidth = 2;
  for (let o = -CELL_PX; o < CELL_PX; o += 9) {
    ctx.beginPath();
    ctx.moveTo(cx + o, cy);
    ctx.lineTo(cx + o + CELL_PX, cy + CELL_PX);
    ctx.stroke();
  }
  ctx.restore();
}

/* бегущие световые импульсы по запитанным проводам */
function drawPulses(ts, g, N, energy) {
  const speed = 0.00055;
  ctx.save();
  for (let i = 0; i < g.length; i++) {
    if (!energy.powered[i]) continue;
    const c = g[i];
    if (c.type === TYPES.BLOCK || c.type === TYPES.EMPTY) continue;
    for (let d = 0; d < 4; d++) {
      if (!(c.mask & (1 << d))) continue;
      // фаза привязана к расстоянию от источника — волна бежит наружу
      const phase = ((ts * speed) - (energy.dist[i] || 0) * 0.22 + d * 0.13) % 1;
      const t = phase < 0 ? phase + 1 : phase;
      const h = CELL_PX / 2;
      const px = c.x * CELL_PX + h + DIRS[d][0] * h * t;
      const py = c.y * CELL_PX + h + DIRS[d][1] * h * t;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, 7);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.35, "rgba(62,230,255,0.7)");
      grad.addColorStop(1, "rgba(62,230,255,0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- вспомогательная графика ---------- */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); roundRectPath(ctx, x, y, w, h, r); }
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/* ---------- старт ---------- */
window.addEventListener("resize", resizeCanvas);
newPuzzle(0, Date.now());
requestAnimationFrame(draw);
