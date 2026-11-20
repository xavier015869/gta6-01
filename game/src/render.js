// render.js — everything the eye gets: Port Solana drawn top-down at golden hour. The sea
// first, then sand, grass and pavement, the road grid with its markings, buildings wearing
// long sunset shadows and their names on their roofs, palms and fountains, and finally the
// living layer — cars with lit windows, people, tracers, smoke — under a warm wash and a
// vignette. Only what the camera can see is drawn; the city is big and the frame is small.

import { MAINLAND, ISLAND, BRIDGE, ROADS_X, ROADS_Y, ISLAND_ROADS_X, ISLAND_ROADS_Y, ROAD_W, COLORS } from './config.js';

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function inView(game, x, y, pad = 80) {
  const c = game.camera;
  return x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
}

// A deterministic sparkle hash for the water: the sea glitters without a random source.
function sparkle(x, y, t) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const f = s - Math.floor(s);
  return f > 0.86 && Math.sin(t * 1.7 + f * 40) > 0.2;
}

function drawSea(ctx, game) {
  const c = game.camera;
  rect(ctx, c.x, c.y, c.w, c.h, COLORS.water);
  // A slow darker swell band drifting south, and the glitter on top of it.
  ctx.fillStyle = COLORS.waterDeep;
  const band = ((game.time * 14) % 340);
  for (let y = c.y - 340 + band; y < c.y + c.h; y += 340) ctx.fillRect(c.x, y, c.w, 90);
  ctx.fillStyle = COLORS.waterSparkle;
  const step = 46;
  for (let x = Math.floor(c.x / step) * step; x < c.x + c.w + step; x += step) {
    for (let y = Math.floor(c.y / step) * step; y < c.y + c.h + step; y += step) {
      if (sparkle(x, y, game.time) && game.city.isWater(x + 12, y + 8)) ctx.fillRect(x + 8, y + 6, 15, 2.5);
    }
  }
}

function drawLand(ctx, game) {
  const city = game.city;
  // Sand first, lapping every shore; grass sits inside it.
  rect(ctx, MAINLAND.x, MAINLAND.y, MAINLAND.w, MAINLAND.h, COLORS.grass);
  rect(ctx, MAINLAND.x, MAINLAND.h - 120, MAINLAND.w, 120, COLORS.sand);
  rect(ctx, MAINLAND.w - 76, 0, 76, MAINLAND.h, COLORS.sand);
  rect(ctx, ISLAND.x, ISLAND.y, ISLAND.w, ISLAND.h, COLORS.sand);
  rect(ctx, ISLAND.x + 30, ISLAND.y + 30, ISLAND.w - 60, ISLAND.h - 60, COLORS.grass);
  // The city floor: pavement under every block, so sidewalks read as one fabric.
  rect(ctx, 0, 0, MAINLAND.w, MAINLAND.h - 108, COLORS.blockBase);
  rect(ctx, ISLAND.x + 24, ISLAND.y + 24, ISLAND.w - 48, ISLAND.h - 48, COLORS.blockBase);
  // Parks are green again, on top of the pavement.
  for (const park of city.parks) {
    if (!inView(game, park.x + park.w / 2, park.y + park.h / 2, Math.max(park.w, park.h))) continue;
    rect(ctx, park.x, park.y, park.w, park.h, COLORS.grassDark);
    rect(ctx, park.x + park.w / 2 - 9, park.y, 18, park.h, COLORS.parkPath);
    rect(ctx, park.x, park.y + park.h / 2 - 9, park.w, 18, COLORS.parkPath);
  }
  // Parking lots: tired asphalt and painted bays.
  for (const lot of city.lots) {
    if (!inView(game, lot.x + lot.w / 2, lot.y + lot.h / 2, Math.max(lot.w, lot.h))) continue;
    rect(ctx, lot.x, lot.y, lot.w, lot.h, '#8f8a7c');
    ctx.strokeStyle = 'rgba(245,245,240,0.5)';
    ctx.lineWidth = 2;
    for (const s of lot.spots) {
      ctx.strokeRect(s.x - 17, s.y - 24, 34, 48);
    }
  }
  // Harbour docks reaching into the water.
  for (const d of city.docks) {
    rect(ctx, d.x, d.y, d.w, d.h, COLORS.dock);
    rect(ctx, d.x, d.y, 6, d.h, '#6f5940');
    rect(ctx, d.x + d.w - 6, d.y, 6, d.h, '#6f5940');
  }
}

