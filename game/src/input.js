// input.js — keyboard and mouse state for Solana Heat.
//
// One shared `input` object: held keys by code, edge-triggered presses for
// actions (interact, pause, shooting), and the mouse position in screen
// space plus its world-space position once the camera is known.

export const input = {
  keys: new Set(),
  pressed: new Set(), // codes that went down since the last frame
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  mouseClicked: false, // went down since the last frame
};

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;

  window.addEventListener('keydown', (ev) => {
    if (!ev.repeat) {
      input.keys.add(ev.code);
      input.pressed.add(ev.code);
    }
    // Keep the page from scrolling on game keys.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
      ev.preventDefault();
    }
  });
  window.addEventListener('keyup', (ev) => input.keys.delete(ev.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((ev.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((ev.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      input.mouseDown = true;
      input.mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

// Called at the end of every frame: edge triggers last exactly one frame.
export function endFrameInput() {
  input.pressed.clear();
  input.mouseClicked = false;
}

export function wasPressed(...codes) {
  return codes.some((code) => input.pressed.has(code));
}

export function isDown(...codes) {
  return codes.some((code) => input.keys.has(code));
}
