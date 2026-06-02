const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const scoreNode = document.querySelector("#score");
const levelNode = document.querySelector("#level");
const livesNode = document.querySelector("#lives");
const bestNode = document.querySelector("#best");
const startPanel = document.querySelector("#startPanel");
const gameOverPanel = document.querySelector("#gameOverPanel");
const finalScoreNode = document.querySelector("#finalScore");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const againButton = document.querySelector("#againButton");
const leftButton = document.querySelector("#leftButton");
const rightButton = document.querySelector("#rightButton");

const STORAGE_KEY = "star-courier-best-score";
const DPR_CAP = 2;

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  level: 1,
  lives: 3,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  lastTime: 0,
  spawnTimer: 0,
  starTimer: 0,
  keys: new Set(),
  objects: [],
  stars: [],
  ripples: [],
};

const player = {
  x: 0,
  y: 0,
  width: 88,
  height: 28,
  speed: 520,
  tilt: 0,
};

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resizeCanvas() {
  state.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  player.width = clamp(state.width * 0.13, 68, 112);
  player.height = clamp(state.width * 0.04, 24, 34);
  player.x = clamp(player.x || state.width / 2, player.width / 2 + 12, state.width - player.width / 2 - 12);
  player.y = state.height - Math.max(78, state.height * 0.12);

  makeStarfield();
}

function makeStarfield() {
  const count = Math.round(clamp(state.width * state.height * 0.0001, 70, 150));
  state.stars = Array.from({ length: count }, () => ({
    x: random(0, state.width),
    y: random(0, state.height),
    size: random(0.5, 2.2),
    drift: random(8, 34),
    alpha: random(0.28, 0.9),
  }));
}

function resetGame() {
  state.running = false;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.spawnTimer = 0.35;
  state.starTimer = 0;
  state.lastTime = performance.now();
  state.objects = [];
  state.ripples = [];
  player.x = state.width / 2;
  player.tilt = 0;
  updateHud();
}

function startGame() {
  resetGame();
  state.running = true;
  startPanel.classList.add("is-hidden");
  gameOverPanel.classList.add("is-hidden");
  pauseButton.setAttribute("aria-label", "暂停");
  pauseButton.setAttribute("title", "暂停");
  pauseButton.querySelector("span").textContent = "II";
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  finalScoreNode.textContent = String(state.score);
  gameOverPanel.classList.remove("is-hidden");

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }

  updateHud();
}

function updateHud() {
  scoreNode.textContent = String(state.score);
  levelNode.textContent = String(state.level);
  livesNode.textContent = String(state.lives);
  bestNode.textContent = String(state.best);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  state.lastTime = performance.now();
  pauseButton.setAttribute("aria-label", state.paused ? "继续" : "暂停");
  pauseButton.setAttribute("title", state.paused ? "继续" : "暂停");
  pauseButton.querySelector("span").textContent = state.paused ? "▶" : "II";
}

function spawnObject() {
  const isHazard = Math.random() < Math.min(0.18 + state.level * 0.025, 0.42);
  const size = isHazard ? random(26, 42) : random(22, 34);
  const speed = random(140, 220) + state.level * 22;
  state.objects.push({
    x: random(size, state.width - size),
    y: -size,
    size,
    speed,
    spin: random(-2.4, 2.4),
    angle: random(0, Math.PI * 2),
    kind: isHazard ? "meteor" : "star",
    glow: random(0.7, 1.25),
  });
}

function movePlayer(delta) {
  let direction = 0;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) direction -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) direction += 1;

  const previousX = player.x;
  player.x += direction * player.speed * delta;
  player.x = clamp(player.x, player.width / 2 + 10, state.width - player.width / 2 - 10);
  player.tilt = clamp((player.x - previousX) * 0.12, -9, 9);
}

