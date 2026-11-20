// hud.js — everything drawn over the world: the minimap, health, cash,
// wanted stars, mission text, dialogue, banners and the menus.
//
// The minimap is a true map of Port Solana — sea, sand, the road grid,
// the bridge — with the player as a white arrow, police as flashing
// blips and the current objective as a pulsing marker, so a chase reads
// at a glance. Menus are drawn here too, over the still-running world.

import { WORLD_W, WORLD_H, LAND_END, WATER_X, ISLAND, VIEW_W, VIEW_H } from './config.js';
import { starsOf } from './police.js';
import { STORY } from './missions.js';

const MAP = { x: 16, y: 16, w: 224, h: 140 };

export function drawHUD(G, ctx) {
  drawMinimap(G, ctx);
  drawVitals(G, ctx);
  drawCashAndStars(G, ctx);
  drawObjective(G, ctx);
  drawSpeedo(G, ctx);
  drawPrompts(G, ctx);
  drawDialogue(G, ctx);
  drawBanner(G, ctx);
  drawBustMeter(G, ctx);
}

function mapScale() {
  return Math.min(MAP.w / WORLD_W, MAP.h / WORLD_H);
}
function mapPoint(x, y) {
  const s = mapScale();
  const ox = MAP.x + (MAP.w - WORLD_W * s) / 2;
  const oy = MAP.y + (MAP.h - WORLD_H * s) / 2;
  return [ox + x * s, oy + y * s];
}

