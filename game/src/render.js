// render.js — how Port Solana looks.
//
// The whole static city (roads, sidewalks, beaches, buildings and their
// long sunset shadows) is painted once into a world-sized offscreen
// canvas. Each frame the sea is drawn fresh with a moving shimmer, the
// static layer is blitted over it, and then everything alive — palms
// swaying, traffic, police, people, gunfire — is drawn in view. A warm
// gradient grade and vignette finish the golden-hour look.

import {
  WORLD_W, WORLD_H, PITCH, ROAD_W, COLS, ROWS, LAND_END, WATER_X,
  BRIDGE_Y, ISLAND, VIEW_W, VIEW_H, PALETTE,
} from './config.js';
import { vRoadCenter, hRoadCenter, onIsland } from './city.js';

export function buildStaticLayer(city) {
  const cv = document.createElement('canvas');
  cv.width = WORLD_W;
  cv.height = WORLD_H;
  const c = cv.getContext('2d');

  // Beach and island base (the sea itself is painted every frame).
  const sandGrad = c.createLinearGradient(LAND_END, 0, WATER_X + 30, 0);
  sandGrad.addColorStop(0, '#e8d5a4');
  sandGrad.addColorStop(1, '#f4e3b2');
  c.fillStyle = sandGrad;
  c.fillRect(LAND_END, 0, WATER_X - LAND_END + 26, WORLD_H);
  // Island: sand rim, grassy middle.
  c.fillStyle = PALETTE.sand;
  roundRect(c, ISLAND.x - 14, ISLAND.y - 14, ISLAND.w + 28, ISLAND.h + 28, 46);
  c.fill();
  c.fillStyle = PALETTE.grass;
  roundRect(c, ISLAND.x + 16, ISLAND.y + 16, ISLAND.w - 32, ISLAND.h - 32, 30);
  c.fill();
  // Island plaza loop (asphalt ring the safehouse sits on).
  c.strokeStyle = PALETTE.asphalt;
  c.lineWidth = 40;
  roundRect(c, ISLAND.x + 52, ISLAND.y + 52, ISLAND.w - 104, ISLAND.h - 104, 22);
  c.stroke();

  drawBlocks(c, city);
  drawRoads(c);
  drawBridge(c);
  drawCrates(c, city);
  drawBuildings(c, city);
  return cv;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawBlocks(c, city) {
  for (const block of city.blocks) {
    const r = block.rect;
    // Sidewalk apron around every block.
    c.fillStyle = PALETTE.sidewalk;
    c.fillRect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);
    if (block.plan === 'P') {
      c.fillStyle = PALETTE.grass;
      c.fillRect(r.x, r.y, r.w, r.h);
      c.fillStyle = PALETTE.grassDark;
      c.fillRect(r.x + 20, r.y + 20, r.w - 40, 10);
      c.fillRect(r.x + 20, r.y + r.h - 30, r.w - 40, 10);
      // Winding path.
      c.strokeStyle = '#d9c9a3';
      c.lineWidth = 13;
      c.beginPath();
      c.moveTo(r.x, r.y + r.h * 0.6);
      c.bezierCurveTo(r.x + r.w * 0.3, r.y + r.h * 0.2, r.x + r.w * 0.6, r.y + r.h * 0.9, r.x + r.w, r.y + r.h * 0.4);
      c.stroke();
    } else if (block.plan === 'L') {
      c.fillStyle = '#55505c';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 2;
      for (let k = 0; k < 8; k++) {
        const sx = r.x + 34 + (k % 4) * 74;
        const sy = r.y + 40 + Math.floor(k / 4) * 150;
        c.strokeRect(sx - 24, sy - 40, 48, 80);
      }
    } else {
      // Plaza paving with a faint tile grid.
      c.fillStyle = '#ddd2ba';
      c.fillRect(r.x, r.y, r.w, r.h);
      c.strokeStyle = 'rgba(120,100,70,0.10)';
      c.lineWidth = 1;
      for (let gx = r.x + 26; gx < r.x + r.w; gx += 26) {
        c.beginPath(); c.moveTo(gx, r.y); c.lineTo(gx, r.y + r.h); c.stroke();
      }
      for (let gy = r.y + 26; gy < r.y + r.h; gy += 26) {
        c.beginPath(); c.moveTo(r.x, gy); c.lineTo(r.x + r.w, gy); c.stroke();
      }
    }
  }
}

