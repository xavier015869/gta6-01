// config.js — shared constants for Solana Heat: world size, the road grid,
// vehicle types and the warm sunset palette the whole game is graded with.

export const WORLD_W = 3950; // total world width in pixels (land, beach, sea, island)
export const WORLD_H = 2204; // total world height in pixels

export const PITCH = 420; // distance between neighbouring road starts
export const ROAD_W = 104; // road width in pixels
export const BLOCK = PITCH - ROAD_W; // city block interior size (316)
export const COLS = 7; // block columns on the mainland
export const ROWS = 5; // block rows on the mainland

export const LAND_END = 3044; // x where the coast road ends and the sand begins
export const WATER_X = 3300; // x where the sea begins
export const BRIDGE_Y = 2 * PITCH; // the bridge leaves from horizontal road 2
export const ISLAND = { x: 3520, y: 700, w: 380, h: 560 }; // Solana Key, offshore

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Vehicle types: name, size, top speed (px/s), acceleration, grip, colour pool.
// Every name is invented for Port Solana; no real or borrowed brands.
export const CAR_TYPES = {
  comet: {
    label: 'Comet Cabrio', w: 46, h: 22, top: 385, accel: 300, grip: 3.4,
    colors: ['#e2483d', '#f2a03d', '#f5d13d', '#3fa7d6', '#eeeeee'],
  },
  sedan: {
    label: 'Meridian Sedan', w: 48, h: 23, top: 300, accel: 235, grip: 3.0,
    colors: ['#c0c6cc', '#5b6b7a', '#7a4a56', '#33523f', '#d8d3c3', '#2e3a46'],
  },
  taxi: {
    label: 'Solana Cab', w: 48, h: 23, top: 295, accel: 240, grip: 3.0,
    colors: ['#f7b731'],
  },
  hatch: {
    label: 'Pico Hatch', w: 40, h: 21, top: 262, accel: 225, grip: 3.2,
    colors: ['#8bc34a', '#ff8a65', '#ba68c8', '#4db6ac', '#fff176'],
  },
  truck: {
    label: 'Hauler Pickup', w: 54, h: 25, top: 245, accel: 195, grip: 2.6,
    colors: ['#90a4ae', '#6d4c41', '#546e7a', '#a1887f'],
  },
  cop: {
    label: 'PSPD Interceptor', w: 49, h: 23, top: 352, accel: 285, grip: 3.3,
    colors: ['#f4f6f8'],
  },
};

// The sunset palette: warm light over a pastel coastal city.
export const PALETTE = {
  water: '#1d6f8e',
  waterDeep: '#155e7a',
  sand: '#ecd29a',
  grass: '#79b657',
  grassDark: '#67a34b',
  sidewalk: '#cfc4b0',
  asphalt: '#3d3a42',
  asphaltDark: '#332f38',
  laneMark: '#e8d44d',
  curb: '#b7ab94',
  roof: ['#e2725b', '#e88ca0', '#f2c14e', '#7fb3d5', '#a3c585', '#d5a6bd', '#f0e1c6', '#84a98c', '#e5989b', '#6d8ea0'],
  roofTrim: 'rgba(60,30,20,0.35)',
  shadow: 'rgba(46,16,32,0.30)',
  sunsetA: 'rgba(255,138,61,0.10)',
  sunsetB: 'rgba(120,30,90,0.12)',
};

export const SAVE_KEY = 'solana-heat-save-v1';
