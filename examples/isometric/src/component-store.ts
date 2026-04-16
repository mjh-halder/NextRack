export type ComponentCategory = 'general' | 'user';

export interface ComponentDefinition {
    id: string;
    name: string;
    category: ComponentCategory;
    shapeId: string;
    properties: Record<string, unknown>;
}

interface ComponentStore {
    list(category: ComponentCategory): ComponentDefinition[];
    get(category: ComponentCategory, id: string): ComponentDefinition | undefined;
    save(component: ComponentDefinition): void;
    remove(category: ComponentCategory, id: string): void;
}

const STORAGE_KEYS: Record<ComponentCategory, string> = {
    general: 'nextrack-components-general-v1',
    user: 'nextrack-components-user-v1',
};

function readCollection(category: ComponentCategory): ComponentDefinition[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS[category]);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCollection(category: ComponentCategory, components: ComponentDefinition[]): void {
    try {
        localStorage.setItem(STORAGE_KEYS[category], JSON.stringify(components));
    } catch (e) {
        console.error(`[nextrack] Failed to save ${category} components:`, e);
    }
}

function list(category: ComponentCategory): ComponentDefinition[] {
    return readCollection(category);
}

function get(category: ComponentCategory, id: string): ComponentDefinition | undefined {
    return readCollection(category).find(c => c.id === id);
}

function save(component: ComponentDefinition): void {
    const { category, id } = component;
    const components = readCollection(category).filter(c => c.id !== id);
    components.push(structuredClone(component));
    writeCollection(category, components);
}

function remove(category: ComponentCategory, id: string): void {
    writeCollection(category, readCollection(category).filter(c => c.id !== id));
}

export const componentStore: ComponentStore = { list, get, save, remove };
