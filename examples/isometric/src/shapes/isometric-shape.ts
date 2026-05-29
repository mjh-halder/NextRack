import { dia, g } from '@joint/core';
import { PORT_GROUPS, initPorts, updatePortPositions as syncPortPositions, PortView } from './ports';
import { SHAPE_CELL_SIZE } from '../theme';

export const ISOMETRIC_HEIGHT_KEY = 'isometric-height';
export const SIZE_KEY = 'size';
export const CONNECT_KEY = 'connect';

export type ToolKeys = 'connect' | 'size' | 'isometric-height';

interface IsometricElementAttributes extends dia.Element.Attributes {
    defaultIsometricHeight: number;
    isometricHeight: number;
}

type Tools = {
    [key in ToolKeys]?: dia.ToolView
}

export enum View {
    Isometric = 'isometric',
    TwoDimensional = '2d',
}

/**
 * Modifier keys recognised by the Component Designer's modifier panel.
 * Which keys apply to which base shape is owned by `shape-capabilities.ts`
 * (see ADR-0004) — this type is just the vocabulary.
 */
export type ModifierKey =
    | 'cornerRadius'
    | 'chamfer' | 'chamferHeight' | 'chamferBottom' | 'chamferBottomHeight'
    | 'twist'
    | 'scaleTopX' | 'scaleTopY'
    | 'shedRoof' | 'shedRoofDir';

export default class IsometricShape extends dia.Element<IsometricElementAttributes> {

    tools: Tools = {};

    private currentPortView: PortView = 'isometric';

    get twist(): number { return this.get('twist') ?? 0; }
    get scaleTopX(): number { return this.get('scaleTopX') ?? 1; }
    get scaleTopY(): number { return this.get('scaleTopY') ?? 1; }
    get shedRoofDrop(): number { return this.get('shedRoofDrop') ?? 0; }
    get shedRoofDirection(): 'front' | 'right' | 'back' | 'left' { return this.get('shedRoofDirection') ?? 'front'; }

    constructor(...args: any[]) {
        super(...args);
        if (this.usePorts()) {
            if (!this.get('ports')?.groups) {
                this.set('ports', { groups: PORT_GROUPS, items: [] }, { silent: true });
            }
            initPorts(this, this.currentPortView);
            this.on('change:size change:isometricHeight change:labelRotation', () => this.updatePortPositions());
        }
        this.toggleView(View.Isometric);
    }

    protected usePorts(): boolean { return true; }

    protected updatePortPositions(): void {
        syncPortPositions(this, this.currentPortView);
    }

    get defaultIsometricHeight(): number {
        return this.get('isometricHeight') ?? 0;
    }

    get isometricHeight(): number {
        return this.get('isometricHeight') ?? this.defaultIsometricHeight;
    }

    get topX(): number {
        const rot = (this.get('shapeRotation') as number) ?? 0;
        return rot === 90 ? 0 : -this.isometricHeight;
    }

    get topY(): number {
        return -this.isometricHeight;
    }

    get topCenter(): g.Point {
        const { width, height } = this.size();
        const top = new g.Rect(this.topX, this.topY, width, height);

        return top.center();
    }

    resetIsometricHeight(): void {
        this.set('isometricHeight', this.get('defaultIsometricHeight'));
    }

    /**
     * Attaches interaction tools to this shape's view.
     *
     * @param paper  - The paper the shape is rendered on.
     * @param view   - Current view (isometric hides the height tool in 2D mode).
     * @param include - Optional whitelist of tool keys to show. When omitted all
     *                  tools are shown (component designer behaviour). Pass
     *                  `['connect']` in the system designer to suppress the
     *                  resize and height-drag handles.
     */
    addTools(paper: dia.Paper, view: View, include?: ToolKeys[]) {

        const tools = [];
        for (const [key, tool] of Object.entries(this.tools)) {
            if (view === View.TwoDimensional && key === ISOMETRIC_HEIGHT_KEY) continue;
            // Ports are the canonical link-drawing surface in this app —
            // the connect arrow is redundant noise and was disabled in
            // both views per user request.
            if (key === CONNECT_KEY) continue;
            if (include && !include.includes(key as ToolKeys)) continue;
            tool.name = key;
            tools.push(tool);
        }

        const toolView = new dia.ToolsView({ name: 'controls', tools });
        this.findView(paper).addTools(toolView);
    }

    toggleView(view: View) {
        const isIsometric = view === View.Isometric;
        this.set('viewMode', isIsometric ? 'iso' : '2d');
        this.attr({
            '2d':  { display: isIsometric ? 'none' : 'block' },
            'iso': { display: isIsometric ? 'block' : 'none' },
        });
        this.apply2DHitArea(!isIsometric);
        this.currentPortView = isIsometric ? 'isometric' : '2d';
        if (this.usePorts()) this.updatePortPositions();
        // Re-anchor the label to the visible block — 40×40 icon box in 2D, the
        // iso volume in isometric.
        const { applyLabelPosition } = require('../label-position');
        applyLabelPosition(this);
    }

    /**
     * Restrict the hit area to a centred 40×40 cell in 2D so the click/drag
     * target matches the visual (the icon, also 40×40). In 3D the base falls
     * back to the SVG template defaults via `null` attrs, which restores the
     * full footprint as the hit surface.
     *
     * Affects `base` (rect — hexahedron-style shapes), `base2D` (path —
     * tube/pipe/duct/channel), and `hitArea` (ComplexComponent's dedicated
     * pointer-event surface).
     */
    protected apply2DHitArea(twoD: boolean): void {
        const G = SHAPE_CELL_SIZE;
        const { width: w, height: h } = this.size();
        const x = (w - G) / 2;
        const y = (h - G) / 2;
        const hitPath = `M ${x} ${y} L ${x + G} ${y} L ${x + G} ${y + G} L ${x} ${y + G} Z`;
        // `base` and `hitArea` stay at the full model-bbox in 2D (visually
        // transparent for `base`) so the SVG bbox — which Manhattan reads for
        // obstacle avoidance — matches the iso bbox. `base2D` (the path-based
        // 2D visual on tube/pipe/etc.) keeps its centred 40×40 footprint.
        this.attr({
            base: twoD
                ? { x: 0, y: 0, width: w, height: h, fillOpacity: 0, strokeOpacity: 0 }
                : { x: null, y: null, width: null, height: null, fillOpacity: null, strokeOpacity: null },
            base2D: twoD ? { d: hitPath } : { d: null },
            hitArea: twoD
                ? { x: 0, y: 0, width: w, height: h }
                : { x: null, y: null, width: null, height: null },
        });
    }
}
