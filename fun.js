/* ==========================================================================
   fun.js — Fun Zone: hub navigation + 8 mini games
   ========================================================================== */

/* ---------------- Shared chrome: nav, dots, scroll bar, cursor ---------------- */
(function chrome() {
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.querySelectorAll('a').forEach(l => l.addEventListener('click', () => navLinks.classList.remove('open')));

  const dotsField = document.getElementById('dotsField');
  const DOT_COUNT = window.innerWidth < 720 ? 22 : 44;
  for (let i = 0; i < DOT_COUNT; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.left = Math.random() * 100 + 'vw';
    dot.style.animationDuration = (6 + Math.random() * 10) + 's';
    dot.style.animationDelay = '-' + (Math.random() * 10) + 's';
    const size = 2 + Math.random() * 2.5;
    dot.style.width = size + 'px';
    dot.style.height = size + 'px';
    dotsField.appendChild(dot);
  }

  const scrollProgress = document.getElementById('scrollProgress');
  function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    scrollProgress.style.width = (height > 0 ? (scrollTop / height) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', () => requestAnimationFrame(updateScrollProgress));
  updateScrollProgress();

  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');
  if (isFinePointer) {
    document.body.classList.add('has-custom-cursor');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cursorDot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      cursorRing.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', e => { if (e.target.closest('a, button')) cursorRing.classList.add('hovering'); });
    document.addEventListener('mouseout', e => { if (e.target.closest('a, button')) cursorRing.classList.remove('hovering'); });
  }
})();

/* ---------------- Hub routing ---------------- */
const menuView = document.getElementById('menuView');
const gameView = document.getElementById('gameView');
const gameStage = document.getElementById('gameStage');
const gameTitle = document.getElementById('gameTitle');
const backBtn = document.getElementById('backBtn');

let currentCleanup = null;

const GAMES = {
  ttt: { title: 'Tic Tac Toe', mount: mountTTT },
  tetris: { title: 'Lemon Tetris', mount: mountTetris },
  pong: { title: 'Pong vs AI', mount: mountPong },
  maze: { title: 'Maze Runner', mount: mountMaze },
  whack: { title: 'Whack-a-Lemon', mount: mountWhack },
  memory: { title: 'Memory Match', mount: mountMemory },
  wordle: { title: 'Dev Wordle', mount: mountWordle },
  clicker: { title: 'Lemon Clicker', mount: mountClicker }
};

document.querySelectorAll('.game-tile').forEach(tile => {
  tile.addEventListener('click', () => openGame(tile.dataset.game));
});

backBtn.addEventListener('click', closeGame);

function openGame(key) {
  const g = GAMES[key];
  if (!g) return;
  gameTitle.textContent = g.title;
  gameStage.innerHTML = '';
  menuView.hidden = true;
  gameView.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  currentCleanup = g.mount(gameStage) || null;
}

function closeGame() {
  if (currentCleanup) { try { currentCleanup(); } catch (e) {} }
  currentCleanup = null;
  gameStage.innerHTML = '';
  gameView.hidden = true;
  menuView.hidden = false;
}

function overlay(parentWrap, text, buttonLabel, onButton) {
  const el = document.createElement('div');
  el.className = 'game-overlay-msg';
  el.innerHTML = `<div><div style="margin-bottom:14px;">${text}</div>${buttonLabel ? `<button class="game-btn" type="button">${buttonLabel}</button>` : ''}</div>`;
  parentWrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  if (buttonLabel) {
    el.querySelector('button').addEventListener('click', () => {
      el.remove();
      onButton && onButton();
    });
  }
  return el;
}

/* ======================================================================
   1) TIC TAC TOE
   ====================================================================== */
function mountTTT(container) {
  container.innerHTML = `
    <p class="game-hud">You play <span class="val">X</span> against the box</p>
    <div class="game-canvas-wrap" style="max-width:340px;">
      <div class="ttt-board" id="tttBoard"></div>
    </div>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const boardEl = container.querySelector('#tttBoard');
  let cells = Array(9).fill(null);
  let active = true;
  let resetTimer = null;

  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  function winner(b) {
    for (const [a, b1, c] of LINES) {
      if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
    }
    return b.every(v => v) ? 'draw' : null;
  }

  function render() {
    boardEl.innerHTML = '';
    cells.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.className = 'ttt-cell' + (v === 'O' ? ' o-mark' : '');
      btn.textContent = v || '';
      btn.disabled = !!v || !active;
      btn.addEventListener('click', () => playerMove(i));
      boardEl.appendChild(btn);
    });
  }

  function playerMove(i) {
    if (!active || cells[i]) return;
    cells[i] = 'X';
    render();
    const w = winner(cells);
    if (w) return endGame(w);
    active = false;
    setTimeout(aiMove, 400);
  }

  function aiMove() {
    const move = bestAiMove();
    if (move != null) cells[move] = 'O';
    render();
    const w = winner(cells);
    if (w) return endGame(w);
    active = true;
    render();
  }

  function bestAiMove() {
    const avail = cells.map((v, i) => v ? null : i).filter(v => v !== null);
    for (const i of avail) { const t = cells.slice(); t[i] = 'O'; if (winner(t) === 'O') return i; }
    for (const i of avail) { const t = cells.slice(); t[i] = 'X'; if (winner(t) === 'X') return i; }
    if (cells[4] === null) return 4;
    const corners = [0, 2, 6, 8].filter(i => cells[i] === null);
    if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
    return avail[Math.floor(Math.random() * avail.length)];
  }

  function endGame(w) {
    active = false;
    render();
    const msg = w === 'draw' ? "It's a draw!" : (w === 'X' ? 'You win! 🎉' : 'The box wins! 🤖');
    const el = overlay(wrap, msg, null);
    resetTimer = setTimeout(() => { el.remove(); resetGame(); }, 3000);
  }

  function resetGame() {
    cells = Array(9).fill(null);
    active = true;
    render();
  }

  render();
  return () => clearTimeout(resetTimer);
}

/* ======================================================================
   2) LEMON TETRIS
   ====================================================================== */
function mountTetris(container) {
  container.innerHTML = `
    <div class="game-hud">
      <span>Score <span class="val" id="tetScore">0</span></span>
      <span>Lines <span class="val" id="tetLines">0</span></span>
    </div>
    <div class="game-canvas-wrap" style="max-width:280px;">
      <canvas id="tetCanvas" width="280" height="560"></canvas>
    </div>
    <p style="font-size:0.78rem;color:var(--muted);text-align:center;">← → move · ↑ rotate · ↓ soft drop · Space hard drop</p>
    <div class="touch-controls">
      <button class="tc-btn" id="tcLeft">◀</button>
      <button class="tc-btn" id="tcRotate">⟳</button>
      <button class="tc-btn" id="tcDown">▼</button>
      <button class="tc-btn" id="tcRight">▶</button>
    </div>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const canvas = container.querySelector('#tetCanvas');
  const ctx = canvas.getContext('2d');
  const COLS = 10, ROWS = 20;
  const CELL = canvas.width / COLS;
  const LEMONS = ['#FFD93D', '#FFE066', '#F4C430', '#FFEA70', '#F7DC6F', '#FCE38A', '#FFD447'];

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]]
  };
  const KEYS = Object.keys(SHAPES);

  let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  let score = 0, lines = 0;
  let cur, running = true, dropTimer, tickMs = 650;

  function rotate(matrix) {
    const rowsN = matrix.length, colsN = matrix[0].length;
    const res = Array.from({ length: colsN }, () => Array(rowsN).fill(0));
    for (let r = 0; r < rowsN; r++) for (let c = 0; c < colsN; c++) res[c][rowsN - 1 - r] = matrix[r][c];
    return res;
  }

  function spawn() {
    const key = KEYS[Math.floor(Math.random() * KEYS.length)];
    cur = { shape: SHAPES[key], color: LEMONS[Math.floor(Math.random() * LEMONS.length)], x: Math.floor(COLS / 2) - 1, y: 0 };
    if (collide(cur.shape, cur.x, cur.y)) gameOver();
  }

  function collide(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const x = ox + c, y = oy + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;
      }
    }
    return false;
  }

  function lock() {
    cur.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) { const y = cur.y + r, x = cur.x + c; if (y >= 0) board[y][x] = cur.color; }
    }));
    clearLines();
    spawn();
  }

  function clearLines() {
    let cleared = 0;
    board = board.filter(row => {
      const full = row.every(v => v);
      if (full) cleared++;
      return !full;
    });
    while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
    if (cleared) {
      lines += cleared;
      score += [0, 100, 300, 500, 800][cleared] || 1000;
      tickMs = Math.max(220, 650 - lines * 12);
      document.getElementById('tetScore').textContent = score;
      document.getElementById('tetLines').textContent = lines;
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0708';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (board[r][c]) drawCell(c, r, board[r][c]);
    }
    if (cur) cur.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) drawCell(cur.x + c, cur.y + r, cur.color);
    }));
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke(); }
  }

  function drawCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.strokeRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
  }

  function tryMove(dx, dy) {
    if (!running) return;
    if (!collide(cur.shape, cur.x + dx, cur.y + dy)) { cur.x += dx; cur.y += dy; draw(); return true; }
    return false;
  }

  function tryRotate() {
    if (!running) return;
    const r = rotate(cur.shape);
    let ox = cur.x;
    if (collide(r, ox, cur.y)) { ox = cur.x - 1; if (collide(r, ox, cur.y)) { ox = cur.x + 1; if (collide(r, ox, cur.y)) return; } }
    cur.shape = r; cur.x = ox; draw();
  }

  function hardDrop() {
    if (!running) return;
    while (!collide(cur.shape, cur.x, cur.y + 1)) cur.y++;
    lock(); draw();
  }

  function tick() {
    if (!running) return;
    if (!tryMove(0, 1)) lock();
    draw();
    dropTimer = setTimeout(tick, tickMs);
  }

  function gameOver() {
    running = false;
    clearTimeout(dropTimer);
    overlay(wrap, `Game Over<br><span style="font-size:1rem;font-weight:600;color:var(--muted);">Score: ${score}</span>`, 'Play Again', () => {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      score = 0; lines = 0; tickMs = 650; running = true;
      document.getElementById('tetScore').textContent = 0;
      document.getElementById('tetLines').textContent = 0;
      spawn(); draw(); dropTimer = setTimeout(tick, tickMs);
    });
  }

  function keyHandler(e) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowLeft') tryMove(-1, 0);
    else if (e.key === 'ArrowRight') tryMove(1, 0);
    else if (e.key === 'ArrowUp') tryRotate();
    else if (e.key === 'ArrowDown') { if (tryMove(0, 1)) score++; }
    else if (e.key === ' ') hardDrop();
  }
  document.addEventListener('keydown', keyHandler);

  container.querySelector('#tcLeft').addEventListener('click', () => tryMove(-1, 0));
  container.querySelector('#tcRight').addEventListener('click', () => tryMove(1, 0));
  container.querySelector('#tcRotate').addEventListener('click', tryRotate);
  container.querySelector('#tcDown').addEventListener('click', () => tryMove(0, 1));

  spawn(); draw(); dropTimer = setTimeout(tick, tickMs);

  return () => { running = false; clearTimeout(dropTimer); document.removeEventListener('keydown', keyHandler); };
}

