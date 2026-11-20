// input.js — the player's hands: keyboard state, mouse position and buttons, and the one-shot
// "pressed" edges the game logic consumes once per frame. Everything is tracked on window so
// the game keeps answering when the canvas is the whole page.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // key codes that went down since the last consumePressed()
  const mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };
  let wheel = 0;

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (e.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { wheel += Math.sign(e.deltaY); }, { passive: true });

  return {
    mouse,
    down: (...codes) => codes.some((c) => keys.has(c)),
    // True once per physical press; the game polls these for E, T, Esc, Enter and friends.
    wasPressed: (code) => pressed.has(code),
    consumeFrame() {
      const frame = { pressed: new Set(pressed), clicked: mouse.clicked, wheel };
      pressed.clear();
      mouse.clicked = false;
      wheel = 0;
      return frame;
    },
  };
}
