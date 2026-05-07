// Central loader animation — reusable across the app.
// Uses two outline bars with a Pac-Man wrap effect (clipPath + dual copies).

export const LOADER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 28" class="nr-loader-svg">
  <defs><clipPath id="nr-loader-clip"><rect x="0" y="0" width="40" height="28"/></clipPath></defs>
  <g clip-path="url(#nr-loader-clip)">
    <g class="nr-loader-bar-top">
      <rect x="2" y="2" width="22" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="-38" y="2" width="22" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
    </g>
    <g class="nr-loader-bar-bottom">
      <rect x="16" y="16" width="22" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
      <rect x="56" y="16" width="22" height="10" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>
    </g>
  </g>
</svg>`;

export const LOADER_CSS = `
.nr-loader-svg {
  display: block;
  width: 40px;
  height: 28px;
}
.nr-loader-bar-top {
  animation: nr-loader-wrap-right 0.4s linear infinite;
}
.nr-loader-bar-bottom {
  animation: nr-loader-wrap-left 0.4s linear infinite;
}
@keyframes nr-loader-wrap-right {
  0%   { transform: translateX(0); }
  100% { transform: translateX(40px); }
}
@keyframes nr-loader-wrap-left {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-40px); }
}
`;

let styleInjected = false;

export function ensureLoaderStyles(): void {
    if (styleInjected) return;
    const style = document.createElement('style');
    style.textContent = LOADER_CSS;
    document.head.appendChild(style);
    styleInjected = true;
}

export function createLoader(color = 'currentColor'): HTMLElement {
    ensureLoaderStyles();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;color:' + color;
    wrap.innerHTML = LOADER_SVG;
    return wrap;
}
