let renderFn = null;

export function setRender(fn) {
  renderFn = fn;
}

export function scheduleRender() {
  if (renderFn) renderFn();
}