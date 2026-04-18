export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface FieldDefinition {
    key: string;
    label: string;
    type: FieldType;
    system: boolean;
    placeholder?: string;
    multiline?: boolean;
    options?: string[];
}

export interface DataTypeDefinition {
    id: string;
    label: string;
    description: string;
    system: boolean;
    fields: FieldDefinition[];
}

const STORAGE_KEY = 'nextrack-schema-registry-v1';

const BUILT_IN_TYPES: DataTypeDefinition[] = [
    {
        id: 'node',
        label: 'Node',
        description: 'Components placed on the canvas — servers, switches, firewalls, etc.',
        system: true,
        fields: [
            { key: 'name',   label: 'Name',   type: 'text', system: true },
            { key: 'kind',   label: 'Kind',   type: 'text', system: true },
            { key: 'vendor', label: 'Vendor', type: 'text', system: true },
            { key: 'model',  label: 'Model',  type: 'text', system: true },
            { key: 'notes',  label: 'Notes',  type: 'text', system: true, multiline: true },
        ],
    },
    {
        id: 'connection',
        label: 'Connection',
        description: 'Links between nodes — cables, fibers, wireless links.',
        system: true,
        fields: [
            { key: 'bandwidth',  label: 'Bandwidth',  type: 'text', system: true, placeholder: 'e.g. 10Gbps' },
            { key: 'medium',     label: 'Medium',     type: 'text', system: true, placeholder: 'e.g. fiber' },
            { key: 'encryption', label: 'Encryption', type: 'text', system: true, placeholder: 'e.g. TLS' },
        ],
    },
    {
        id: 'zone',
        label: 'Zone',
        description: 'Grouping areas on the canvas — racks, rooms, security zones.',
        system: true,
        fields: [
            { key: 'name',  label: 'Zone Name', type: 'text', system: true },
            { key: 'color', label: 'Color',     type: 'text', system: true },
            { key: 'labelPosition', label: 'Label Position', type: 'select', system: true, options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
        ],
    },
    {
        id: 'shape',
        label: 'Shape',
        description: 'Visual templates — geometry, size, icon, and style for rendered components.',
        system: true,
        fields: [
            { key: 'displayName',            label: 'Display Name',      type: 'text',    system: true },
            { key: 'baseShape',              label: 'Base Shape',        type: 'select',  system: true, options: ['cuboid', 'cylinder', 'pyramid', 'hexagonal', 'octagon', 'hexahedron'] },
            { key: 'defaultSize.width',      label: 'Default Width',     type: 'number',  system: true },
            { key: 'defaultSize.height',     label: 'Default Height',    type: 'number',  system: true },
            { key: 'defaultIsometricHeight', label: 'Isometric Height',  type: 'number',  system: true },
            { key: 'collection',             label: 'Collection',        type: 'text',    system: true },
            { key: 'icon',                   label: 'Icon',              type: 'text',    system: true },
            { key: 'iconFace',               label: 'Icon Face',         type: 'select',  system: true, options: ['top', 'front'] },
            { key: 'iconSize',               label: 'Icon Size',         type: 'number',  system: true },
            { key: 'iconBgColor',            label: 'Icon BG Color',     type: 'text',    system: true },
            { key: 'iconBgShape',            label: 'Icon BG Shape',     type: 'select',  system: true, options: ['circle', 'square', 'octagon'] },
            { key: 'complexShape',           label: 'Complex Shape',     type: 'boolean', system: true },
            { key: 'cornerRadius',           label: 'Corner Radius',     type: 'number',  system: true },
            { key: 'chamferSize',            label: 'Chamfer Size',      type: 'number',  system: true },
        ],
    },
    {
        id: 'component',
        label: 'Component',
        description: 'Domain-level components — link a shape template to a named, categorized entity.',
        system: true,
        fields: [
            { key: 'id',       label: 'ID',        type: 'text',   system: true },
            { key: 'name',     label: 'Name',      type: 'text',   system: true },
            { key: 'category', label: 'Category',   type: 'select', system: true, options: ['general', 'user'] },
            { key: 'shapeId',  label: 'Shape ID',   type: 'text',   system: true },
        ],
    },
    {
        id: 'shape-layer',
        label: 'Shape Layer',
        description: 'A visual building block inside a complex shape — geometry, position, and style per layer.',
        system: true,
        fields: [
            { key: 'id',              label: 'ID',              type: 'text',   system: true },
            { key: 'name',            label: 'Name',            type: 'text',   system: true },
            { key: 'baseShape',       label: 'Base Shape',      type: 'select', system: true, options: ['cuboid', 'cylinder', 'pyramid', 'hexagonal', 'octagon', 'hexahedron'] },
            { key: 'width',           label: 'Width',           type: 'number', system: true },
            { key: 'height',          label: 'Height',          type: 'number', system: true },
            { key: 'depth',           label: 'Depth',           type: 'number', system: true },
            { key: 'offsetX',         label: 'Offset X',        type: 'number', system: true },
            { key: 'offsetY',         label: 'Offset Y',        type: 'number', system: true },
            { key: 'baseElevation',   label: 'Base Elevation',  type: 'number', system: true },
            { key: 'style.topColor',  label: 'Top Color',       type: 'text',   system: true },
            { key: 'style.sideColor', label: 'Side Color',      type: 'text',   system: true },
            { key: 'style.frontColor', label: 'Front Color',    type: 'text',   system: true },
            { key: 'style.strokeColor', label: 'Stroke Color',  type: 'text',   system: true },
            { key: 'cornerRadius',    label: 'Corner Radius',   type: 'number', system: true },
            { key: 'chamferSize',     label: 'Chamfer Size',    type: 'number', system: true },
            { key: 'svgFootprintName', label: 'SVG Footprint',  type: 'text',   system: true },
        ],
    },
    {
        id: 'base-shape',
        label: 'Base Shape',
        description: 'Enumeration of available 3D geometry primitives for shapes and layers.',
        system: true,
        fields: [
            { key: 'cuboid',     label: 'Cuboid',     type: 'text', system: true },
            { key: 'cylinder',   label: 'Cylinder',   type: 'text', system: true },
            { key: 'pyramid',    label: 'Pyramid',    type: 'text', system: true },
            { key: 'hexagonal',  label: 'Hexagonal',  type: 'text', system: true },
            { key: 'octagon',    label: 'Octagon',    type: 'text', system: true },
            { key: 'hexahedron', label: 'Hexahedron', type: 'text', system: true },
        ],
    },
    {
        id: 'component-category',
        label: 'Component Category',
        description: 'Classification of components — general (shared) or user (private).',
        system: true,
        fields: [
            { key: 'general', label: 'General', type: 'text', system: true },
            { key: 'user',    label: 'User',    type: 'text', system: true },
        ],
    },
    {
        id: 'component-collection',
        label: 'Component Collection',
        description: 'Vendor-based grouping of components in the palette and admin library.',
        system: true,
        fields: [
            { key: 'General', label: 'General', type: 'text', system: true },
            { key: 'Oracle',  label: 'Oracle',  type: 'text', system: true },
            { key: 'NetApp',  label: 'NetApp',  type: 'text', system: true },
            { key: 'Dell',    label: 'Dell',    type: 'text', system: true },
            { key: 'Lenovo',  label: 'Lenovo',  type: 'text', system: true },
        ],
    },
    {
        id: 'icon-scope',
        label: 'Icon Scope',
        description: 'Visibility setting for icons — which pickers an icon appears in.',
        system: true,
        fields: [
            { key: 'general',      label: 'General',      type: 'text', system: true },
            { key: 'complex-only', label: 'Complex Only', type: 'text', system: true },
            { key: 'none',         label: 'None',         type: 'text', system: true },
        ],
    },
    {
        id: 'icon-source',
        label: 'Icon Source',
        description: 'Origin of an icon in the catalog.',
        system: true,
        fields: [
            { key: 'custom',   label: 'Custom',   type: 'text', system: true },
            { key: 'carbon',   label: 'Carbon',   type: 'text', system: true },
            { key: 'uploaded', label: 'Uploaded', type: 'text', system: true },
        ],
    },
    {
        id: 'shape-style',
        label: 'Shape Style',
        description: 'Color overrides for the faces of an isometric shape.',
        system: true,
        fields: [
            { key: 'topColor',    label: 'Top Color',    type: 'text', system: true },
            { key: 'sideColor',   label: 'Side Color',   type: 'text', system: true },
            { key: 'frontColor',  label: 'Front Color',  type: 'text', system: true },
            { key: 'strokeColor', label: 'Stroke Color', type: 'text', system: true },
        ],
    },
    {
        id: 'color-token',
        label: 'Color Token',
        description: 'Named color with base and hover variants — used for zone colors and UI swatches.',
        system: true,
        fields: [
            { key: 'label', label: 'Label', type: 'text', system: true },
            { key: 'base',  label: 'Base',  type: 'text', system: true },
            { key: 'hover', label: 'Hover', type: 'text', system: true },
        ],
    },
];

function deepClone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
}

