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
  lanes: [],
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
  makeLanes();
}

function makeStarfield() {
  const count = Math.round(clamp(state.width * state.height * 0.00013, 80, 180));
  state.stars = Array.from({ length: count }, () => ({
    x: random(0, state.width),
    y: random(0, state.height),
    size: random(0.5, 2.2),
    drift: random(18, 58),
    alpha: random(0.22, 0.9),
  }));
}

function makeLanes() {
  const laneCount = Math.round(clamp(state.width / 190, 4, 7));
  state.lanes = Array.from({ length: laneCount }, (_, index) => ({
    offset: index / laneCount,
    width: random(0.42, 0.9),
    speed: random(0.18, 0.42),
    alpha: random(0.15, 0.36),
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

  for (const lane of state.lanes) {
    lane.offset = (lane.offset + lane.speed * delta) % 1;
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
      color: item.kind === "meteor" ? "rgba(244, 63, 94," : "rgba(248, 214, 109,",
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
  sky.addColorStop(0, "#120916");
  sky.addColorStop(0.35, "#0b1718");
  sky.addColorStop(0.78, "#172114");
  sky.addColorStop(1, "#090c0d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, state.width, state.height);

  drawAurora();

  ctx.save();
  for (const star of state.stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = star.size > 1.6 ? "#f8d66d" : "#d8fff8";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const horizon = state.height * 0.75;
  drawFlightLanes(horizon);
  drawSkyline(horizon);
}

function drawAurora() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 3; i += 1) {
    const y = state.height * (0.18 + i * 0.13);
    const gradient = ctx.createLinearGradient(0, y - 60, state.width, y + 80);
    gradient.addColorStop(0, "rgba(49, 214, 199, 0)");
    gradient.addColorStop(0.34, i === 1 ? "rgba(125, 220, 145, 0.12)" : "rgba(49, 214, 199, 0.13)");
    gradient.addColorStop(0.66, i === 2 ? "rgba(244, 63, 94, 0.12)" : "rgba(248, 214, 109, 0.1)");
    gradient.addColorStop(1, "rgba(49, 214, 199, 0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 34 + i * 12;
    ctx.beginPath();
    ctx.moveTo(-40, y);
    for (let x = -40; x <= state.width + 40; x += 70) {
      ctx.lineTo(x, y + Math.sin(x * 0.01 + state.starTimer * (0.4 + i * 0.15)) * (26 + i * 10));
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlightLanes(horizon) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const vanishingX = state.width / 2;
  const vanishingY = horizon - state.height * 0.12;

  for (const lane of state.lanes) {
    const spread = state.width * (0.2 + lane.offset * 0.65);
    ctx.strokeStyle = `rgba(49, 214, 199, ${lane.alpha})`;
    ctx.lineWidth = lane.width;
    ctx.beginPath();
    ctx.moveTo(vanishingX - spread, state.height);
    ctx.lineTo(vanishingX, vanishingY);
    ctx.lineTo(vanishingX + spread, state.height);
    ctx.stroke();
  }

  for (let i = 0; i < 9; i += 1) {
    const t = ((i / 9 + state.starTimer * 0.18) % 1) ** 1.85;
    const y = vanishingY + (state.height - vanishingY) * t;
    const width = state.width * t * 0.84;
    ctx.strokeStyle = `rgba(248, 214, 109, ${0.26 - t * 0.16})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vanishingX - width / 2, y);
    ctx.lineTo(vanishingX + width / 2, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSkyline(horizon) {
  ctx.save();
  const haze = ctx.createLinearGradient(0, horizon - 80, 0, state.height);
  haze.addColorStop(0, "rgba(49, 214, 199, 0)");
  haze.addColorStop(0.44, "rgba(49, 214, 199, 0.08)");
  haze.addColorStop(1, "rgba(248, 214, 109, 0.09)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, horizon - 110, state.width, state.height);

  ctx.fillStyle = "rgba(4, 10, 9, 0.5)";
  ctx.beginPath();
  ctx.moveTo(0, state.height);
  for (let x = 0; x <= state.width + 80; x += 80) {
    const y = horizon + Math.sin(x * 0.012) * 22;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(state.width, state.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(5, 8, 9, 0.82)";
  for (let x = -12; x < state.width + 24; x += 28) {
    const buildingHeight = 18 + ((x * 17) % 46 + 46) % 46;
    const width = 13 + ((x * 11) % 18 + 18) % 18;
    ctx.fillRect(x, horizon + 72 - buildingHeight, width, state.height - horizon);

    if (x % 56 === 0) {
      ctx.fillStyle = "rgba(248, 214, 109, 0.45)";
      ctx.fillRect(x + width * 0.45, horizon + 76 - buildingHeight, 2, 6);
      ctx.fillStyle = "rgba(5, 8, 9, 0.82)";
    }
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate((player.tilt * Math.PI) / 180);

  const beam = ctx.createRadialGradient(0, 0, 2, 0, 12, player.width * 0.72);
  beam.addColorStop(0, "rgba(49, 214, 199, 0.55)");
  beam.addColorStop(0.44, "rgba(125, 220, 145, 0.2)");
  beam.addColorStop(1, "rgba(49, 214, 199, 0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.ellipse(0, 24, player.width * 0.72, player.height * 1.9, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createLinearGradient(-player.width / 2, 0, player.width / 2, 0);
  body.addColorStop(0, "#31d6c7");
  body.addColorStop(0.42, "#fffaf0");
  body.addColorStop(0.7, "#f8d66d");
  body.addColorStop(1, "#f43f5e");
  ctx.fillStyle = body;
  roundedRect(-player.width / 2, -player.height / 2, player.width, player.height, 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 250, 240, 0.62)";
  ctx.lineWidth = 1.5;
  roundedRect(-player.width / 2 + 3, -player.height / 2 + 3, player.width - 6, player.height - 6, 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(9, 12, 13, 0.78)";
  roundedRect(-player.width * 0.18, -player.height * 0.3, player.width * 0.36, player.height * 0.5, 5);
  ctx.fill();

  ctx.fillStyle = "#f43f5e";
  ctx.beginPath();
  ctx.moveTo(-player.width / 2 - 14, 2);
  ctx.lineTo(-player.width / 2 + 8, -player.height / 2 + 1);
  ctx.lineTo(-player.width / 2 + 8, player.height / 2 - 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#7ddc91";
  ctx.beginPath();
  ctx.moveTo(player.width / 2 + 14, 2);
  ctx.lineTo(player.width / 2 - 8, -player.height / 2 + 1);
  ctx.lineTo(player.width / 2 - 8, player.height / 2 - 1);
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
  ctx.shadowColor = "rgba(248, 214, 109, 0.9)";
  ctx.shadowBlur = 22 * item.glow;
  ctx.strokeStyle = "rgba(49, 214, 199, 0.42)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, item.size * 0.66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#f8d66d";
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? item.size * 0.48 : item.size * 0.2;
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 250, 240, 0.76)";
  ctx.beginPath();
  ctx.arc(-item.size * 0.1, -item.size * 0.12, item.size * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeteor(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle);
  ctx.shadowColor = "rgba(244, 63, 94, 0.82)";
  ctx.shadowBlur = 22;

  const tail = ctx.createLinearGradient(-item.size * 1.4, 0, item.size * 0.3, 0);
  tail.addColorStop(0, "rgba(244, 63, 94, 0)");
  tail.addColorStop(0.55, "rgba(49, 214, 199, 0.18)");
  tail.addColorStop(1, "rgba(248, 214, 109, 0.55)");
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.ellipse(-item.size * 0.65, 0, item.size, item.size * 0.23, 0, 0, Math.PI * 2);
  ctx.fill();

  const rock = ctx.createRadialGradient(-item.size * 0.18, -item.size * 0.24, 2, 0, 0, item.size * 0.55);
  rock.addColorStop(0, "#f8d66d");
  rock.addColorStop(0.36, "#f43f5e");
  rock.addColorStop(1, "#3b111f");
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
  ctx.fillStyle = "rgba(10, 15, 18, 0.42)";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.fillStyle = "#fffaf0";
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