function update(delta) {
  if (!state.running || state.paused) return;

  state.starTimer += delta;
  state.spawnTimer -= delta;
  state.level = Math.floor(state.score / 120) + 1;

  const spawnEvery = clamp(0.8 - state.level * 0.045, 0.28, 0.8);
  if (state.spawnTimer <= 0) {
    spawnObject();
    state.spawnTimer = spawnEvery;
  }

  movePlayer(delta);

  for (const star of state.stars) {
    star.y += star.drift * delta;
    if (star.y > state.height + 4) {
      star.x = random(0, state.width);
      star.y = -4;
    }
  }

  for (const item of state.objects) {
    item.y += item.speed * delta;
    item.angle += item.spin * delta;
  }

  resolveCollisions();
  state.objects = state.objects.filter((item) => item.y < state.height + item.size * 2);
  state.ripples = state.ripples.filter((ripple) => ripple.life > 0);
  for (const ripple of state.ripples) {
    ripple.life -= delta;
    ripple.radius += ripple.speed * delta;
  }

  updateHud();
}

function resolveCollisions() {
  const playerLeft = player.x - player.width / 2;
  const playerRight = player.x + player.width / 2;
  const playerTop = player.y - player.height / 2;
  const playerBottom = player.y + player.height / 2;

  for (const item of state.objects) {
    if (item.hit) continue;
    const closestX = clamp(item.x, playerLeft, playerRight);
    const closestY = clamp(item.y, playerTop, playerBottom);
    const dx = item.x - closestX;
    const dy = item.y - closestY;
    const collision = dx * dx + dy * dy <= (item.size * 0.52) ** 2;

    if (!collision) continue;

    item.hit = true;
    state.ripples.push({
      x: item.x,
      y: item.y,
      radius: 8,
      speed: item.kind === "meteor" ? 170 : 115,
      color: item.kind === "meteor" ? "rgba(255, 77, 109," : "rgba(255, 209, 102,",
      life: 0.42,
    });

    if (item.kind === "meteor") {
      state.lives -= 1;
      if (state.lives <= 0) {
        endGame();
        return;
      }
    } else {
      state.score += 10 + state.level * 2;
    }
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, state.height);
  sky.addColorStop(0, "#07111f");
  sky.addColorStop(0.58, "#172b3b");
  sky.addColorStop(1, "#111827");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.save();
  for (const star of state.stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.size > 1.6 ? "#ffd166" : "#e6f4ff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const horizon = state.height * 0.78;
  const haze = ctx.createLinearGradient(0, horizon - 80, 0, state.height);
  haze.addColorStop(0, "rgba(76, 201, 240, 0)");
  haze.addColorStop(0.5, "rgba(76, 201, 240, 0.08)");
  haze.addColorStop(1, "rgba(255, 209, 102, 0.08)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 100, state.width, state.height);

  drawMountains(horizon);
}

function drawMountains(horizon) {
  ctx.save();
  ctx.fillStyle = "rgba(3, 9, 18, 0.42)";
  ctx.beginPath();
  ctx.moveTo(0, state.height);
  for (let x = 0; x <= state.width + 80; x += 80) {
    const y = horizon + Math.sin(x * 0.012) * 24;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(state.width, state.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(3, 8, 16, 0.74)";
  ctx.beginPath();
  ctx.moveTo(0, state.height);
  for (let x = 0; x <= state.width + 70; x += 70) {
    const y = horizon + 50 + Math.cos(x * 0.011) * 20;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(state.width, state.height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate((player.tilt * Math.PI) / 180);

  const beam = ctx.createRadialGradient(0, 0, 2, 0, 12, player.width * 0.72);
  beam.addColorStop(0, "rgba(76, 201, 240, 0.5)");
  beam.addColorStop(1, "rgba(76, 201, 240, 0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.ellipse(0, 20, player.width * 0.75, player.height * 1.8, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-player.width / 2, 0, player.width / 2, 0);
  body.addColorStop(0, "#4cc9f0");
  body.addColorStop(0.5, "#f7fafc");
  body.addColorStop(1, "#ffd166");
  ctx.fillStyle = body;
  roundedRect(-player.width / 2, -player.height / 2, player.width, player.height, 12);
  ctx.fill();

  ctx.fillStyle = "rgba(7, 17, 31, 0.72)";
  roundedRect(-player.width * 0.18, -player.height * 0.28, player.width * 0.36, player.height * 0.48, 6);
  ctx.fill();

  ctx.fillStyle = "#ff4d6d";
  ctx.beginPath();
  ctx.moveTo(-player.width / 2 - 10, 0);
  ctx.lineTo(-player.width / 2 + 6, -player.height / 2 + 2);
  ctx.lineTo(-player.width / 2 + 6, player.height / 2 - 2);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(player.width / 2 + 10, 0);
  ctx.lineTo(player.width / 2 - 6, -player.height / 2 + 2);
  ctx.lineTo(player.width / 2 - 6, player.height / 2 - 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawStar(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle);
  ctx.shadowColor = "rgba(255, 209, 102, 0.85)";
  ctx.shadowBlur = 18 * item.glow;
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? item.size * 0.48 : item.size * 0.2;
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.beginPath();
  ctx.arc(-item.size * 0.1, -item.size * 0.12, item.size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeteor(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle);
  ctx.shadowColor = "rgba(255, 77, 109, 0.75)";
  ctx.shadowBlur = 18;

  const tail = ctx.createLinearGradient(-item.size * 1.4, 0, item.size * 0.3, 0);
  tail.addColorStop(0, "rgba(255, 77, 109, 0)");
  tail.addColorStop(1, "rgba(255, 209, 102, 0.45)");
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.ellipse(-item.size * 0.65, 0, item.size, item.size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();

  const rock = ctx.createRadialGradient(-item.size * 0.18, -item.size * 0.24, 2, 0, 0, item.size * 0.55);
  rock.addColorStop(0, "#ffb703");
  rock.addColorStop(0.42, "#ff4d6d");
  rock.addColorStop(1, "#66101f");
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.arc(0, 0, item.size * 0.48, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
  ctx.beginPath();
  ctx.arc(-item.size * 0.12, -item.size * 0.14, item.size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRipples() {
  for (const ripple of state.ripples) {
    const alpha = Math.max(0, ripple.life / 0.42);
    ctx.strokeStyle = `${ripple.color} ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPaused() {
  if (!state.paused) return;
  ctx.save();
  ctx.fillStyle = "rgba(5, 10, 19, 0.34)";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = "#f7fafc";
  ctx.font = "800 42px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("暂停", state.width / 2, state.height / 2);
  ctx.restore();
}

function draw() {
  drawBackground();
  for (const item of state.objects) {
    if (item.hit) continue;
    if (item.kind === "meteor") {
      drawMeteor(item);
    } else {
      drawStar(item);
    }
  }
  drawRipples();
  drawPlayer();
  drawPaused();
}

function loop(now) {
  const delta = Math.min((now - state.lastTime) / 1000, 0.033);
  state.lastTime = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function setHeld(button, key) {
  button.addEventListener("pointerdown", (event) => {
    state.keys.add(key);
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener("pointerup", () => state.keys.delete(key));
  button.addEventListener("pointerleave", () => state.keys.delete(key));
  button.addEventListener("pointercancel", () => state.keys.delete(key));
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (!state.running) startGame();
    else togglePause();
    return;
  }
  state.keys.add(event.code);
});
window.addEventListener("keyup", (event) => state.keys.delete(event.code));

canvas.addEventListener("pointermove", (event) => {
  if (!state.running || state.paused) return;
  const rect = canvas.getBoundingClientRect();
  player.x = clamp(event.clientX - rect.left, player.width / 2 + 10, state.width - player.width / 2 - 10);
});

startButton.addEventListener("click", startGame);
againButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", togglePause);
setHeld(leftButton, "ArrowLeft");
setHeld(rightButton, "ArrowRight");

resizeCanvas();
resetGame();
updateHud();
requestAnimationFrame(loop);
