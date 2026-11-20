// config.js — every shared constant of Solana Heat in one place: the world's shape, the road
// grid Port Solana is built on, the car catalogue, the colour palette of a permanent late
// afternoon, and the tuning numbers for heat, money and damage.

// The world is a rectangle of sea. The mainland fills its west, Solana Key island its east,
// and one bridge joins them. All distances are world pixels.
export const WORLD_W = 5200;
export const WORLD_H = 3600;

// Land masses. Everything outside these two rectangles (and off the bridge deck) is water.
export const MAINLAND = { x: 0, y: 0, w: 3800, h: 3120 };
export const ISLAND = { x: 4240, y: 1060, w: 960, h: 1520 };
export const BRIDGE = { x: 3800, y: 1814, w: 440, h: 92 }; // deck, centred on the y=1860 road

// The road grid. Roads are ROAD_W wide, centred on these lines; traffic keeps right.
export const ROAD_W = 92;
export const LANE_OFF = 23; // distance from a road's centre line to its right-hand lane centre
export const ROADS_X = [300, 820, 1340, 1860, 2380, 2900, 3420]; // vertical roads, west to east
export const ROADS_Y = [300, 820, 1340, 1860, 2380, 2900]; // horizontal roads, north to south
export const ISLAND_ROADS_X = [4720];
export const ISLAND_ROADS_Y = [1340, 1860, 2380];

// City blocks are the rectangles the grid leaves between roads; SIDEWALK is the pavement ring
// drawn around each block's buildings.
export const SIDEWALK = 16;

// The five cars of Port Solana plus the police interceptor. Speeds are pixels per second,
// health is the punishment a body shell takes before it smokes and dies.
export const CAR_TYPES = {
  comet:   { name: 'Comet Cabrio',    w: 44, l: 84, topSpeed: 660, accel: 520, health: 130, colors: ['#e2483d', '#f2a03d', '#39c2d7', '#e8e4da'] },
  meridian:{ name: 'Meridian Sedan',  w: 46, l: 92, topSpeed: 560, accel: 430, health: 170, colors: ['#3d5a80', '#6c757d', '#22262b', '#98c1d9'] },
  cab:     { name: 'Solana Cab',      w: 46, l: 90, topSpeed: 540, accel: 430, health: 170, colors: ['#f7b731'] },
  pico:    { name: 'Pico Hatch',      w: 40, l: 72, topSpeed: 480, accel: 460, health: 110, colors: ['#7bc950', '#e56399', '#f7f06d', '#a2d2ff'] },
  hauler:  { name: 'Hauler Pickup',   w: 48, l: 98, topSpeed: 500, accel: 380, health: 230, colors: ['#8d6e63', '#546e7a', '#c0ca33'] },
  interceptor: { name: 'PSPD Interceptor', w: 46, l: 94, topSpeed: 640, accel: 560, health: 260, colors: ['#1d2733'] },
};
export const TRAFFIC_TYPES = ['comet', 'meridian', 'cab', 'pico', 'hauler'];
export const TRAFFIC_COUNT = 24;
export const PARKED_COUNT = 16;
export const PED_COUNT = 44;

// The player, on foot and behind the wheel.
export const PLAYER_RADIUS = 13;
export const PLAYER_WALK = 235; // px/s
export const PLAYER_RUN = 330; // px/s holding Shift
export const PLAYER_HEALTH = 100;

// Heat is fractional, 0 to MAX_HEAT; the stars shown are its ceiling. Crimes add, hiding drains.
export const MAX_HEAT = 5;
export const HEAT = {
  carjackWitnessed: 1.0,
  carjackQuiet: 0.35,
  hitPed: 1.0,
  hitCar: 0.3,
  hitCopCar: 0.8,
  gunshot: 0.45,
  pedShot: 1.2,
  robbery: 2.6,
  decayPerSecond: 0.055, // while no officer has eyes on the player
  safehouseDecayPerSecond: 0.5, // lying low on Solana Key works fast
};

// Money.
export const HOSPITAL_FEE = 150;
export const BUST_FINE_BASE = 100;
export const BUST_FINE_PER_STAR = 50;
export const TAXI_BASE_FARE = 40;

// Palette: sun-soaked Port Solana at golden hour.
export const COLORS = {
  water: '#1d6f8e',
  waterDeep: '#175d7a',
  waterSparkle: 'rgba(255,236,190,0.35)',
  sand: '#ecd29a',
  grass: '#79a85b',
  grassDark: '#679350',
  parkPath: '#d9c08a',
  asphalt: '#3c4148',
  asphaltEdge: '#2f3339',
  laneMark: '#e8d44d',
  centreMark: 'rgba(240,240,235,0.55)',
  sidewalk: '#b8ab90',
  blockBase: '#c2b494',
  plaza: '#c9b18c',
  crosswalk: 'rgba(245,245,240,0.75)',
  bridge: '#565d66',
  bridgeRail: '#8a929c',
  dock: '#8a6f4d',
  palmTrunk: '#8a6f4d',
  palmLeaf: '#4e8f4a',
  treeLeaf: '#55853f',
  treeLeafDark: '#477636',
  sunsetWash: 'rgba(255,140,60,0.10)',
  vignette: 'rgba(40,8,20,0.28)',
};

export const SAVE_KEY = 'solana-heat-save-v1';