function drawRoads(ctx, game) {
  const half = ROAD_W / 2;
  ctx.fillStyle = COLORS.asphalt;
  const segs = [];
  for (const vx of ROADS_X) segs.push([vx - half, 0, ROAD_W, MAINLAND.h - 100]);
  for (const hy of ROADS_Y) segs.push([0, hy - half, MAINLAND.w, ROAD_W]);
  for (const vx of ISLAND_ROADS_X) segs.push([vx - half, ISLAND.y, ROAD_W, ISLAND.h]);
  for (const hy of ISLAND_ROADS_Y) segs.push([ISLAND.x, hy - half, ISLAND.w, ROAD_W]);
  for (const [x, y, w, h] of segs) {
    if (!inView(game, x + w / 2, y + h / 2, Math.max(w, h) / 2 + 60)) continue;
    ctx.fillRect(x, y, w, h);
  }
  // The bridge: a grey deck on pillars, railed, carrying the boulevard over the strait.
  rect(ctx, BRIDGE.x, BRIDGE.y - 8, BRIDGE.w, BRIDGE.h + 16, COLORS.bridgeRail);
  rect(ctx, BRIDGE.x, BRIDGE.y, BRIDGE.w, BRIDGE.h, COLORS.bridge);
  ctx.fillStyle = 'rgba(30,40,50,0.5)';
  for (let x = BRIDGE.x + 40; x < BRIDGE.x + BRIDGE.w; x += 90) ctx.fillRect(x, BRIDGE.y - 26, 14, BRIDGE.h + 52);
  // Centre dashes.
  ctx.fillStyle = COLORS.centreMark;
  for (const vx of ROADS_X) for (let y = 8; y < MAINLAND.h - 110; y += 44) if (inView(game, vx, y, 60)) ctx.fillRect(vx - 2, y, 4, 22);
  for (const hy of ROADS_Y) for (let x = 8; x < MAINLAND.w; x += 44) if (inView(game, x, hy, 60)) ctx.fillRect(x, hy - 2, 22, 4);
  for (let y = ISLAND.y + 8; y < ISLAND.y + ISLAND.h; y += 44) ctx.fillRect(ISLAND_ROADS_X[0] - 2, y, 4, 22);
  for (const hy of ISLAND_ROADS_Y) for (let x = ISLAND.x + 8; x < ISLAND.x + ISLAND.w; x += 44) ctx.fillRect(x, hy - 2, 22, 4);
  // Crosswalks at every junction in view: zebra stripes on all four approaches.
  ctx.fillStyle = COLORS.crosswalk;
  for (const n of game.city.nodes) {
    if (!inView(game, n.x, n.y, 130)) continue;
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(n.x + i * 17 - 6, n.y - half - 12, 12, 9);
      ctx.fillRect(n.x + i * 17 - 6, n.y + half + 3, 12, 9);
      ctx.fillRect(n.x - half - 12, n.y + i * 17 - 6, 9, 12);
      ctx.fillRect(n.x + half + 3, n.y + i * 17 - 6, 9, 12);
    }
  }
}

function drawDecor(ctx, game) {
  for (const d of game.city.decor) {
    if (!inView(game, d.x, d.y, 60)) continue;
    if (d.kind === 'palm' || d.kind === 'tree') {
      ctx.fillStyle = 'rgba(50,30,15,0.22)';
      ctx.beginPath(); ctx.ellipse(d.x + 12, d.y + 15, d.r, d.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      if (d.kind === 'palm') {
        circle(ctx, d.x, d.y, 3.5, COLORS.palmTrunk);
        ctx.strokeStyle = COLORS.palmLeaf;
        ctx.lineWidth = 3.4;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.5;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.quadraticCurveTo(d.x + Math.cos(a) * d.r * 0.7, d.y + Math.sin(a) * d.r * 0.7 - 4, d.x + Math.cos(a) * d.r, d.y + Math.sin(a) * d.r + 4);
          ctx.stroke();
        }
      } else {
        circle(ctx, d.x, d.y, d.r, COLORS.treeLeaf);
        circle(ctx, d.x - d.r * 0.3, d.y - d.r * 0.25, d.r * 0.62, COLORS.treeLeafDark);
      }
    } else if (d.kind === 'crate') {
      rect(ctx, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2, '#a9805a');
      ctx.strokeStyle = '#7d5f3d'; ctx.lineWidth = 2; ctx.strokeRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
    } else if (d.kind === 'fountain') {
      circle(ctx, d.x, d.y, d.r, '#9db3bd');
      circle(ctx, d.x, d.y, d.r * 0.78, '#57a8c4');
      circle(ctx, d.x, d.y, d.r * 0.3 + Math.sin(game.time * 2.4) * 2, '#bfe8f5');
    } else if (d.kind === 'bench') {
      rect(ctx, d.x - 10, d.y - 3, 20, 6, '#7d5f3d');
    } else if (d.kind === 'umbrella') {
      circle(ctx, d.x, d.y, d.r, '#e56399');
      circle(ctx, d.x, d.y, 2.5, '#8a6f4d');
    }
  }
}