function drawRoads(c) {
  c.fillStyle = PALETTE.asphalt;
  for (let i = 0; i <= COLS; i++) c.fillRect(i * PITCH, 0, ROAD_W, WORLD_H);
  for (let j = 0; j <= ROWS; j++) c.fillRect(0, j * PITCH, LAND_END + ROAD_W, ROAD_W);

  // Centre dashes.
  c.strokeStyle = 'rgba(232,212,77,0.75)';
  c.lineWidth = 4;
  c.setLineDash([26, 22]);
  for (let i = 0; i <= COLS; i++) {
    c.beginPath(); c.moveTo(vRoadCenter(i), 0); c.lineTo(vRoadCenter(i), WORLD_H); c.stroke();
  }
  for (let j = 0; j <= ROWS; j++) {
    c.beginPath(); c.moveTo(0, hRoadCenter(j)); c.lineTo(LAND_END + ROAD_W, hRoadCenter(j)); c.stroke();
  }
  c.setLineDash([]);

  // Crosswalks at every intersection.
  c.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i <= COLS; i++) {
    for (let j = 0; j <= ROWS; j++) {
      const cx = i * PITCH;
      const cy = j * PITCH;
      for (let s = 0; s < 5; s++) {
        c.fillRect(cx + 8 + s * 19, cy - 12, 10, 10); // north
        c.fillRect(cx + 8 + s * 19, cy + ROAD_W + 2, 10, 10); // south
        c.fillRect(cx - 12, cy + 8 + s * 19, 10, 10); // west
        c.fillRect(cx + ROAD_W + 2, cy + 8 + s * 19, 10, 10); // east
      }
    }
  }
}

function drawBridge(c) {
  // Support pillars standing in the sea.
  c.fillStyle = '#4a4238';
  for (let x = LAND_END + 90; x < ISLAND.x; x += 130) {
    c.fillRect(x, BRIDGE_Y + 12, 20, ROAD_W - 24);
  }
  // The deck, its rails and its centre line.
  c.fillStyle = '#46424e';
  c.fillRect(LAND_END, BRIDGE_Y, ISLAND.x - LAND_END + 10, ROAD_W);
  c.fillStyle = '#d8d2c2';
  c.fillRect(LAND_END, BRIDGE_Y, ISLAND.x - LAND_END + 10, 6);
  c.fillRect(LAND_END, BRIDGE_Y + ROAD_W - 6, ISLAND.x - LAND_END + 10, 6);
  c.strokeStyle = 'rgba(232,212,77,0.75)';
  c.lineWidth = 4;
  c.setLineDash([26, 22]);
  c.beginPath();
  c.moveTo(LAND_END, BRIDGE_Y + ROAD_W / 2);
  c.lineTo(ISLAND.x + 10, BRIDGE_Y + ROAD_W / 2);
  c.stroke();
  c.setLineDash([]);
}

function drawCrates(c, city) {
  for (const crate of city.crates) {
    c.fillStyle = 'rgba(46,16,32,0.25)';
    c.fillRect(crate.x + 4, crate.y + 5, crate.s, crate.s);
    c.fillStyle = ['#b5651d', '#7a8b99', '#96705a'][Math.floor(crate.s) % 3];
    c.fillRect(crate.x, crate.y, crate.s, crate.s);
    c.strokeStyle = 'rgba(0,0,0,0.3)';
    c.lineWidth = 2;
    c.strokeRect(crate.x + 2, crate.y + 2, crate.s - 4, crate.s - 4);
  }
}

