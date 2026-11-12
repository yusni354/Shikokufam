export const $ = s => document.querySelector(s);
export function h(t, p, ...k) {
  const e = document.createElement(t);
  for (const a in p || {}) {
    if (a === 'onclick') e.onclick = p[a];
    else if (a === 'class') e.className = p[a];
    else e.setAttribute(a, p[a]);
  }
  k.flat().forEach(c => {
    if (c != null && c !== false) e.append(c);
  });
  return e;
}