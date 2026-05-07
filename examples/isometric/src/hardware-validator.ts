import { getProductsByType, ProductEntry } from './product-catalog';

export interface ValidationResult {
    ruleId: string;
    ruleName: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    field: string;
    actualValue: unknown;
    expectedValue: string;
}

export interface ServerConfiguration {
    serverModelId: string;
    cpuVendor?: string;
    cpuFamilyId?: string;
    socketCount?: number;
    dimmCount?: number;
    totalMemoryTB?: number;
    memoryType?: string;
}

/**
 * Validates a server configuration against all active compatibility rules
 * for the given server model.
 */
export function validateConfiguration(config: ServerConfiguration): ValidationResult[] {
    const results: ValidationResult[] = [];
    const rules = getProductsByType('compatibility-rule');

    const activeRules = rules.filter(r =>
        r.values.isActive === 'true' &&
        r.values.sourceEntityId === config.serverModelId
    );

    for (const rule of activeRules) {
        const field = rule.values.targetField as string;
        const operator = rule.values.operator as string;
        const expected = rule.values.value as string;
        const severity = (rule.values.severity as string) || 'error';
        const message = (rule.values.message as string) || `Validation failed for ${field}`;

        const actual = (config as unknown as Record<string, unknown>)[field];
        if (actual == null || actual === '') continue;

        const passed = evaluateRule(actual, operator, expected);

        if (!passed) {
            results.push({
                ruleId: rule.id,
                ruleName: (rule.values.name as string) || '',
                severity: severity as 'error' | 'warning' | 'info',
                message,
                field,
                actualValue: actual,
                expectedValue: expected,
            });
        }
    }

    return results;
}

function evaluateRule(actual: unknown, operator: string, expected: string): boolean {
    switch (operator) {
        case 'equals':
            return String(actual) === expected;

        case 'not_equals':
            return String(actual) !== expected;

        case 'in': {
            const allowed = expected.split(',').map(s => s.trim());
            return allowed.includes(String(actual));
        }

        case '<=':
            return Number(actual) <= Number(expected);

        case '>=':
            return Number(actual) >= Number(expected);

        case '<':
            return Number(actual) < Number(expected);

        case '>':
            return Number(actual) > Number(expected);

        default:
            return true;
    }
}

/**
 * Convenience: validate and return only errors (not warnings/info).
 */
export function getConfigurationErrors(config: ServerConfiguration): ValidationResult[] {
    return validateConfiguration(config).filter(r => r.severity === 'error');
}

/**
 * Quick check: is a configuration valid (no errors)?
 */
export function isConfigurationValid(config: ServerConfiguration): boolean {
    return getConfigurationErrors(config).length === 0;
}

/**
 * Get all server models from the catalog.
 */
export function getServerModels(): ProductEntry[] {
    return getProductsByType('server-model');
}

/**
 * Get CPU families compatible with a server model.
 */
export function getCompatibleCpuFamilies(serverModelId: string): ProductEntry[] {
    const model = getProductsByType('server-model').find(m => m.id === serverModelId);
    if (!model) return [];
    const ids = String(model.values.supportedCpuFamilyIds ?? '').split(',').filter(Boolean);
    const allCpus = getProductsByType('cpu-family');
    return allCpus.filter(c => ids.includes(c.id));
}

/**
 * Get memory specs compatible with a server model.
 */
export function getCompatibleMemorySpecs(serverModelId: string): ProductEntry[] {
    const model = getProductsByType('server-model').find(m => m.id === serverModelId);
    if (!model) return [];
    const ids = String(model.values.supportedMemorySpecIds ?? '').split(',').filter(Boolean);
    const allMem = getProductsByType('memory-spec');
    return allMem.filter(m => ids.includes(m.id));
}