let registry: DataTypeDefinition[] = deepClone(BUILT_IN_TYPES);

export function loadSchemaFromStorage(): void {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as DataTypeDefinition[];
        if (!Array.isArray(saved)) return;

        registry = deepClone(BUILT_IN_TYPES);

        for (const savedType of saved) {
            const builtIn = registry.find(t => t.id === savedType.id);
            if (builtIn) {
                for (const field of savedType.fields) {
                    if (!field.system && !builtIn.fields.some(f => f.key === field.key)) {
                        builtIn.fields.push(field);
                    }
                }
            } else if (!savedType.system) {
                registry.push(savedType);
            }
        }
    } catch {
        // non-critical
    }
}

export function saveSchemaToStorage(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    } catch {
        // non-critical
    }
}

export function getDataTypes(): DataTypeDefinition[] {
    return registry;
}

export function getDataType(id: string): DataTypeDefinition | undefined {
    return registry.find(t => t.id === id);
}

export function addDataType(id: string, label: string, description: string): DataTypeDefinition {
    const existing = registry.find(t => t.id === id);
    if (existing) throw new Error(`Data type "${id}" already exists`);
    const dt: DataTypeDefinition = { id, label, description, system: false, fields: [] };
    registry.push(dt);
    saveSchemaToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:schema-changed'));
    return dt;
}

