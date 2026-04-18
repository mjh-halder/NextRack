import { dia } from '@joint/core';
import { graph } from './system-designer';
import { Computer, Frame } from './shapes';
import { ShapeRegistry, ShapeDefinition, BUILT_IN_SHAPE_IDS, addShape, deleteShape, saveRegistryToStorage } from './shapes/shape-registry';
import { componentStore, ComponentDefinition } from './component-store';
import { getDataType } from './schema-registry';
import { META_KEY, LINK_META_KEY } from './inspector';
import { GRID_SIZE } from './theme';

export interface AppRecord {
    id: string;
    values: Record<string, unknown>;
}

type RecordReader = () => AppRecord[];
type RecordCreator = (values: Record<string, unknown>) => AppRecord | null;
type RecordDeleter = (id: string) => boolean;

interface RecordAdapter {
    read: RecordReader;
    create: RecordCreator;
    remove: RecordDeleter;
}

function nodeAdapter(): RecordAdapter {
    return {
        read() {
            return graph.getElements()
                .filter(el => !el.get('isFrame') && el.get('componentRole') !== 'child')
                .map(el => {
                    const meta: Record<string, unknown> = el.get(META_KEY) ?? {};
                    return {
                        id: el.id as string,
                        values: { id: el.id, ...meta },
                    };
                });
        },
        create(values) {
            const node = new Computer();
            node.position(GRID_SIZE * 2, GRID_SIZE * 2);
            const meta: Record<string, unknown> = {};
            const dt = getDataType('node');
            if (dt) {
                for (const f of dt.fields) {
                    if (f.key in values) meta[f.key] = values[f.key];
                    else meta[f.key] = '';
                }
            }
            if (values.name) meta.name = values.name;
            node.set(META_KEY, meta);
            const label = String(meta.name || '').trim() || 'New Node';
            node.attr('label/text', label);
            graph.addCell(node);
            return { id: node.id as string, values: { id: node.id, ...meta } };
        },
        remove(id) {
            const cell = graph.getCell(id);
            if (!cell || cell.get('isFrame')) return false;
            cell.remove();
            return true;
        },
    };
}

function connectionAdapter(): RecordAdapter {
    return {
        read() {
            return graph.getLinks().map(link => {
                const meta: Record<string, unknown> = link.get(LINK_META_KEY) ?? {};
                const src = link.source();
                const tgt = link.target();
                return {
                    id: link.id as string,
                    values: {
                        id: link.id,
                        ...meta,
                        sourceId: (src as dia.Link.EndJSON)?.id ?? '',
                        targetId: (tgt as dia.Link.EndJSON)?.id ?? '',
                    },
                };
            });
        },
        create(_values) {
            return null;
        },
        remove(id) {
            const cell = graph.getCell(id);
            if (!cell || !cell.isLink()) return false;
            cell.remove();
            return true;
        },
    };
}

function zoneAdapter(): RecordAdapter {
    return {
        read() {
            return graph.getElements()
                .filter(el => el.get('isFrame'))
                .map(el => {
                    const zoneMeta: Record<string, unknown> = el.get('zoneMeta') ?? {};
                    return {
                        id: el.id as string,
                        values: {
                            id: el.id,
                            name: el.attr('label/text') ?? '',
                            color: el.get('zoneColor') ?? '',
                            labelPosition: el.get('zoneLabelPosition') ?? 'top-left',
                            ...zoneMeta,
                        },
                    };
                });
        },
        create(values) {
            const zone = new Frame();
            zone.position(GRID_SIZE * 2, GRID_SIZE * 2);
            zone.resize(GRID_SIZE * 8, GRID_SIZE * 6);
            const name = String(values.name || '').trim() || 'New Zone';
            zone.attr('label/text', name);
            graph.addCell(zone);
            return {
                id: zone.id as string,
                values: { id: zone.id, name, color: '', labelPosition: 'top-left' },
            };
        },
        remove(id) {
            const cell = graph.getCell(id);
            if (!cell || !cell.get('isFrame')) return false;
            cell.remove();
            return true;
        },
    };
}

function shapeAdapter(): RecordAdapter {
    return {
        read() {
            return Object.entries(ShapeRegistry).map(([id, def]) => ({
                id,
                values: flattenShapeDef(id, def),
            }));
        },
        create(values) {
            const id = String(values.displayName || 'new-shape')
                .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                + '-' + Date.now().toString(36);
            const def: ShapeDefinition = {
                defaultSize: { width: GRID_SIZE * 2, height: GRID_SIZE * 2 },
                defaultIsometricHeight: GRID_SIZE,
                displayName: String(values.displayName || 'New Shape'),
            };
            addShape(id, def);
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            return { id, values: flattenShapeDef(id, def) };
        },
        remove(id) {
            if (BUILT_IN_SHAPE_IDS.has(id)) return false;
            deleteShape(id);
            saveRegistryToStorage();
            document.dispatchEvent(new CustomEvent('nextrack:registry-changed'));
            return true;
        },
    };
}