function drawBuildings(ctx, game) {
  for (const b of game.city.buildings) {
    if (!inView(game, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) + 90)) continue;
    // The sunset throws every roof's shadow east and a little south, longer for taller towers.
    ctx.fillStyle = 'rgba(64,32,18,0.25)';
    ctx.fillRect(b.x + b.height * 0.55, b.y + b.height * 0.22, b.w, b.h);
    rect(ctx, b.x, b.y, b.w, b.h, b.wall);
    const inset = Math.min(9, b.w * 0.12, b.h * 0.12);
    rect(ctx, b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2, b.roof);
    // Roof furniture on the taller blocks: a stair bulkhead and an AC box.
    if (b.height > 26 && b.w > 90 && b.h > 70) {
      rect(ctx, b.x + b.w * 0.62, b.y + b.h * 0.16, 22, 16, 'rgba(0,0,0,0.18)');
      rect(ctx, b.x + b.w * 0.2, b.y + b.h * 0.6, 15, 12, 'rgba(0,0,0,0.15)');
    }
    // The door, on the south face, and the name above it when the roof is wide enough.
    rect(ctx, b.x + b.w / 2 - 7, b.y + b.h - 5, 14, 5, 'rgba(40,26,18,0.65)');
    if (b.name && b.w >= 96) {
      ctx.fillStyle = 'rgba(43,32,24,0.82)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2, b.w - 14);
    }
  }
}

export function drawCar(ctx, game, car) {
  const { type } = car;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Ground shadow, thrown east like the buildings'.
  ctx.fillStyle = 'rgba(40,20,12,0.3)';
  ctx.fillRect(-type.l / 2 + 7, -type.w / 2 + 5, type.l, type.w);
  ctx.rotate(car.angle);
  const L = type.l, W = type.w;
  // Body.
  ctx.fillStyle = car.dead ? '#3a3a3e' : car.color;
  ctx.strokeStyle = 'rgba(20,16,12,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 9);
  ctx.fill(); ctx.stroke();
  if (car.typeKey === 'interceptor') {
    // PSPD livery: white doors under the black, and the light bar that gives it away.
    ctx.fillStyle = '#eef1f3';
    ctx.fillRect(-L * 0.16, -W / 2 + 2, L * 0.3, W - 4);
    const flash = Math.sin(game.time * 11) > 0;
    ctx.fillStyle = flash ? '#ff4747' : '#7a1f1f';
    ctx.fillRect(-7, -W / 2 + 4, 14, 8);
    ctx.fillStyle = flash ? '#3f6dff' : '#27407a';
    ctx.fillRect(-7, W / 2 - 12, 14, 8);
    ctx.fillStyle = 'rgba(238,241,243,0.9)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('PSPD', 0, 0);
  }
  if (car.typeKey === 'cab') {
    ctx.fillStyle = 'rgba(20,16,12,0.8)';
    ctx.fillRect(-L * 0.3, -W / 2 + 2, 7, W - 4);
    ctx.fillStyle = '#fff6d8';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 2, 0);
  }
  // Glass: windshield and rear window, catching the low sun.
  ctx.fillStyle = 'rgba(178,226,240,0.85)';
  ctx.fillRect(L * 0.16, -W / 2 + 5, L * 0.13, W - 10);
  ctx.fillStyle = 'rgba(120,170,190,0.8)';
  ctx.fillRect(-L * 0.3, -W / 2 + 5, L * 0.1, W - 10);
  // Cabin roof.
  ctx.fillStyle = car.dead ? '#2c2c30' : car.color;
  ctx.fillRect(-L * 0.18, -W / 2 + 4, L * 0.32, W - 8);
  // Lights: warm headlights forward, red tails behind.
  ctx.fillStyle = '#ffeeb0';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 7);
  ctx.fillRect(L / 2 - 3, W / 2 - 11, 3, 7);
  ctx.fillStyle = '#d23b3b';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 7);
  ctx.fillRect(-L / 2, W / 2 - 11, 3, 7);
  if (car.dead) {
    ctx.fillStyle = 'rgba(15,15,18,0.45)';
    ctx.beginPath(); ctx.roundRect(-L / 2, -W / 2, L, W, 9); ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, game, ped) {
  const t = game.time;
  if (ped.state === 'down' || ped.dead) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    circle(ctx, 15, 0, 5.4, ped.skin);
    ctx.restore();
    if (ped.dead) { circle(ctx, ped.x - 6, ped.y + 8, 6, 'rgba(150,30,30,0.5)'); }
    return;
  }
  // Shadow, legs scissoring with the stride, shirt, head.
  ctx.fillStyle = 'rgba(40,20,12,0.25)';
  ctx.beginPath(); ctx.ellipse(ped.x + 4, ped.y + 5, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  const stride = ped.state === 'walk' && ped.waitTime > 0 ? 0 : Math.sin(t * (ped.state === 'flee' ? 13 : 8) + ped.x * 0.1) * 5;
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 3.4;
  const fx = Math.cos(ped.angle), fy = Math.sin(ped.angle);
  const px = -fy, py = fx;
  ctx.beginPath();
  ctx.moveTo(ped.x, ped.y); ctx.lineTo(ped.x + fx * stride + px * 2.4, ped.y + fy * stride + py * 2.4);
  ctx.moveTo(ped.x, ped.y); ctx.lineTo(ped.x - fx * stride - px * 2.4, ped.y - fy * stride - py * 2.4);
  ctx.stroke();
  circle(ctx, ped.x, ped.y, 6.8, ped.shirt);
  circle(ctx, ped.x + fx * 2, ped.y + fy * 2, 4.6, ped.skin);
  if (ped.isFare) {
    const bob = Math.sin(t * 4) * 3;
    circle(ctx, ped.x, ped.y - 24 + bob, 9, '#f7b731');
    ctx.fillStyle = '#23180a';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', ped.x, ped.y - 23 + bob);
  }
}

