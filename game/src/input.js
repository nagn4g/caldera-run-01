// Keyboard and mouse sticks. W/S (or Shift/Ctrl) set throttle, A/D bank, arrows or the mouse
// pitch and roll; R restarts. Keys latch so a tap gives one clean input even at low frame rates.
export const ACTION_RESTART = 'restart';

export function createInput(canvas, onAction) {
  const keys = new Set();
  let mouseRoll = 0;
  let mousePitch = 0;
  let mouseActive = false;

  function key(event, down) {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    if (down) {
      keys.add(code);
      if (code === 'KeyR') onAction?.(ACTION_RESTART);
    } else {
      keys.delete(code);
    }
  }

  window.addEventListener('keydown', (event) => key(event, true));
  window.addEventListener('keyup', (event) => key(event, false));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) return;
    mouseRoll = Math.max(-1, Math.min(1, mouseRoll + event.movementX / 260));
    mousePitch = Math.max(-1, Math.min(1, mousePitch - event.movementY / 260));
    mouseActive = true;
  });
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  });

  /** Read the sticks for this frame and decay the mouse toward centre. */
  function read(dt) {
    let throttle = 0.55;
    if (keys.has('KeyW') || keys.has('ShiftLeft')) throttle = 1;
    if (keys.has('KeyS') || keys.has('ControlLeft')) throttle = 0;
    if (keys.has('Space')) throttle = 1;

    let roll = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) roll -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) roll += 1;
    if (mouseActive) roll = Math.max(-1, Math.min(1, roll + mouseRoll));
    mouseRoll *= Math.max(0, 1 - dt * 2.2);

    let pitch = 0;
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    if (mouseActive) pitch = Math.max(-1, Math.min(1, pitch + mousePitch));
    mousePitch *= Math.max(0, 1 - dt * 2.2);

    return { throttle, roll, pitch };
  }

  return { read };
}