function flattenShapeDef(id: string, def: ShapeDefinition): Record<string, unknown> {
    return {
        id,
        displayName: def.displayName ?? '',
        baseShape: def.baseShape ?? '',
        'defaultSize.width': def.defaultSize.width,
        'defaultSize.height': def.defaultSize.height,
        defaultIsometricHeight: def.defaultIsometricHeight,
        collection: def.collection ?? '',
        icon: def.icon ?? '',
        iconFace: def.iconFace ?? '',
        iconSize: def.iconSize ?? '',
        iconBgColor: def.iconBgColor ?? '',
        iconBgShape: def.iconBgShape ?? '',
        complexShape: def.complexShape ?? false,
        cornerRadius: def.cornerRadius ?? '',
        chamferSize: def.chamferSize ?? '',
    };
}

function componentAdapter(): RecordAdapter {
    return {
        read() {
            const all = [
                ...componentStore.list('general'),
                ...componentStore.list('user'),
            ];
            return all.map(c => ({
                id: c.id,
                values: { id: c.id, name: c.name, category: c.category, shapeId: c.shapeId },
            }));
        },
        create(values) {
            const id = String(values.name || 'component')
                .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                + '-' + Date.now().toString(36);
            const comp: ComponentDefinition = {
                id,
                name: String(values.name || 'New Component'),
                category: 'user',
                shapeId: String(values.shapeId || ''),
                properties: {},
            };
            componentStore.save(comp);
            return { id, values: { id, name: comp.name, category: comp.category, shapeId: comp.shapeId } };
        },
        remove(id) {
            const comp = componentStore.get('general', id) ?? componentStore.get('user', id);
            if (!comp) return false;
            componentStore.remove(comp.category, id);
            return true;
        },
    };
}

function shapeLayerAdapter(): RecordAdapter {
    return {
        read() {
            const records: AppRecord[] = [];
            for (const [shapeId, def] of Object.entries(ShapeRegistry)) {
                if (!def.layers) continue;
                for (const layer of def.layers) {
                    records.push({
                        id: `${shapeId}::${layer.id}`,
                        values: {
                            id: layer.id,
                            name: layer.name,
                            parentShape: shapeId,
                            baseShape: layer.baseShape,
                            width: layer.width,
                            height: layer.height,
                            depth: layer.depth,
                            offsetX: layer.offsetX,
                            offsetY: layer.offsetY,
                            baseElevation: layer.baseElevation,
                            'style.topColor': layer.style?.topColor ?? '',
                            'style.sideColor': layer.style?.sideColor ?? '',
                            'style.frontColor': layer.style?.frontColor ?? '',
                            'style.strokeColor': layer.style?.strokeColor ?? '',
                            cornerRadius: layer.cornerRadius ?? '',
                            chamferSize: layer.chamferSize ?? '',
                            svgFootprintName: layer.svgFootprintName ?? '',
                        },
                    });
                }
            }
            return records;
        },
        create(_values) {
            return null;
        },
        remove(_id) {
            return false;
        },
    };
}

function enumAdapter(typeId: string): RecordAdapter {
    return {
        read() {
            const dt = getDataType(typeId);
            if (!dt) return [];
            return dt.fields.map(f => ({
                id: f.key,
                values: { key: f.key, label: f.label },
            }));
        },
        create(_values) { return null; },
        remove(_id) { return false; },
    };
}

const ENUM_TYPE_IDS = new Set([
    'base-shape', 'component-category', 'component-collection',
    'icon-scope', 'icon-source', 'shape-style', 'color-token',
]);

const adapters: Record<string, () => RecordAdapter> = {
    'node': nodeAdapter,
    'connection': connectionAdapter,
    'zone': zoneAdapter,
    'shape': shapeAdapter,
    'component': componentAdapter,
    'shape-layer': shapeLayerAdapter,
};

export function getRecords(typeId: string): AppRecord[] {
    const factory = adapters[typeId];
    if (factory) return factory().read();
    if (ENUM_TYPE_IDS.has(typeId)) return enumAdapter(typeId).read();
    return [];
}

export function createRecord(typeId: string, values: Record<string, unknown>): AppRecord | null {
    const factory = adapters[typeId];
    if (!factory) return null;
    return factory().create(values);
}

export function deleteRecord(typeId: string, id: string): boolean {
    const factory = adapters[typeId];
    if (!factory) return false;
    return factory().remove(id);
}

export function canCreate(typeId: string): boolean {
    return typeId === 'node' || typeId === 'zone' || typeId === 'shape' || typeId === 'component';
}

export function canDelete(typeId: string): boolean {
    return typeId === 'node' || typeId === 'connection' || typeId === 'zone'
        || typeId === 'shape' || typeId === 'component';
}