function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.state === 'car') return; // the car draws itself
  ctx.fillStyle = 'rgba(40,20,12,0.3)';
  ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 6, 10, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  // Rico: teal jacket, dark jeans, pistol levelled at the mouse.
  const stride = Math.sin(game.time * 10) * (p.moving ? 5 : 0);
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 4;
  const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - fx * stride, p.y - fy * stride + 3);
  ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + fx * stride, p.y + fy * stride + 3);
  ctx.stroke();
  circle(ctx, p.x, p.y, 8.6, '#0e7c86');
  circle(ctx, p.x + fx * 3, p.y + fy * 3, 5.4, '#c68642');
  // The pistol: a dark line from the hands toward the aim, with a glint at the muzzle.
  const gx = p.x + Math.cos(p.aim) * 15, gy = p.y + Math.sin(p.aim) * 15;
  ctx.strokeStyle = '#191d21';
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.aim) * 6, p.y + Math.sin(p.aim) * 6); ctx.lineTo(gx, gy); ctx.stroke();
}

function drawMarker(ctx, game) {
  const m = game.missions && game.missions.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(game.time * 4.2) * 0.16;
  // A pillar of light the whole city can see, and a breathing ring at its foot.
  const grad = ctx.createLinearGradient(0, m.y - 300, 0, m.y);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, 'rgba(255,217,77,0.30)');
  ctx.fillStyle = m.color === '#ffd94d' ? grad : grad;
  ctx.fillRect(m.x - 13, m.y - 300, 26, 300);
  ctx.strokeStyle = m.color;
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(m.x, m.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(m.x, m.y, 17, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = m.color;
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(m.label, m.x, m.y - 44);
}

export function drawScene(ctx, game) {
  const c = game.camera;
  ctx.save();
  ctx.translate(-c.x, -c.y);
  drawSea(ctx, game);
  drawLand(ctx, game);
  drawRoads(ctx, game);
  drawDecor(ctx, game);
  drawBuildings(ctx, game);
  drawMarker(ctx, game);
  // The living layer, roughly south-to-north so nearer things overlap farther ones.
  const drawables = [];
  for (const car of game.cars) if (inView(game, car.x, car.y, 130)) drawables.push({ y: car.y, draw: () => drawCar(ctx, game, car) });
  for (const ped of game.peds) if (!ped.gone && inView(game, ped.x, ped.y, 60)) drawables.push({ y: ped.y, draw: () => drawPed(ctx, game, ped) });
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();
  if (game.player.state === 'foot') drawPlayer(ctx, game);
  // Tracers and particles ride on top of everything in the world.
  for (const t of game.tracers) {
    ctx.strokeStyle = `rgba(255,232,150,${(t.life / t.maxLife) * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x1, t.y1); ctx.lineTo(t.x2, t.y2); ctx.stroke();
  }
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    circle(ctx, p.x, p.y, p.size, p.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Golden hour itself: a warm wash from the west and a vignette to hold the frame.
  const wash = ctx.createLinearGradient(0, 0, c.w, c.h);
  wash.addColorStop(0, 'rgba(255,166,66,0.13)');
  wash.addColorStop(0.55, 'rgba(255,120,80,0.05)');
  wash.addColorStop(1, 'rgba(90,40,110,0.10)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, c.w, c.h);
  const vig = ctx.createRadialGradient(c.w / 2, c.h / 2, Math.min(c.w, c.h) * 0.42, c.w / 2, c.h / 2, Math.max(c.w, c.h) * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, COLORS.vignette);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, c.w, c.h);
}