export function removeDataType(id: string): void {
    const dt = registry.find(t => t.id === id);
    if (!dt || dt.system) return;
    registry = registry.filter(t => t.id !== id);
    saveSchemaToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:schema-changed'));
}

export function addField(typeId: string, field: Omit<FieldDefinition, 'system'>): void {
    const dt = registry.find(t => t.id === typeId);
    if (!dt) return;
    if (dt.fields.some(f => f.key === field.key)) return;
    dt.fields.push({ ...field, system: false });
    saveSchemaToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:schema-changed'));
}

export function updateField(typeId: string, key: string, patch: Partial<Omit<FieldDefinition, 'key' | 'system'>>): void {
    const dt = registry.find(t => t.id === typeId);
    if (!dt) return;
    const field = dt.fields.find(f => f.key === key);
    if (!field) return;
    Object.assign(field, patch);
    saveSchemaToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:schema-changed'));
}

export function removeField(typeId: string, key: string): void {
    const dt = registry.find(t => t.id === typeId);
    if (!dt) return;
    const field = dt.fields.find(f => f.key === key);
    if (!field || field.system) return;
    dt.fields = dt.fields.filter(f => f.key !== key);
    saveSchemaToStorage();
    document.dispatchEvent(new CustomEvent('nextrack:schema-changed'));
}

export function getCustomFields(typeId: string): FieldDefinition[] {
    const dt = registry.find(t => t.id === typeId);
    if (!dt) return [];
    return dt.fields.filter(f => !f.system);
}

loadSchemaFromStorage();