/* ======================================================================
   3) PONG VS AI
   ====================================================================== */
function mountPong(container) {
  container.innerHTML = `
    <div class="game-hud">
      <span>You <span class="val" id="pongPlayerScore">0</span></span>
      <span>AI <span class="val" id="pongAiScore">0</span></span>
    </div>
    <div class="game-canvas-wrap" style="max-width:420px;">
      <canvas id="pongCanvas" width="420" height="280"></canvas>
    </div>
    <p style="font-size:0.78rem;color:var(--muted);text-align:center;">Move your mouse/finger over the board, or use ↑ / ↓</p>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const canvas = container.querySelector('#pongCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PW = 8, PH = 60;
  let playerY = H / 2 - PH / 2, aiY = H / 2 - PH / 2;
  let ballX = W / 2, ballY = H / 2, ballVX = 4, ballVY = 3;
  let playerScore = 0, aiScore = 0;
  let running = true, raf;

  function resetBall(dir) {
    ballX = W / 2; ballY = H / 2;
    ballVX = 4 * dir; ballVY = (Math.random() * 4 - 2) || 2;
  }

  function draw() {
    ctx.fillStyle = '#0a0708';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff2d3e';
    ctx.fillRect(14, playerY, PW, PH);
    ctx.fillStyle = '#ff6b57';
    ctx.fillRect(W - 14 - PW, aiY, PW, PH);
    ctx.beginPath(); ctx.arc(ballX, ballY, 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }

  function update() {
    if (!running) return;
    ballX += ballVX; ballY += ballVY;
    if (ballY < 6 || ballY > H - 6) ballVY *= -1;

    if (ballX - 6 < 14 + PW && ballY > playerY && ballY < playerY + PH && ballVX < 0) {
      ballVX *= -1.05;
      ballVY += (ballY - (playerY + PH / 2)) * 0.12;
    }
    if (ballX + 6 > W - 14 - PW && ballY > aiY && ballY < aiY + PH && ballVX > 0) {
      ballVX *= -1.05;
      ballVY += (ballY - (aiY + PH / 2)) * 0.12;
    }

    const aiCenter = aiY + PH / 2;
    const targetY = ballY;
    const aiSpeed = 3.1;
    if (Math.abs(aiCenter - targetY) > 6) aiY += aiCenter < targetY ? aiSpeed : -aiSpeed;
    aiY = Math.max(0, Math.min(H - PH, aiY));

    if (ballX < 0) { aiScore++; document.getElementById('pongAiScore').textContent = aiScore; checkWin(); resetBall(1); }
    if (ballX > W) { playerScore++; document.getElementById('pongPlayerScore').textContent = playerScore; checkWin(); resetBall(-1); }

    draw();
    raf = requestAnimationFrame(update);
  }

  function checkWin() {
    if (playerScore >= 5 || aiScore >= 5) {
      running = false;
      const msg = playerScore >= 5 ? 'You win! 🎉' : 'AI wins! 🤖';
      overlay(wrap, msg, 'Play Again', () => {
        playerScore = 0; aiScore = 0;
        document.getElementById('pongPlayerScore').textContent = 0;
        document.getElementById('pongAiScore').textContent = 0;
        running = true; resetBall(1); update();
      });
    }
  }

  function moveTo(clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = H / rect.height;
    playerY = (clientY - rect.top) * scale - PH / 2;
    playerY = Math.max(0, Math.min(H - PH, playerY));
  }
  function mouseMove(e) { moveTo(e.clientY); }
  function touchMove(e) { if (e.touches[0]) { moveTo(e.touches[0].clientY); e.preventDefault(); } }
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('touchmove', touchMove, { passive: false });

  function keyHandler(e) {
    if (e.key === 'ArrowUp') { playerY = Math.max(0, playerY - 24); e.preventDefault(); }
    if (e.key === 'ArrowDown') { playerY = Math.min(H - PH, playerY + 24); e.preventDefault(); }
  }
  document.addEventListener('keydown', keyHandler);

  resetBall(1); draw(); raf = requestAnimationFrame(update);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    canvas.removeEventListener('mousemove', mouseMove);
    canvas.removeEventListener('touchmove', touchMove);
    document.removeEventListener('keydown', keyHandler);
  };
}

/* ======================================================================
   4) MAZE RUNNER
   ====================================================================== */
function mountMaze(container) {
  container.innerHTML = `
    <div class="game-hud"><span>Find the green exit</span></div>
    <div class="game-canvas-wrap" style="max-width:360px;">
      <div class="maze-grid" id="mazeGrid"></div>
    </div>
    <div class="touch-controls">
      <button class="tc-btn" id="mUp">▲</button>
      <button class="tc-btn" id="mLeft">◀</button>
      <button class="tc-btn" id="mDown">▼</button>
      <button class="tc-btn" id="mRight">▶</button>
    </div>
    <button class="game-btn secondary" id="mazeNew" type="button">New Maze</button>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const gridEl = container.querySelector('#mazeGrid');
  const N = 11;
  let cells, player, exitPos, solved = false;

  function genMaze() {
    cells = Array.from({ length: N }, () => Array.from({ length: N }, () => ({ top: true, right: true, bottom: true, left: true, visited: false })));
    function carve(r, c) {
      cells[r][c].visited = true;
      const dirs = shuffle([['top', -1, 0, 'bottom'], ['right', 0, 1, 'left'], ['bottom', 1, 0, 'top'], ['left', 0, -1, 'right']]);
      for (const [wall, dr, dc, opp] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && !cells[nr][nc].visited) {
          cells[r][c][wall] = false;
          cells[nr][nc][opp] = false;
          carve(nr, nc);
        }
      }
    }
    carve(0, 0);
    player = { r: 0, c: 0 };
    exitPos = { r: N - 1, c: N - 1 };
    solved = false;
  }

  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  function render() {
    const size = 2 * N + 1;
    gridEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    gridEl.innerHTML = '';
    const disp = Array.from({ length: size }, () => Array(size).fill('wall'));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const dr = 2 * r + 1, dc = 2 * c + 1;
      disp[dr][dc] = 'path';
      if (!cells[r][c].top) disp[dr - 1][dc] = 'path';
      if (!cells[r][c].right) disp[dr][dc + 1] = 'path';
      if (!cells[r][c].bottom) disp[dr + 1][dc] = 'path';
      if (!cells[r][c].left) disp[dr][dc - 1] = 'path';
    }
    disp[2 * exitPos.r + 1][2 * exitPos.c + 1] = 'exit';
    disp[2 * player.r + 1][2 * player.c + 1] = 'player';

    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const cell = document.createElement('div');
      cell.className = 'maze-cell ' + disp[r][c];
      gridEl.appendChild(cell);
    }
  }

  function move(dr, dc) {
    if (solved) return;
    const wallMap = { '-1,0': 'top', '1,0': 'bottom', '0,-1': 'left', '0,1': 'right' };
    const wall = wallMap[`${dr},${dc}`];
    const cur = cells[player.r][player.c];
    if (cur[wall]) return;
    const nr = player.r + dr, nc = player.c + dc;
    if (nr < 0 || nr >= N || nc < 0 || nc >= N) return;
    player = { r: nr, c: nc };
    render();
    if (player.r === exitPos.r && player.c === exitPos.c) {
      solved = true;
      overlay(wrap, 'You found the exit! 🎉', 'New Maze', () => { genMaze(); render(); });
    }
  }

  function keyHandler(e) {
    if (e.key === 'ArrowUp') move(-1, 0);
    else if (e.key === 'ArrowDown') move(1, 0);
    else if (e.key === 'ArrowLeft') move(0, -1);
    else if (e.key === 'ArrowRight') move(0, 1);
    else return;
    e.preventDefault();
  }
  document.addEventListener('keydown', keyHandler);
  container.querySelector('#mUp').addEventListener('click', () => move(-1, 0));
  container.querySelector('#mDown').addEventListener('click', () => move(1, 0));
  container.querySelector('#mLeft').addEventListener('click', () => move(0, -1));
  container.querySelector('#mRight').addEventListener('click', () => move(0, 1));
  container.querySelector('#mazeNew').addEventListener('click', () => { genMaze(); render(); });

  genMaze(); render();

  return () => document.removeEventListener('keydown', keyHandler);
}