function drawMinimap(G, ctx) {
  ctx.save();
  // Frame.
  ctx.fillStyle = 'rgba(12,16,24,0.78)';
  roundRectPath(ctx, MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  roundRectPath(ctx, MAP.x, MAP.y, MAP.w, MAP.h, 7);
  ctx.clip();
  // Sea, land, island.
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
  ctx.fillStyle = '#8f9a7d';
  let [lx, ly] = mapPoint(0, 0);
  let [lx2, ly2] = mapPoint(LAND_END + 104, WORLD_H);
  ctx.fillRect(lx, ly, lx2 - lx, ly2 - ly);
  ctx.fillStyle = '#c9bd9f';
  const [bx] = mapPoint(LAND_END + 104, 0);
  const [wx] = mapPoint(WATER_X, 0);
  ctx.fillRect(bx, ly, wx - bx, ly2 - ly);
  let [ix, iy] = mapPoint(ISLAND.x, ISLAND.y);
  let [ix2, iy2] = mapPoint(ISLAND.x + ISLAND.w, ISLAND.y + ISLAND.h);
  ctx.fillStyle = '#a9bc8e';
  ctx.fillRect(ix, iy, ix2 - ix, iy2 - iy);
  // Roads.
  ctx.strokeStyle = 'rgba(240,238,230,0.55)';
  ctx.lineWidth = 1;
  const s = mapScale();
  for (let i = 0; i <= 7; i++) {
    const [rx] = mapPoint(i * 420 + 52, 0);
    ctx.beginPath(); ctx.moveTo(rx, MAP.y); ctx.lineTo(rx, MAP.y + MAP.h); ctx.stroke();
  }
  for (let j = 0; j <= 5; j++) {
    const [, ry] = mapPoint(0, j * 420 + 52);
    ctx.beginPath(); ctx.moveTo(MAP.x, ry); ctx.lineTo(mapPoint(LAND_END + 104, 0)[0], ry); ctx.stroke();
  }
  // The bridge.
  const [, bridgeY] = mapPoint(0, 892);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(mapPoint(LAND_END, 0)[0], bridgeY);
  ctx.lineTo(ix, bridgeY);
  ctx.stroke();

  // Objective marker.
  const target = G.currentTarget;
  if (target) {
    const [tx, ty] = mapPoint(target.x, target.y);
    const pulse = 3.4 + Math.sin(G.time * 5) * 1.1;
    ctx.fillStyle = target.kind === 'taxi' ? '#39c2ff' : target.kind === 'story' ? '#7be495' : '#ffd23f';
    ctx.beginPath();
    ctx.arc(tx, ty, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();
  }
  // Police blips flash blue and red.
  for (const cop of G.cops) {
    if (cop.dead) continue;
    const [cx, cy] = mapPoint(cop.x, cop.y);
    ctx.fillStyle = Math.sin(G.time * 10 + cop.id) > 0 ? '#3d7bff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow on foot, a white wedge in a car.
  const p = G.player;
  const [px, py] = mapPoint(p.x, p.y);
  const ang = p.inCar ? p.inCar.angle : p.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 10.5px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT SOLANA', MAP.x + 2, MAP.y + MAP.h + 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('N ↑', MAP.x + MAP.w, MAP.y + MAP.h + 16);
}

function drawVitals(G, ctx) {
  const x = MAP.x;
  const y = MAP.y + MAP.h + 26;
  const p = G.player;
  // Health bar.
  ctx.fillStyle = 'rgba(12,16,24,0.7)';
  roundRectPath(ctx, x - 3, y - 3, 170, 17, 5);
  ctx.fill();
  const frac = Math.max(0, p.health / 100);
  const grad = ctx.createLinearGradient(x, 0, x + 164, 0);
  grad.addColorStop(0, frac > 0.3 ? '#57c84c' : '#e2483d');
  grad.addColorStop(1, frac > 0.3 ? '#a5e07f' : '#ff8a5c');
  ctx.fillStyle = grad;
  if (frac > 0) {
    roundRectPath(ctx, x, y, 164 * frac, 11, 4);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', x + 2, y + 10);
  if (p.inCar) {
    const carFrac = Math.max(0, p.inCar.health / 100);
    ctx.fillStyle = 'rgba(12,16,24,0.7)';
    roundRectPath(ctx, x - 3, y + 17, 170, 14, 5);
    ctx.fill();
    ctx.fillStyle = '#7cc7ff';
    if (carFrac > 0) {
      roundRectPath(ctx, x, y + 19.5, 164 * carFrac, 8, 4);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '700 9.5px system-ui, sans-serif';
    ctx.fillText(p.inCar.type.label.toUpperCase(), x + 2, y + 27);
  }
}

function drawCashAndStars(G, ctx) {
  const p = G.player;
  ctx.textAlign = 'right';
  ctx.font = '800 27px system-ui, sans-serif';
  ctx.fillStyle = '#12240f';
  ctx.fillText(`$${Math.round(p.cash).toLocaleString('en-US')}`, VIEW_W - 21, 41);
  ctx.fillStyle = '#8be26a';
  ctx.fillText(`$${Math.round(p.cash).toLocaleString('en-US')}`, VIEW_W - 23, 39);

  // The clock, small under the cash.
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const hh = String(Math.floor(G.clock / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(G.clock % 60)).padStart(2, '0');
  ctx.fillText(`${hh}:${mm}  •  PORT SOLANA`, VIEW_W - 23, 62);

  // Wanted stars.
  const stars = starsOf(G);
  const pulse = G.time - G.wanted.lastCrimeT < 0.7 ? 1.18 : 1;
  for (let i = 0; i < 5; i++) {
    const cx = VIEW_W - 40 - (4 - i) * 34;
    const cy = 92;
    const filled = i < stars;
    drawStar(ctx, cx, cy, 13 * pulse, filled ? '#ffd23f' : 'rgba(255,255,255,0.25)', filled);
  }
  if (stars > 0 && G.wanted.seenNow) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = '#ff9d8a';
    ctx.fillText('PSPD IN PURSUIT', VIEW_W - 23, 122);
  } else if (stars > 0) {
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('LAY LOW…', VIEW_W - 23, 122);
  }
}

function drawStar(ctx, cx, cy, r, color, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,0,0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawObjective(G, ctx) {
  const m = G.mission.active;
  ctx.textAlign = 'center';
  if (m) {
    const stage = m.stages[m.stageIdx];
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(10,10,16,0.55)';
    const title = m.def.title.toUpperCase();
    const wTitle = ctx.measureText(title).width;
    roundRectPath(ctx, VIEW_W / 2 - wTitle / 2 - 14, 12, wTitle + 28, 46, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(title, VIEW_W / 2, 33);
    ctx.font = '600 13.5px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(stage.label, VIEW_W / 2, 52);
    if (m.timerLeft !== null && m.timerLeft !== undefined) {
      const left = Math.max(0, m.timerLeft);
      const txt = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillStyle = left < 20 ? '#ff6b57' : '#ffffff';
      ctx.fillText(txt, VIEW_W / 2, 80);
    }
    if (stage.hold) {
      const frac = Math.min(1, (G.mission.holdT || 0) / stage.hold);
      ctx.fillStyle = 'rgba(10,10,16,0.55)';
      roundRectPath(ctx, VIEW_W / 2 - 110, 66, 220, 13, 6);
      ctx.fill();
      ctx.fillStyle = '#ff9d3d';
      if (frac > 0) {
        roundRectPath(ctx, VIEW_W / 2 - 107, 68.5, 214 * frac, 8, 4);
        ctx.fill();
      }
    }
  } else if (!G.player.storyDone) {
    const def = STORY[G.player.missionIndex];
    if (def) {
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`Next job: "${def.title}" — see Sol at the garage (F)`, VIEW_W / 2, 30);
    }
  } else {
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Story complete — free roam. Press T in a car for taxi fares.', VIEW_W / 2, 30);
  }

  // Direction arrow to the objective at the screen edge.
  const target = G.currentTarget;
  if (target && G.mode === 'play') {
    const p = G.player;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 430) {
      const a = Math.atan2(dy, dx);
      const ex = VIEW_W / 2 + Math.cos(a) * 300;
      const ey = VIEW_H / 2 + Math.sin(a) * 210;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = target.kind === 'taxi' ? '#39c2ff' : '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = '700 11.5px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${Math.round(d / 10)}m`, ex, ey + 24);
    }
  }
}

function drawSpeedo(G, ctx) {
  const car = G.player.inCar;
  if (!car) return;
  const kmh = Math.round(Math.abs(car.speed) * 0.36);
  ctx.textAlign = 'right';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(kmh), VIEW_W - 24, VIEW_H - 44);
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`km/h  •  ${car.type.label}`, VIEW_W - 24, VIEW_H - 24);
}

function drawPrompts(G, ctx) {
  if (!G.prompt || G.dialogue) return;
  ctx.textAlign = 'center';
  ctx.font = '700 15.5px system-ui, sans-serif';
  const w = ctx.measureText(G.prompt).width;
  ctx.fillStyle = 'rgba(10,10,16,0.62)';
  roundRectPath(ctx, VIEW_W / 2 - w / 2 - 16, VIEW_H - 118, w + 32, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9a3';
  ctx.fillText(G.prompt, VIEW_W / 2, VIEW_H - 98);
}

function drawDialogue(G, ctx) {
  const d = G.dialogue;
  if (!d) return;
  const line = d.lines[d.idx];
  if (!line) return;
  const w = Math.min(780, VIEW_W - 80);
  const x = (VIEW_W - w) / 2;
  const y = VIEW_H - 108;
  ctx.fillStyle = 'rgba(8,10,18,0.82)';
  roundRectPath(ctx, x, y, w, 76, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,63,0.5)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = '800 12.5px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23f';
  ctx.fillText(line.who.toUpperCase(), x + 18, y + 22);
  ctx.font = '16.5px system-ui, sans-serif';
  ctx.fillStyle = '#f4f1e8';
  wrapText(ctx, line.text, x + 18, y + 45, w - 36, 20);
  if (Math.sin(G.time * 5) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('▼', x + w - 14, y + 66);
  }
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawBanner(G, ctx) {
  const b = G.banner;
  if (!b) return;
  const alpha = Math.min(1, b.t / 0.6);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(10,8,14,0.65)';
  const w = ctx.measureText(b.title).width;
  roundRectPath(ctx, VIEW_W / 2 - w / 2 - 30, 168, w + 60, 92, 12);
  ctx.fill();
  ctx.fillStyle = b.color;
  ctx.fillText(b.title, VIEW_W / 2, 216);
  ctx.font = '600 16.5px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(b.sub, VIEW_W / 2, 244);
  ctx.restore();
}

function drawBustMeter(G, ctx) {
  if (G.bustT < 0.04 || G.mode !== 'play') return;
  const w = 260;
  const x = VIEW_W / 2 - w / 2;
  const y = VIEW_H - 150;
  ctx.fillStyle = 'rgba(10,10,16,0.66)';
  roundRectPath(ctx, x - 10, y - 24, w + 20, 52, 9);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.fillStyle = '#ff8a7a';
  ctx.fillText('THE PSPD ARE ON YOU — MOVE!', VIEW_W / 2, y - 8);
  ctx.fillStyle = '#3a3f4a';
  roundRectPath(ctx, x, y, w, 11, 5);
  ctx.fill();
  ctx.fillStyle = '#e2483d';
  roundRectPath(ctx, x, y, w * Math.min(1, G.bustT), 11, 5);
  ctx.fill();
}

// ---- Menus -----------------------------------------------------------------

export function drawTitle(G, ctx, hasSave) {
  // A dusk wash over the panning city, then the masthead.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(24,8,26,0.55)');
  grad.addColorStop(0.55, 'rgba(24,8,26,0.25)');
  grad.addColorStop(1, 'rgba(24,8,26,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  const titleGrad = ctx.createLinearGradient(0, 120, 0, 230);
  titleGrad.addColorStop(0, '#ffe259');
  titleGrad.addColorStop(0.55, '#ffa751');
  titleGrad.addColorStop(1, '#ff5e8a');
  ctx.font = '900 104px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(20,6,16,0.55)';
  ctx.fillText('SOLANA HEAT', VIEW_W / 2 + 4, 224);
  ctx.fillStyle = titleGrad;
  ctx.fillText('SOLANA HEAT', VIEW_W / 2, 218);

  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('P O R T   S O L A N A', VIEW_W / 2, 262);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('An original open-world crime story. Rico Vega arrives with $11, a dead phone,', VIEW_W / 2, 300);
  ctx.fillText('and the best right foot in three counties. Sol Duarte has the work — if he has the nerve.', VIEW_W / 2, 322);

  // Controls card.
  const lines = [
    ['W A S D / Arrows', 'Move / drive'],
    ['E', 'Enter or leave a car'],
    ['Mouse + Click', 'Aim and shoot on foot'],
    ['F', 'Take a job at the garage'],
    ['T', 'Taxi fare (in a car)'],
    ['P / Esc', 'Pause'],
  ];
  const cardW = 470;
  const cardX = (VIEW_W - cardW) / 2;
  const cardY = 356;
  ctx.fillStyle = 'rgba(10,10,20,0.66)';
  roundRectPath(ctx, cardX, cardY, cardW, lines.length * 24 + 22, 12);
  ctx.fill();
  ctx.font = '600 14.5px system-ui, sans-serif';
  lines.forEach(([key, what], i) => {
    const y = cardY + 30 + i * 24;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(key, cardX + 178, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4f1e8';
    ctx.fillText(what, cardX + 196, y);
  });

  ctx.textAlign = 'center';
  if (Math.sin(G.time * 3.4) > -0.25) {
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(hasSave ? 'PRESS ENTER — CONTINUE   •   N — NEW GAME' : 'CLICK OR PRESS ENTER TO START', VIEW_W / 2, 566);
  }
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('Every person, place and car in Port Solana is invented. Any resemblance to a real city is the sunset talking.', VIEW_W / 2, 690);
}

export function drawPause(G, ctx) {
  ctx.fillStyle = 'rgba(10,6,16,0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '900 52px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9c9';
  ctx.fillText('PAUSED', VIEW_W / 2, 240);
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillStyle = '#f4f1e8';
  const items = [
    'ESC / P — back to the streets',
    'S — save game',
    'R — restart current mission',
    'Q — quit to title',
  ];
  items.forEach((text, i) => ctx.fillText(text, VIEW_W / 2, 300 + i * 32));
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`Cash $${Math.round(G.player.cash).toLocaleString('en-US')}  •  Missions done ${G.player.missionsDone}  •  Taxi fares ${G.player.fares}  •  Earned $${Math.round(G.player.totalEarned).toLocaleString('en-US')}`, VIEW_W / 2, 470);
}

export function drawEndScreen(G, ctx, kind) {
  if (kind === 'busted') {
    const flash = Math.sin(G.time * 9) > 0;
    ctx.fillStyle = flash ? 'rgba(40,60,180,0.30)' : 'rgba(180,30,30,0.30)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(8,6,14,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.fillStyle = '#f4f6f8';
    ctx.fillText('BUSTED', VIEW_W / 2, 330);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('The PSPD kept their grip. Bail costs $150, and Sol is pretending not to know you.', VIEW_W / 2, 380);
  } else {
    ctx.fillStyle = 'rgba(60,4,8,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.font = '900 92px system-ui, sans-serif';
    ctx.fillStyle = '#e2483d';
    ctx.fillText('WASTED', VIEW_W / 2, 330);
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillStyle = '#ffe9c9';
    ctx.fillText('Clínica Solana patches Rico up — for $150, billed to his tab.', VIEW_W / 2, 380);
  }
  if (Math.sin(G.time * 3.4) > -0.25) {
    ctx.font = '800 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS ENTER TO CARRY ON', VIEW_W / 2, 440);
  }
}
