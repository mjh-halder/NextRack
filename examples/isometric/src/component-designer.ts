const CD_SVG_NS = 'http://www.w3.org/2000/svg';
const CD_XLINK_NS = 'http://www.w3.org/1999/xlink';

type CdBaseShape = 'square' | 'rectangle' | 'round' | 'octagon';

interface CdState {
    iconHref: string;
    baseShape: CdBaseShape;
}

const CD_ASSETS: { label: string; href: string }[] = [
    { label: 'Switch',      href: 'assets/switch-icon.svg'               },
    { label: 'Router',      href: 'assets/router-icon.svg'               },
    { label: 'K8s Worker',  href: 'assets/kubernetesWorkerNode-logo.svg' },
    { label: 'K8s Control', href: 'assets/kubernetesControlNode-logo.svg'},
    { label: 'Virtual',     href: 'assets/virtualinstance-logo.svg'      },
    { label: 'Logo',        href: 'assets/jj-logo.svg'                   },
];

const cdState: CdState = {
    iconHref: CD_ASSETS[0].href,
    baseShape: 'square',
};

// Build icon selector grid
const cdIconGrid = document.getElementById('cd-icon-grid') as HTMLDivElement;
for (const asset of CD_ASSETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cd-icon-btn' + (asset.href === cdState.iconHref ? ' cd-icon-btn--active' : '');
    btn.title = asset.label;

    const img = document.createElement('img');
    img.src = asset.href;
    img.alt = asset.label;

    const lbl = document.createElement('span');
    lbl.textContent = asset.label;

    btn.appendChild(img);
    btn.appendChild(lbl);
    btn.addEventListener('click', () => {
        cdState.iconHref = asset.href;
        cdIconGrid.querySelectorAll('.cd-icon-btn').forEach(b => b.classList.remove('cd-icon-btn--active'));
        btn.classList.add('cd-icon-btn--active');
        renderCdPreview();
    });
    cdIconGrid.appendChild(btn);
}

// Wire base shape selector
document.querySelectorAll<HTMLButtonElement>('.cd-shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        cdState.baseShape = btn.dataset.shape as CdBaseShape;
        document.querySelectorAll('.cd-shape-btn').forEach(b => b.classList.remove('cd-shape-btn--active'));
        btn.classList.add('cd-shape-btn--active');
        renderCdPreview();
    });
});

function renderCdPreview() {
    const svg = document.getElementById('cd-preview-svg') as unknown as SVGSVGElement;
    // clear
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const W = 400, H = 400;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // Grid background (10×10 cells at 40px each)
    const CELL = 40;
    const gridParts: string[] = [];
    for (let i = 0; i <= W / CELL; i++) gridParts.push(`M ${i * CELL} 0 V ${H}`);
    for (let i = 0; i <= H / CELL; i++) gridParts.push(`M 0 ${i * CELL} H ${W}`);
    const gridPath = document.createElementNS(CD_SVG_NS, 'path');
    gridPath.setAttribute('d', gridParts.join(' '));
    gridPath.setAttribute('fill', 'none');
    gridPath.setAttribute('stroke', '#e0e0e0');
    gridPath.setAttribute('stroke-width', '1');
    svg.appendChild(gridPath);

    // Component bounding box, centered in the SVG
    let cw = 120, ch = 120;
    if (cdState.baseShape === 'rectangle') { cw = 180; ch = 80; }
    const x = (W - cw) / 2;
    const y = (H - ch) / 2;

    // Base shape
    let baseEl: SVGElement;
    if (cdState.baseShape === 'round') {
        baseEl = document.createElementNS(CD_SVG_NS, 'ellipse');
        baseEl.setAttribute('cx', String(W / 2));
        baseEl.setAttribute('cy', String(H / 2));
        baseEl.setAttribute('rx', String(cw / 2));
        baseEl.setAttribute('ry', String(ch / 2));
    } else if (cdState.baseShape === 'octagon') {
        baseEl = document.createElementNS(CD_SVG_NS, 'polygon');
        const ox = cw * 0.25, oy = ch * 0.25;
        const pts = [
            [x + ox,      y          ],
            [x + cw - ox, y          ],
            [x + cw,      y + oy     ],
            [x + cw,      y + ch - oy],
            [x + cw - ox, y + ch     ],
            [x + ox,      y + ch     ],
            [x,           y + ch - oy],
            [x,           y + oy     ],
        ].map(p => p.join(',')).join(' ');
        baseEl.setAttribute('points', pts);
    } else {
        // square or rectangle
        baseEl = document.createElementNS(CD_SVG_NS, 'rect');
        baseEl.setAttribute('x', String(x));
        baseEl.setAttribute('y', String(y));
        baseEl.setAttribute('width', String(cw));
        baseEl.setAttribute('height', String(ch));
    }
    baseEl.setAttribute('fill', '#e0e0e0');
    baseEl.setAttribute('stroke', '#333333');
    baseEl.setAttribute('stroke-width', '1.5');
    svg.appendChild(baseEl);

    // Badge circle (matches style of Switch/Router components)
    const badge = document.createElementNS(CD_SVG_NS, 'circle');
    badge.setAttribute('cx', String(W / 2));
    badge.setAttribute('cy', String(H / 2));
    badge.setAttribute('r', String(Math.min(cw, ch) * 0.32));
    badge.setAttribute('fill', '#0f62fe');
    svg.appendChild(badge);

    // Icon image, inset 2px inside the bounding box
    const iconImg = document.createElementNS(CD_SVG_NS, 'image');
    iconImg.setAttributeNS(CD_XLINK_NS, 'href', cdState.iconHref);
    iconImg.setAttribute('x', String(x + 2));
    iconImg.setAttribute('y', String(y + 2));
    iconImg.setAttribute('width', String(cw - 4));
    iconImg.setAttribute('height', String(ch - 4));
    svg.appendChild(iconImg);
}

// Initial preview render
renderCdPreview();