function drawBuildings(c, city) {
  for (const b of city.buildings) {
    // Long sunset shadows stretch east and south with the building's height.
    const sh = 10 + b.floors * 3.2;
    c.fillStyle = PALETTE.shadow;
    c.fillRect(b.x + sh, b.y + sh * 0.8, b.w, b.h);

    // Walls peeking out at the south and east edges give a hint of height.
    c.fillStyle = shade(b.color, -28);
    c.fillRect(b.x + 4, b.y + b.h - 2, b.w, 6 + b.floors * 0.7);
    // Roof.
    c.fillStyle = b.color;
    c.fillRect(b.x, b.y, b.w, b.h);
    c.strokeStyle = PALETTE.roofTrim;
    c.lineWidth = 3;
    c.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);

    // Rooftop clutter, placed by the building's own seed.
    const rngSeed = Math.floor(b.seed * 10000);
    c.fillStyle = 'rgba(70,50,40,0.35)';
    const acW = 16 + (rngSeed % 14);
    if (b.w > 90 && b.h > 90) {
      c.fillRect(b.x + 14 + (rngSeed % 30), b.y + 14, acW, acW * 0.7);
      c.fillRect(b.x + b.w - 30 - (rngSeed % 20), b.y + b.h - 30, acW * 0.8, acW * 0.6);
      c.fillStyle = 'rgba(255,255,255,0.20)';
      c.fillRect(b.x + b.w * 0.4, b.y + b.h * 0.4, 22, 14); // skylight
    }
    if (b.kind === 'shop') {
      // A coloured awning stripe along the storefront.
      c.fillStyle = ['#c0392b', '#2471a3', '#229954', '#b7950b'][rngSeed % 4];
      c.fillRect(b.x, b.y + b.h - 13, b.w, 9);
    }
    if (b.kind === 'garage') {
      c.fillStyle = '#3d3a42';
      c.fillRect(b.x + 16, b.y + b.h - 34, 52, 30);
      c.fillRect(b.x + 82, b.y + b.h - 34, 52, 30);
    }

    // Names are painted on the roofs of the places that matter.
    if (b.name && b.w >= 96) {
      c.fillStyle = 'rgba(43,28,20,0.62)';
      c.font = `700 ${b.kind === 'shop' ? 14 : 16}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const label = b.name.length > 22 ? b.name.slice(0, 22) : b.name;
      c.fillText(label.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2, b.w - 14);
    }
  }
}

// Lighten (positive) or darken (negative) a #rrggbb colour.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// ---- Per-frame scene ------------------------------------------------------

export function drawScene(G, ctx) {
  const cam = G.camera;
  const shakeX = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shakeY = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;

  drawSea(G, ctx);
  ctx.save();
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));
  ctx.drawImage(G.staticLayer, 0, 0);

  drawMarker(G, ctx);
  for (const palm of G.city.palms) if (inView(G, palm.x, palm.y, 90)) drawPalm(G, ctx, palm);
  for (const tree of G.city.trees) if (inView(G, tree.x, tree.y, 90)) drawTree(G, ctx, tree);
  for (const car of G.cars) if (inView(G, car.x, car.y, 90)) drawCar(G, ctx, car);
  for (const ped of G.peds) if (inView(G, ped.x, ped.y, 60)) drawPed(G, ctx, ped);
  if (!G.player.inCar) drawPlayer(G, ctx);
  drawFx(G, ctx);

  ctx.restore();
  drawGrade(G, ctx);
}

function inView(G, x, y, pad) {
  const cam = G.camera;
  return x > cam.x - pad && x < cam.x + VIEW_W + pad && y > cam.y - pad && y < cam.y + VIEW_H + pad;
}

// The sea: a gradient with slow light bands sliding across it, foam
// licking the shoreline and around Solana Key.
function drawSea(G, ctx) {
  const cam = G.camera;
  const grad = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
  grad.addColorStop(0, '#2a86a8');
  grad.addColorStop(1, PALETTE.waterDeep);
  ctx.fillStyle = grad;
  // Only the visible sea needs painting; land is covered by the static layer.
  const sx = Math.max(0, WATER_X - cam.x);
  if (sx < VIEW_W) ctx.fillRect(sx, 0, VIEW_W - sx, VIEW_H);
  ctx.fillStyle = '#2a86a8';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H); // under everything: cheap insurance at map edges
  if (sx < VIEW_W) {
    ctx.fillStyle = grad;
    ctx.fillRect(sx, 0, VIEW_W - sx, VIEW_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 3;
    const t = G.time * 0.7;
    for (let k = 0; k < 7; k++) {
      const yy = ((k * 173 + t * 26) % (VIEW_H + 120)) - 60;
      ctx.beginPath();
      for (let xx = sx; xx <= VIEW_W; xx += 46) {
        const yo = yy + Math.sin((xx + k * 90 + t * 60) * 0.02) * 7;
        if (xx === sx) ctx.moveTo(xx, yo);
        else ctx.lineTo(xx, yo);
      }
      ctx.stroke();
    }
    // Foam at the shoreline.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let yy = -cam.y; yy < VIEW_H; yy += 8) {
      const wx = WATER_X - cam.x + Math.sin(yy * 0.05 + t * 2) * 4;
      if (yy === -cam.y) ctx.moveTo(wx, yy);
      else ctx.lineTo(wx, yy);
    }
    ctx.stroke();
  }
}

function drawMarker(G, ctx) {
  const target = G.currentTarget;
  if (!target || G.mode !== 'play') return;
  const color = target.kind === 'taxi' ? '#39c2ff' : target.kind === 'story' ? '#7be495' : '#ffd23f';
  const pulse = 1 + Math.sin(G.time * 4) * 0.12;
  const { x, y } = target;
  // Beam of light.
  const grad = ctx.createLinearGradient(0, y - 190, 0, y);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x - 13, y - 190, 26, 190);
  ctx.globalAlpha = 1;
  // Ring and chevron.
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, 30 * pulse, 15 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  const bob = Math.sin(G.time * 4) * 5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 52 + bob);
  ctx.lineTo(x - 11, y - 68 + bob);
  ctx.lineTo(x + 11, y - 68 + bob);
  ctx.closePath();
  ctx.fill();
}

function drawPalm(G, ctx, palm) {
  const sway = Math.sin(G.time * 1.3 + palm.x * 0.05) * 0.05;
  ctx.save();
  ctx.translate(palm.x, palm.y);
  ctx.scale(palm.s, palm.s);
  ctx.fillStyle = 'rgba(46,16,32,0.25)';
  ctx.beginPath();
  ctx.ellipse(7, 8, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6b45';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(3, -8, 6, -14);
  ctx.stroke();
  ctx.strokeStyle = '#3e9b4f';
  ctx.lineWidth = 3.4;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + sway;
    ctx.beginPath();
    ctx.moveTo(6, -14);
    ctx.quadraticCurveTo(6 + Math.cos(a) * 13, -14 + Math.sin(a) * 8 - 3, 6 + Math.cos(a) * 21, -14 + Math.sin(a) * 13 + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(G, ctx, tree) {
  ctx.save();
  ctx.translate(tree.x, tree.y);
  ctx.scale(tree.s, tree.s);
  ctx.fillStyle = 'rgba(46,16,32,0.22)';
  ctx.beginPath();
  ctx.ellipse(6, 7, 17, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4c9440';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.arc(-9, 5, 11, 0, Math.PI * 2);
  ctx.arc(10, 4, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#63b657';
  ctx.beginPath();
  ctx.arc(-3, -4, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCar(G, ctx, car) {
  const t = car.type;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Ground shadow, stretched by the sunset.
  ctx.fillStyle = 'rgba(46,16,32,0.30)';
  ctx.beginPath();
  ctx.ellipse(6, 7, t.w / 2 + 2, t.h / 2 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);

  // Body.
  ctx.fillStyle = car.dead ? shade(car.color, -46) : car.color;
  roundRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,16,24,0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Cabin: windshield, roof, rear window.
  ctx.fillStyle = 'rgba(24,32,44,0.85)';
  roundRect(ctx, t.w * 0.06, -t.h * 0.36, t.w * 0.16, t.h * 0.72, 3);
  ctx.fill();
  ctx.fillStyle = shade(car.color, 22);
  roundRect(ctx, -t.w * 0.16, -t.h * 0.34, t.w * 0.2, t.h * 0.68, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(24,32,44,0.7)';
  roundRect(ctx, -t.w * 0.30, -t.h * 0.32, t.w * 0.1, t.h * 0.64, 3);
  ctx.fill();
  // Wheels (front pair turns with the steering).
  ctx.fillStyle = '#17131a';
  const wy = t.h / 2 - 1;
  ctx.fillRect(t.w * 0.22, -wy - 2, 10, 4.6);
  ctx.fillRect(t.w * 0.22, wy - 2.6, 10, 4.6);
  ctx.fillRect(-t.w * 0.38, -wy - 2, 10, 4.6);
  ctx.fillRect(-t.w * 0.38, wy - 2.6, 10, 4.6);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(t.w / 2 - 3, -t.h * 0.32, 3.4, 4.6);
  ctx.fillRect(t.w / 2 - 3, t.h * 0.32 - 4.6, 3.4, 4.6);
  ctx.fillStyle = '#d43a2e';
  ctx.fillRect(-t.w / 2 - 0.6, -t.h * 0.32, 3, 4.6);
  ctx.fillRect(-t.w / 2 - 0.6, t.h * 0.32 - 4.6, 3, 4.6);

  if (car.typeKey === 'taxi') {
    ctx.fillStyle = '#22242a';
    roundRect(ctx, -6, -5, 12, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = '700 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0.5);
  }
  if (car.typeKey === 'cop') {
    // PSPD livery: black doors and a flashing light bar.
    ctx.fillStyle = '#20242c';
    roundRect(ctx, -t.w * 0.14, -t.h * 0.36, t.w * 0.22, t.h * 0.72, 3);
    ctx.fill();
    const phase = Math.sin(G.time * 11 + (car.ai?.sirenPhase || 0));
    ctx.fillStyle = phase > 0 ? '#ff3b30' : '#7a130d';
    roundRect(ctx, -7, -t.h * 0.34, 13, 6.4, 2);
    ctx.fill();
    ctx.fillStyle = phase > 0 ? '#274bdb' : '#3d7bff';
    roundRect(ctx, -7, t.h * 0.34 - 6.4, 13, 6.4, 2);
    ctx.fill();
    // Light spill on the road when the siren runs.
    if (!car.dead) {
      ctx.globalAlpha = 0.10 + 0.05 * Math.abs(phase);
      ctx.fillStyle = phase > 0 ? '#ff3b30' : '#3d7bff';
      ctx.beginPath();
      ctx.ellipse(0, 0, t.w * 1.15, t.h * 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // A wrecked car smoulders: three puffs rising on a loop.
  if (car.dead) {
    for (let k = 0; k < 3; k++) {
      const ph = ((G.time * 0.55 + car.id * 0.37 + k / 3) % 1);
      ctx.fillStyle = `rgba(52,48,54,${0.34 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(car.x + 4 - ph * 6, car.y - 6 - ph * 30, 5 + ph * 11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPed(G, ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.dead) {
    // Down and still: a crumpled shape, fading with time.
    ctx.globalAlpha = Math.max(0, 1 - ped.fadeT / 24);
    ctx.rotate(ped.angle + 1.2);
    ctx.fillStyle = 'rgba(46,16,32,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    roundRect(ctx, -10, -4.6, 17, 9.2, 4);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(10.5, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(46,16,32,0.25)';
  ctx.beginPath();
  ctx.ellipse(2.5, 3.5, 8, 4.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs scissor as they walk.
  const stride = Math.sin(ped.walkPhase) * 5;
  ctx.strokeStyle = '#33303a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-stride * 0.6, stride);
  ctx.moveTo(0, 0);
  ctx.lineTo(-stride * 0.6, -stride);
  ctx.stroke();
  // Body and head, turned toward travel.
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  roundRect(ctx, -6.4, -5.4, 12, 10.8, 4.4);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(2.6, 0, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(G, ctx) {
  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // A soft ring marks the player in a crowd.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 2, 13, 8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(46,16,32,0.3)';
  ctx.beginPath();
  ctx.ellipse(2.5, 3.5, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  const stride = p.speedNow > 12 ? Math.sin(p.walkPhase) * 5.4 : 0;
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-stride * 0.6, stride);
  ctx.moveTo(0, 0);
  ctx.lineTo(-stride * 0.6, -stride);
  ctx.stroke();
  ctx.rotate(p.angle);
  // Rico's teal jacket and the pistol in his hand.
  ctx.fillStyle = '#0e7c7b';
  roundRect(ctx, -7, -6, 13.4, 12, 5);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(2.8, 0, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22242a';
  ctx.fillRect(7.5, -1.4, 9, 2.8);
  ctx.restore();
}

function drawFx(G, ctx) {
  for (const t of G.tracers) {
    ctx.strokeStyle = `rgba(255,230,150,${(t.life / t.maxLife) * 0.85})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.min(1, f.life / (f.maxLife * 0.5));
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillStyle = '#1c1420';
    ctx.fillText(f.text, f.x + 1.6, f.y + 1.6);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// The grade: a warm wash from the low sun and a soft vignette.
function drawGrade(G, ctx) {
  const grad = ctx.createLinearGradient(0, 0, VIEW_W * 0.4, VIEW_H);
  grad.addColorStop(0, PALETTE.sunsetA);
  grad.addColorStop(1, PALETTE.sunsetB);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  vig.addColorStop(0, 'rgba(20,8,18,0)');
  vig.addColorStop(1, 'rgba(20,8,18,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