/* ======================================================================
   5) WHACK-A-LEMON
   ====================================================================== */
function mountWhack(container) {
  container.innerHTML = `
    <div class="game-hud">
      <span>Score <span class="val" id="whackScore">0</span></span>
      <span>Time <span class="val" id="whackTime">30</span>s</span>
    </div>
    <div class="game-canvas-wrap" style="max-width:320px;">
      <div class="whack-grid" id="whackGrid"></div>
    </div>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const gridEl = container.querySelector('#whackGrid');
  const holes = [];
  for (let i = 0; i < 9; i++) {
    const hole = document.createElement('div');
    hole.className = 'whack-hole';
    hole.innerHTML = '<span>🍋</span>';
    gridEl.appendChild(hole);
    holes.push(hole);
  }

  let score = 0, timeLeft = 30, running = true, spawnTimer, countdownTimer, activeIdx = -1, hideTimer;

  function spawn() {
    if (!running) return;
    if (activeIdx >= 0) holes[activeIdx].classList.remove('active');
    let idx = Math.floor(Math.random() * holes.length);
    activeIdx = idx;
    holes[idx].classList.add('active');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { holes[idx].classList.remove('active'); }, 700);
    spawnTimer = setTimeout(spawn, 750 + Math.random() * 300);
  }

  holes.forEach((hole, i) => {
    hole.addEventListener('click', () => {
      if (!running || !hole.classList.contains('active')) return;
      hole.classList.remove('active');
      score++;
      document.getElementById('whackScore').textContent = score;
    });
  });

  countdownTimer = setInterval(() => {
    timeLeft--;
    document.getElementById('whackTime').textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  function endGame() {
    running = false;
    clearTimeout(spawnTimer);
    clearTimeout(hideTimer);
    clearInterval(countdownTimer);
    holes.forEach(h => h.classList.remove('active'));
    overlay(wrap, `Time's up!<br><span style="font-size:1rem;font-weight:600;color:var(--muted);">Score: ${score}</span>`, 'Play Again', () => {
      score = 0; timeLeft = 30; running = true;
      document.getElementById('whackScore').textContent = 0;
      document.getElementById('whackTime').textContent = 30;
      countdownTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('whackTime').textContent = timeLeft;
        if (timeLeft <= 0) endGame();
      }, 1000);
      spawn();
    });
  }

  spawn();

  return () => { running = false; clearTimeout(spawnTimer); clearTimeout(hideTimer); clearInterval(countdownTimer); };
}

