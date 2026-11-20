// hud.js — everything drawn over the world: the HUD (cash, health, wanted stars, the clock,
// speed), the live minimap with its blips, the objective header, dialogue boxes and mission
// banners, and the full-screen menus — title, pause, BUSTED and WASTED. Buttons the menus
// show are registered on game.buttons each frame so main.js can answer clicks.

import { WORLD_W, WORLD_H, MAINLAND, ISLAND, ROADS_X, ROADS_Y, ISLAND_ROADS_X, ISLAND_ROADS_Y } from './config.js';
import { starsOf } from './police.js';

function panel(ctx, x, y, w, h, color = 'rgba(16,14,20,0.62)') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function star(ctx, cx, cy, r, filled, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.6; ctx.stroke(); }
}

function bar(ctx, x, y, w, h, ratio, color, back = 'rgba(255,255,255,0.16)') {
  ctx.fillStyle = back;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * Math.min(1, ratio)), h, h / 2); ctx.fill();
  }
}

function drawMinimap(ctx, game) {
  const W = 218, H = 152, X = 16, Y = game.camera.h - H - 16;
  const sx = W / WORLD_W, sy = H / WORLD_H;
  const px = (wx) => X + wx * sx, py = (wy) => Y + wy * sy;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(X, Y, W, H, 10); ctx.clip();
  ctx.fillStyle = '#175d7a'; ctx.fillRect(X, Y, W, H);
  ctx.fillStyle = '#79a85b';
  ctx.fillRect(px(MAINLAND.x), py(MAINLAND.y), MAINLAND.w * sx, MAINLAND.h * sy);
  ctx.fillRect(px(ISLAND.x), py(ISLAND.y), ISLAND.w * sx, ISLAND.h * sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 1.3;
  for (const vx of ROADS_X) { ctx.beginPath(); ctx.moveTo(px(vx), py(0)); ctx.lineTo(px(vx), py(MAINLAND.h)); ctx.stroke(); }
  for (const hy of ROADS_Y) { ctx.beginPath(); ctx.moveTo(px(0), py(hy)); ctx.lineTo(px(MAINLAND.w), py(hy)); ctx.stroke(); }
  for (const vx of ISLAND_ROADS_X) { ctx.beginPath(); ctx.moveTo(px(vx), py(ISLAND.y)); ctx.lineTo(px(vx), py(ISLAND.y + ISLAND.h)); ctx.stroke(); }
  for (const hy of ISLAND_ROADS_Y) { ctx.beginPath(); ctx.moveTo(px(ISLAND.x), py(hy)); ctx.lineTo(px(ISLAND.x + ISLAND.w), py(hy)); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(px(MAINLAND.w), py(1860)); ctx.lineTo(px(ISLAND.x), py(1860)); ctx.stroke();
  // Police blips, flashing like the real thing.
  if (Math.sin(game.time * 6) > -0.3) {
    ctx.fillStyle = '#ff5252';
    for (const car of game.cars) {
      if (car.driver === 'police' && !car.dead) { ctx.beginPath(); ctx.arc(px(car.x), py(car.y), 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // The objective.
  const m = game.missions.marker;
  if (m) {
    const pulse = 2.6 + Math.sin(game.time * 5) * 0.9;
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(px(m.x), py(m.y), pulse + 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2733';
    ctx.beginPath(); ctx.arc(px(m.x), py(m.y), 1.8, 0, Math.PI * 2); ctx.fill();
  }
  // The player: a white arrow on the facing.
  const p = game.playerPos();
  const ang = game.player.state === 'car' ? game.player.car.angle : game.player.angle;
  ctx.save();
  ctx.translate(px(p.x), py(p.y));
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4.4, -3.8); ctx.lineTo(-4.4, 3.8); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(X, Y, W, H, 10); ctx.stroke();
}

export function drawHUD(ctx, game) {
  const { w, h } = game.camera;
  const p = game.player;
  ctx.textBaseline = 'alphabetic';

  // Cash and health, top-left.
  panel(ctx, 16, 14, 218, p.state === 'car' ? 86 : 62);
  ctx.fillStyle = '#7be495';
  ctx.font = '800 25px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${Math.max(0, Math.round(game.cash)).toLocaleString('en-US')}`, 30, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 10.5px system-ui, sans-serif';
  ctx.fillText('HEALTH', 30, 66);
  bar(ctx, 84, 58, 132, 9, p.health / 100, p.health < 30 ? '#e2483d' : '#7be495');
  if (p.state === 'car') {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(p.car.type.name.toUpperCase(), 30, 88);
    bar(ctx, 84, 80, 132, 9, Math.max(0, p.car.health) / p.car.type.health, '#f2a03d');
  }

  // Stars and the clock, top-right.
  const stars = starsOf(game.wanted.heat);
  if (stars > 0 || game.wanted.bust > 0) {
    panel(ctx, w - 196, 14, 180, 56);
    for (let i = 0; i < 5; i++) {
      const filled = i < stars;
      star(ctx, w - 168 + i * 33, 42, 13, filled, game.wanted.seen ? '#ffd94d' : '#c9c9c9');
    }
    ctx.fillStyle = game.wanted.seen ? '#ff8a75' : 'rgba(255,255,255,0.7)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.wanted.seen ? 'PSPD IN PURSUIT' : 'OUT OF SIGHT — LIE LOW', w - 106, 64);
  }
  ctx.fillStyle = 'rgba(255,246,230,0.92)';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const mins = Math.floor(game.clock) % (24 * 60);
  const clock = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  ctx.fillText(clock, w - 18, stars > 0 ? 92 : 38);
  ctx.fillStyle = 'rgba(255,246,230,0.6)';
  ctx.font = '600 10.5px system-ui, sans-serif';
  ctx.fillText('PORT SOLANA', w - 18, stars > 0 ? 106 : 52);

  drawMinimap(ctx, game);

  // The objective, top-centre, with the job's name above the instruction.
  if (game.state === 'playing' && game.missions.objective) {
    ctx.font = '600 14.5px system-ui, sans-serif';
    const text = game.missions.objective;
    const tw = Math.min(560, ctx.measureText(text).width + 36);
    panel(ctx, (w - tw) / 2, 14, tw, 40, 'rgba(16,14,20,0.55)');
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, 40, tw - 24);
  }

  // Speed, bottom-right, when driving.
  if (p.state === 'car') {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), w - 52, h - 24);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('km/h', w - 18, h - 24);
  }

  // The bust meter, centre-bottom: the worst bar in the game to watch fill.
  if (game.wanted.bust > 0.02) {
    const bw = 300;
    panel(ctx, (w - bw - 28) / 2, h - 108, bw + 28, 44, 'rgba(60,10,14,0.66)');
    ctx.fillStyle = '#ffb3ab';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED', w / 2, h - 86);
    bar(ctx, (w - bw) / 2, h - 80, bw, 9, game.wanted.bust, '#e2483d');
  }

  // Dialogue: a name and a line, bottom-centre, while anyone is talking.
  const line = game.missions.dialogue[0];
  if (line && game.state === 'playing') {
    const bw = Math.min(640, w - 320);
    panel(ctx, (w - bw) / 2, h - 96, bw, 62, 'rgba(12,10,16,0.78)');
    ctx.fillStyle = line.who === 'Sol Duarte' ? '#ffd94d' : '#9fd8e8';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(line.who.toUpperCase(), (w - bw) / 2 + 16, h - 72);
    ctx.fillStyle = '#f5efe2';
    ctx.font = '400 14.5px system-ui, sans-serif';
    wrapText(ctx, line.text, (w - bw) / 2 + 16, h - 52, bw - 32, 19);
  }

  // Mission banners: big, brief, unmissable.
  const b = game.missions.banner;
  if (b) {
    const alpha = Math.min(1, b.t / 0.8, (4.2 - b.t) / 0.4 + 0.2);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = b.kind === 'fail' ? '#ff8a75' : b.kind === 'info' ? '#ffe9a8' : '#7be495';
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(b.title, w / 2, h * 0.3);
    ctx.fillStyle = 'rgba(255,250,240,0.92)';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(b.sub, w / 2, h * 0.3 + 34);
    ctx.restore();
  }

  // Context controls, bottom-centre-right, small and out of the way.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const hint = p.state === 'car'
    ? 'W A S D drive · SPACE handbrake · E exit · ESC pause'
    : 'W A S D walk · SHIFT run · E enter car · CLICK shoot · ESC pause';
  ctx.fillText(hint, w - 18, h - 8);
  if (game.audio.muted) ctx.fillText('SOUND OFF (M)', w - 18, h - 24);

  // Hurt: the edges close in red.
  if (p.health < 32 && game.state === 'playing') {
    const a = (0.32 - p.health / 100) * (0.75 + Math.sin(game.time * 5) * 0.25);
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(160,0,0,0)');
    grad.addColorStop(1, `rgba(160,10,10,${Math.max(0, a)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word; yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

// --- Menus -----------------------------------------------------------------------------

function button(ctx, game, x, y, w, h, label, action, primary = false) {
  ctx.fillStyle = primary ? '#e2483d' : 'rgba(255,255,255,0.12)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 9); ctx.stroke();
  ctx.fillStyle = '#fff7ea';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  game.buttons.push({ x, y, w, h, action });
}

function sunsetBackdrop(ctx, game) {
  const { w, h } = game.camera;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2b1055');
  grad.addColorStop(0.45, '#7597de');
  grad.addColorStop(0.72, '#ff9a5a');
  grad.addColorStop(1, '#ff5e62');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // The sun, low over the strait.
  const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.68, 8, w * 0.7, h * 0.68, 120);
  sunGrad.addColorStop(0, 'rgba(255,236,170,0.95)');
  sunGrad.addColorStop(0.25, 'rgba(255,190,90,0.55)');
  sunGrad.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, w, h);
  // A skyline silhouette and its palms.
  ctx.fillStyle = '#241028';
  const base = h * 0.86;
  const towers = [[0.04, 0.3], [0.1, 0.42], [0.17, 0.26], [0.23, 0.5], [0.31, 0.34], [0.38, 0.44], [0.46, 0.28], [0.53, 0.52], [0.61, 0.36], [0.68, 0.46], [0.76, 0.3], [0.83, 0.42], [0.9, 0.27], [0.96, 0.38]];
  for (const [fx, fh] of towers) ctx.fillRect(w * fx, base - h * fh * 0.55, w * 0.045, h * fh * 0.55);
  ctx.fillRect(0, base, w, h - base);
  ctx.strokeStyle = '#241028';
  ctx.lineWidth = 5;
  for (const fx of [0.14, 0.57, 0.88]) {
    const x = w * fx, y = base;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 44); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = -0.4 - i * 0.5;
      ctx.beginPath(); ctx.moveTo(x, y - 44);
      ctx.quadraticCurveTo(x + Math.cos(a) * 20, y - 44 + Math.sin(a) * 14 - 6, x + Math.cos(a) * 34, y - 44 + Math.sin(a) * 22 + 8);
      ctx.stroke();
    }
  }
}

export function drawMenus(ctx, game) {
  const { w, h } = game.camera;
  game.buttons = [];
  if (game.state === 'title') {
    sunsetBackdrop(ctx, game);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3d6';
    ctx.font = 'italic 700 21px Georgia, serif';
    ctx.fillText('P O R T   S O L A N A', w / 2, h * 0.2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.shadowColor = 'rgba(120,10,40,0.55)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillText('SOLANA HEAT', w / 2, h * 0.2 + 82);
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255,243,214,0.92)';
    ctx.font = '400 16.5px system-ui, sans-serif';
    ctx.fillText('An open-world crime story: steal the cars, run the jobs, outrun the PSPD.', w / 2, h * 0.2 + 116);
    const bw = 250, bx = w / 2 - bw / 2;
    button(ctx, game, bx, h * 0.52, bw, 50, 'NEW GAME', 'new', true);
    if (game.hasSaveFile) button(ctx, game, bx, h * 0.52 + 64, bw, 50, 'CONTINUE', 'continue');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('WASD / arrows — move & drive · E — enter / exit car · Mouse — aim · Click — shoot', w / 2, h * 0.52 + 148);
    ctx.fillText('T — taxi fare · Shift — run · Space — handbrake · M — mute · Esc — pause', w / 2, h * 0.52 + 170);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '400 12px system-ui, sans-serif';
    ctx.fillText('Five jobs for Sol Duarte stand between Rico and the big score. Progress saves in your browser.', w / 2, h - 22);
    return;
  }
  if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(10,8,16,0.66)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff7ea';
    ctx.font = '900 52px system-ui, sans-serif';
    ctx.fillText('PAUSED', w / 2, h * 0.34);
    const s = game.stats;
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,247,234,0.9)';
    ctx.fillText(`Cash $${Math.round(game.cash)} · Jobs done ${s.missionsDone} · Fares ${s.faresDone} · Cars stolen ${s.carsStolen}`, w / 2, h * 0.34 + 42);
    ctx.fillText(`Busted ${s.busts} · Wasted ${s.wasted} · Shots fired ${s.shotsFired} · ${(s.distanceDriven / 1000).toFixed(1)} km driven`, w / 2, h * 0.34 + 66);
    const bw = 240, bx = w / 2 - bw / 2;
    button(ctx, game, bx, h * 0.52, bw, 48, 'RESUME (ESC)', 'resume', true);
    button(ctx, game, bx, h * 0.52 + 60, bw, 48, game.audio.muted ? 'SOUND: OFF (M)' : 'SOUND: ON (M)', 'mute');
    button(ctx, game, bx, h * 0.52 + 120, bw, 48, 'QUIT TO TITLE', 'title');
    return;
  }
  if (game.state === 'busted' || game.state === 'wasted') {
    const busted = game.state === 'busted';
    ctx.fillStyle = busted ? 'rgba(8,14,40,0.72)' : 'rgba(46,6,8,0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = busted ? '#9fc2ff' : '#ff9a8a';
    ctx.font = '900 74px system-ui, sans-serif';
    ctx.fillText(busted ? 'BUSTED' : 'WASTED', w / 2, h * 0.42);
    ctx.fillStyle = 'rgba(255,250,240,0.94)';
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText(busted
      ? `The PSPD impound your ride and fine you $${game.lastFine}. You walk out of HQ with your pockets lighter.`
      : `You wake up at Clínica Solana. The bill is $${game.lastFine}, and someone has taken your car keys.`, w / 2, h * 0.42 + 42);
    const bw = 240;
    button(ctx, game, w / 2 - bw / 2, h * 0.56, bw, 48, 'CONTINUE (ENTER)', 'respawn', true);
  }
}