/* ======================================================================
   6) MEMORY MATCH
   ====================================================================== */
function mountMemory(container) {
  container.innerHTML = `
    <div class="game-hud"><span>Pairs <span class="val" id="memPairs">0</span> / 8</span></div>
    <div class="game-canvas-wrap" style="max-width:360px;">
      <div class="memory-grid" id="memGrid"></div>
    </div>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const gridEl = container.querySelector('#memGrid');
  const ICONS = ['🐍', '☕', '🌐', '🎨', '🍋', '⭐', '🎮', '💬'];
  let deck, flipped = [], matched = 0, lock = false;

  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  function build() {
    deck = shuffle([...ICONS, ...ICONS]);
    matched = 0; flipped = []; lock = false;
    document.getElementById('memPairs').textContent = 0;
    gridEl.innerHTML = '';
    deck.forEach((icon, i) => {
      const card = document.createElement('button');
      card.className = 'memory-card';
      card.dataset.icon = icon;
      card.dataset.idx = i;
      card.textContent = '❔';
      card.addEventListener('click', () => flipCard(card));
      gridEl.appendChild(card);
    });
  }

  function flipCard(card) {
    if (lock || card.classList.contains('flipped') || card.classList.contains('matched')) return;
    card.classList.add('flipped');
    card.textContent = card.dataset.icon;
    flipped.push(card);
    if (flipped.length === 2) {
      lock = true;
      const [a, b] = flipped;
      if (a.dataset.icon === b.dataset.icon) {
        a.classList.add('matched'); b.classList.add('matched');
        matched++;
        document.getElementById('memPairs').textContent = matched;
        flipped = []; lock = false;
        if (matched === ICONS.length) {
          setTimeout(() => overlay(wrap, 'You matched them all! 🎉', 'Play Again', build), 300);
        }
      } else {
        setTimeout(() => {
          a.classList.remove('flipped'); a.textContent = '❔';
          b.classList.remove('flipped'); b.textContent = '❔';
          flipped = []; lock = false;
        }, 800);
      }
    }
  }

  build();
  return () => {};
}

/* ======================================================================
   7) DEV WORDLE
   ====================================================================== */
function mountWordle(container) {
  const WORDS = ['ARRAY', 'CACHE', 'DEBUG', 'PROXY', 'STACK', 'QUEUE', 'INDEX', 'CLASS', 'BUILD', 'MERGE', 'LOGIC', 'BYTES', 'PIXEL', 'FLASK', 'REACT', 'REGEX', 'LINUX', 'ADMIN', 'EMAIL', 'MEDIA'];
  container.innerHTML = `
    <div class="game-canvas-wrap" style="max-width:320px;">
      <div class="wordle-board" id="wordleBoard"></div>
    </div>
    <div class="wordle-keyboard" id="wordleKeyboard"></div>
  `;
  const wrap = container.querySelector('.game-canvas-wrap');
  const boardEl = container.querySelector('#wordleBoard');
  const kbEl = container.querySelector('#wordleKeyboard');
  const ROWS_N = 6;

  let target, guess, row, over, keyStates;

  function newGame() {
    target = WORDS[Math.floor(Math.random() * WORDS.length)];
    guess = ''; row = 0; over = false; keyStates = {};
    buildBoard(); buildKeyboard();
  }

  function buildBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < ROWS_N; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-row';
      for (let c = 0; c < 5; c++) {
        const tile = document.createElement('div');
        tile.className = 'wordle-tile';
        tile.id = `wt-${r}-${c}`;
        rowEl.appendChild(tile);
      }
      boardEl.appendChild(rowEl);
    }
  }

  function buildKeyboard() {
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    kbEl.innerHTML = '';
    rows.forEach((r, i) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-key-row';
      if (i === 2) rowEl.appendChild(makeKey('ENTER', true));
      r.split('').forEach(k => rowEl.appendChild(makeKey(k)));
      if (i === 2) rowEl.appendChild(makeKey('DEL', true));
      kbEl.appendChild(rowEl);
    });
  }

  function makeKey(label, wide) {
    const btn = document.createElement('button');
    btn.className = 'wordle-key' + (wide ? ' wide' : '');
    btn.textContent = label;
    btn.id = 'wk-' + label;
    btn.addEventListener('click', () => handleKey(label));
    return btn;
  }

  function handleKey(label) {
    if (over) return;
    if (label === 'ENTER') return submitGuess();
    if (label === 'DEL') { guess = guess.slice(0, -1); updateRow(); return; }
    if (guess.length < 5 && /^[A-Z]$/.test(label)) { guess += label; updateRow(); }
  }

  function updateRow() {
    for (let c = 0; c < 5; c++) {
      document.getElementById(`wt-${row}-${c}`).textContent = guess[c] || '';
    }
  }

  function submitGuess() {
    if (guess.length !== 5) return;
    const result = evaluate(guess, target);
    result.forEach((status, c) => {
      const tile = document.getElementById(`wt-${row}-${c}`);
      tile.classList.add(status);
      const letter = guess[c];
      const rank = { absent: 0, present: 1, correct: 2 };
      if (!(letter in keyStates) || rank[status] > rank[keyStates[letter]]) {
        keyStates[letter] = status;
        const key = document.getElementById('wk-' + letter);
        if (key) { key.classList.remove('correct', 'present', 'absent'); key.classList.add(status); }
      }
    });
    if (guess === target) {
      over = true;
      setTimeout(() => overlay(wrap, `You got it! 🎉<br><span style="font-size:0.95rem;color:var(--muted);">${target}</span>`, 'Play Again', newGame), 400);
    } else if (row === ROWS_N - 1) {
      over = true;
      setTimeout(() => overlay(wrap, `Out of tries<br><span style="font-size:0.95rem;color:var(--muted);">Word was ${target}</span>`, 'Play Again', newGame), 400);
    } else {
      row++; guess = '';
    }
  }

  function evaluate(g, t) {
    const res = Array(5).fill('absent');
    const pool = t.split('');
    for (let i = 0; i < 5; i++) if (g[i] === t[i]) { res[i] = 'correct'; pool[i] = null; }
    for (let i = 0; i < 5; i++) {
      if (res[i] === 'correct') continue;
      const idx = pool.indexOf(g[i]);
      if (idx > -1) { res[i] = 'present'; pool[idx] = null; }
    }
    return res;
  }

  function keyHandler(e) {
    if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    else if (e.key === 'Enter') handleKey('ENTER');
    else if (e.key === 'Backspace') handleKey('DEL');
  }
  document.addEventListener('keydown', keyHandler);

  newGame();
  return () => document.removeEventListener('keydown', keyHandler);
}

/* ======================================================================
   8) LEMON CLICKER
   ====================================================================== */
function mountClicker(container) {
  container.innerHTML = `
    <div class="game-hud"><span>Lemons <span class="val" id="clkScore">0</span></span></div>
    <div class="clicker-lemon" id="clkLemon">🍋</div>
    <div class="clicker-upgrades" id="clkUpgrades"></div>
  `;
  const scoreEl = container.querySelector('#clkScore');
  const lemonEl = container.querySelector('#clkLemon');
  const upgradesEl = container.querySelector('#clkUpgrades');

  let points = 0;
  const upgrades = [
    { id: 'basket', name: 'Bigger Basket', desc: '+1 per click', baseCost: 10, scale: 1.6, owned: 0, effect: 'click', amount: 1 },
    { id: 'auto', name: 'Auto Picker', desc: '+1 lemon / sec', baseCost: 25, scale: 1.7, owned: 0, effect: 'auto', amount: 1 },
    { id: 'golden', name: 'Golden Lemon Tree', desc: '+5 lemons / sec', baseCost: 150, scale: 1.8, owned: 0, effect: 'auto', amount: 5 }
  ];
  let perClick = 1, perSec = 0;

  function cost(u) { return Math.round(u.baseCost * Math.pow(u.scale, u.owned)); }

  function renderUpgrades() {
    upgradesEl.innerHTML = '';
    upgrades.forEach(u => {
      const row = document.createElement('div');
      row.className = 'clicker-upgrade';
      const c = cost(u);
      row.innerHTML = `
        <div class="clicker-upgrade-info">
          <b>${u.name} <span style="color:var(--muted);font-weight:600;">(${u.owned})</span></b>
          <span>${u.desc} · cost ${c}</span>
        </div>
        <button class="clicker-buy" ${points < c ? 'disabled' : ''}>Buy</button>
      `;
      row.querySelector('button').addEventListener('click', () => buy(u));
      upgradesEl.appendChild(row);
    });
  }

  function buy(u) {
    const c = cost(u);
    if (points < c) return;
    points -= c;
    u.owned++;
    if (u.effect === 'click') perClick += u.amount;
    else perSec += u.amount;
    updateUI();
  }

  function updateUI() {
    scoreEl.textContent = Math.floor(points);
    renderUpgrades();
  }

  lemonEl.addEventListener('click', () => {
    points += perClick;
    lemonEl.style.transform = 'scale(0.85)';
    setTimeout(() => lemonEl.style.transform = '', 90);
    updateUI();
  });

  const tickInterval = setInterval(() => {
    if (perSec > 0) { points += perSec; updateUI(); }
  }, 1000);

  updateUI();
  return () => clearInterval(tickInterval);
}
