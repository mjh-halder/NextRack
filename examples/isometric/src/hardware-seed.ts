import { saveProduct, getProduct, ProductEntry } from './product-catalog';

const SEED_KEY = 'nextrack-hw-seed-v2';

function seed(entries: ProductEntry[]): void {
    for (const e of entries) {
        if (!getProduct(e.id)) saveProduct(e);
    }
}

export function ensureHardwareSeed(): void {
    if (localStorage.getItem(SEED_KEY)) return;
    localStorage.setItem(SEED_KEY, '1');

    // ── CPU Families ─────────────────────────────────────────────────────────
    seed([
        { id: 'cpu-xeon6', componentType: 'cpu-family', values: {
            name: 'Intel Xeon 6', vendor: 'Intel', generation: 'Granite Rapids / Sierra Forest',
            socket: 'LGA 4710', coreCountMin: 8, coreCountMax: 144, architecture: 'x86_64',
            notes: 'Covers both E-core (Sierra Forest) and P-core (Granite Rapids) variants.',
        }},
        { id: 'cpu-xeon6-6900p', componentType: 'cpu-family', values: {
            name: 'Intel Xeon 6 6900-series P-core', vendor: 'Intel', generation: 'Granite Rapids AP',
            socket: 'LGA 7529', coreCountMin: 72, coreCountMax: 128, architecture: 'x86_64',
            notes: 'High-core-count P-core variant for R770AP and similar platforms.',
        }},
        { id: 'cpu-epyc9005', componentType: 'cpu-family', values: {
            name: 'AMD EPYC 9005', vendor: 'AMD', generation: 'Turin',
            socket: 'SP6', coreCountMin: 8, coreCountMax: 192, architecture: 'x86_64',
            notes: 'AMD EPYC 9005 series (Turin). Supports DDR5, PCIe Gen 5, CXL 2.0.',
        }},
    ]);

    // ── Memory Specs ─────────────────────────────────────────────────────────
    seed([
        { id: 'mem-ddr5-rdimm-16slot', componentType: 'memory-spec', values: {
            name: 'DDR5 RDIMM 16-slot', memoryType: 'DDR5', formFactor: 'RDIMM',
            allowedDimmSizes: '16,32,64,128,256', dimmSlots: 16, maxMemoryTB: 4,
            speedMHz: 6400, ecc: 'Yes',
            populationRules: 'Populate in pairs starting from the farthest slot from the CPU.',
            notes: 'Standard DDR5 RDIMM config for single/dual socket Intel platforms with 16 DIMMs.',
        }},
        { id: 'mem-ddr5-rdimm-24slot', componentType: 'memory-spec', values: {
            name: 'DDR5 RDIMM 24-slot', memoryType: 'DDR5', formFactor: 'RDIMM',
            allowedDimmSizes: '16,32,64,128,256', dimmSlots: 24, maxMemoryTB: 6,
            speedMHz: 6000, ecc: 'Yes',
            populationRules: 'Populate in sets of 6 (one per channel). 12 channels per socket.',
            notes: 'DDR5 RDIMM for AMD EPYC 9005 platforms and Intel Xeon 6 6900-series AP.',
        }},
        { id: 'mem-ddr5-rdimm-32slot', componentType: 'memory-spec', values: {
            name: 'DDR5 RDIMM 32-slot', memoryType: 'DDR5', formFactor: 'RDIMM',
            allowedDimmSizes: '16,32,64,128,256', dimmSlots: 32, maxMemoryTB: 8,
            speedMHz: 6400, ecc: 'Yes',
            populationRules: 'Populate in pairs, balanced across both CPUs.',
            notes: 'DDR5 RDIMM for dual-socket Intel Xeon 6 platforms (R670, R770).',
        }},
    ]);

    // ── Server Models (Intel) ────────────────────────────────────────────────
    seed([
        { id: 'sm-r470', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R470', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R470',
            formFactor: 'Rack', rackUnits: 1, cpuVendor: 'Intel', socketCount: 1,
            supportedCpuFamilyIds: 'cpu-xeon6', dimmSlots: 16, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 1, supportedMemorySpecIds: 'mem-ddr5-rdimm-16slot',
            notes: '1U single-socket Intel entry server.',
        }},
        { id: 'sm-r570', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R570', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R570',
            formFactor: 'Rack', rackUnits: 1, cpuVendor: 'Intel', socketCount: 1,
            supportedCpuFamilyIds: 'cpu-xeon6', dimmSlots: 16, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 4, supportedMemorySpecIds: 'mem-ddr5-rdimm-16slot',
            notes: '1U single-socket. Max 1 TB with E-core, 4 TB with P-core configurations.',
        }},
        { id: 'sm-r670', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R670', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R670',
            formFactor: 'Rack', rackUnits: 1, cpuVendor: 'Intel', socketCount: 2,
            supportedCpuFamilyIds: 'cpu-xeon6', dimmSlots: 32, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 8, supportedMemorySpecIds: 'mem-ddr5-rdimm-32slot',
            notes: '1U dual-socket Intel platform.',
        }},
        { id: 'sm-r770', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R770', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R770',
            formFactor: 'Rack', rackUnits: 2, cpuVendor: 'Intel', socketCount: 2,
            supportedCpuFamilyIds: 'cpu-xeon6', dimmSlots: 32, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 8, supportedMemorySpecIds: 'mem-ddr5-rdimm-32slot',
            notes: '2U dual-socket Intel flagship.',
        }},
        { id: 'sm-r770ap', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R770AP', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R770AP',
            formFactor: 'Rack', rackUnits: 2, cpuVendor: 'Intel', socketCount: 2,
            supportedCpuFamilyIds: 'cpu-xeon6-6900p', dimmSlots: 24, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 3, supportedMemorySpecIds: 'mem-ddr5-rdimm-24slot',
            notes: '2U dual-socket with Xeon 6 6900-series P-core (AP platform).',
        }},
    ]);

    // ── Server Models (AMD) ──────────────────────────────────────────────────
    seed([
        { id: 'sm-r6715', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R6715', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R6715',
            formFactor: 'Rack', rackUnits: 1, cpuVendor: 'AMD', socketCount: 1,
            supportedCpuFamilyIds: 'cpu-epyc9005', dimmSlots: 24, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 6, supportedMemorySpecIds: 'mem-ddr5-rdimm-24slot',
            notes: '1U single-socket AMD EPYC 9005.',
        }},
        { id: 'sm-r7715', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R7715', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R7715',
            formFactor: 'Rack', rackUnits: 2, cpuVendor: 'AMD', socketCount: 1,
            supportedCpuFamilyIds: 'cpu-epyc9005', dimmSlots: 24, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 6, supportedMemorySpecIds: 'mem-ddr5-rdimm-24slot',
            notes: '2U single-socket AMD EPYC 9005.',
        }},
        { id: 'sm-r6725', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R6725', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R6725',
            formFactor: 'Rack', rackUnits: 1, cpuVendor: 'AMD', socketCount: 2,
            supportedCpuFamilyIds: 'cpu-epyc9005', dimmSlots: 24, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 6, supportedMemorySpecIds: 'mem-ddr5-rdimm-24slot',
            notes: '1U dual-socket AMD EPYC 9005.',
        }},
        { id: 'sm-r7725', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R7725', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R7725',
            formFactor: 'Rack', rackUnits: 2, cpuVendor: 'AMD', socketCount: 2,
            supportedCpuFamilyIds: 'cpu-epyc9005', dimmSlots: 24, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 6.14, supportedMemorySpecIds: 'mem-ddr5-rdimm-24slot',
            notes: '2U dual-socket AMD EPYC 9005 flagship.',
        }},
        { id: 'sm-r7725xd', componentType: 'server-model', values: {
            name: 'Dell PowerEdge R7725xd', vendor: 'Dell', productFamily: 'PowerEdge', modelName: 'R7725xd',
            formFactor: 'Rack', rackUnits: 2, cpuVendor: 'AMD', socketCount: 2,
            supportedCpuFamilyIds: 'cpu-epyc9005', dimmSlots: 24, memoryType: 'DDR5 RDIMM',
            maxMemoryTB: 3, supportedMemorySpecIds: 'mem-ddr5-rdimm-24slot',
            notes: '2U dual-socket AMD EPYC 9005 extended density.',
        }},
    ]);

    // ── Compatibility Rules ──────────────────────────────────────────────────
    // Generate rules for each server model
    const models = [
        { id: 'sm-r470',    vendor: 'Intel', cpuFamilies: ['cpu-xeon6'],       sockets: 1, dimms: 16, maxTB: 1,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r570',    vendor: 'Intel', cpuFamilies: ['cpu-xeon6'],       sockets: 1, dimms: 16, maxTB: 4,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r670',    vendor: 'Intel', cpuFamilies: ['cpu-xeon6'],       sockets: 2, dimms: 32, maxTB: 8,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r770',    vendor: 'Intel', cpuFamilies: ['cpu-xeon6'],       sockets: 2, dimms: 32, maxTB: 8,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r770ap',  vendor: 'Intel', cpuFamilies: ['cpu-xeon6-6900p'], sockets: 2, dimms: 24, maxTB: 3,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r6715',   vendor: 'AMD',   cpuFamilies: ['cpu-epyc9005'],    sockets: 1, dimms: 24, maxTB: 6,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r7715',   vendor: 'AMD',   cpuFamilies: ['cpu-epyc9005'],    sockets: 1, dimms: 24, maxTB: 6,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r6725',   vendor: 'AMD',   cpuFamilies: ['cpu-epyc9005'],    sockets: 2, dimms: 24, maxTB: 6,    memType: 'DDR5 RDIMM' },
        { id: 'sm-r7725',   vendor: 'AMD',   cpuFamilies: ['cpu-epyc9005'],    sockets: 2, dimms: 24, maxTB: 6.14, memType: 'DDR5 RDIMM' },
        { id: 'sm-r7725xd', vendor: 'AMD',   cpuFamilies: ['cpu-epyc9005'],    sockets: 2, dimms: 24, maxTB: 3,    memType: 'DDR5 RDIMM' },
    ];

    const rules: ProductEntry[] = [];
    let ruleIdx = 0;

    for (const m of models) {
        const modelLabel = m.id.replace('sm-', '').toUpperCase();

        rules.push({ id: `rule-${ruleIdx++}`, componentType: 'compatibility-rule', values: {
            name: `${modelLabel} CPU vendor`, ruleScope: 'server_model',
            sourceEntityType: 'ServerModel', sourceEntityId: m.id,
            targetEntityType: 'Configuration', targetField: 'cpuVendor',
            operator: 'equals', value: m.vendor, severity: 'error',
            message: `${modelLabel} requires ${m.vendor} CPUs.`, isActive: 'true',
        }});

        rules.push({ id: `rule-${ruleIdx++}`, componentType: 'compatibility-rule', values: {
            name: `${modelLabel} CPU family`, ruleScope: 'server_model',
            sourceEntityType: 'ServerModel', sourceEntityId: m.id,
            targetEntityType: 'Configuration', targetField: 'cpuFamilyId',
            operator: 'in', value: m.cpuFamilies.join(','), severity: 'error',
            message: `${modelLabel} only supports: ${m.cpuFamilies.join(', ')}.`, isActive: 'true',
        }});

        rules.push({ id: `rule-${ruleIdx++}`, componentType: 'compatibility-rule', values: {
            name: `${modelLabel} max sockets`, ruleScope: 'server_model',
            sourceEntityType: 'ServerModel', sourceEntityId: m.id,
            targetEntityType: 'Configuration', targetField: 'socketCount',
            operator: '<=', value: String(m.sockets), severity: 'error',
            message: `${modelLabel} has max ${m.sockets} CPU socket(s).`, isActive: 'true',
        }});

        rules.push({ id: `rule-${ruleIdx++}`, componentType: 'compatibility-rule', values: {
            name: `${modelLabel} max DIMMs`, ruleScope: 'server_model',
            sourceEntityType: 'ServerModel', sourceEntityId: m.id,
            targetEntityType: 'Configuration', targetField: 'dimmCount',
            operator: '<=', value: String(m.dimms), severity: 'error',
            message: `${modelLabel} has max ${m.dimms} DIMM slots.`, isActive: 'true',
        }});

        rules.push({ id: `rule-${ruleIdx++}`, componentType: 'compatibility-rule', values: {
            name: `${modelLabel} max RAM`, ruleScope: 'server_model',
            sourceEntityType: 'ServerModel', sourceEntityId: m.id,
            targetEntityType: 'Configuration', targetField: 'totalMemoryTB',
            operator: '<=', value: String(m.maxTB), severity: 'error',
            message: `${modelLabel} supports max ${m.maxTB} TB RAM.`, isActive: 'true',
        }});

        rules.push({ id: `rule-${ruleIdx++}`, componentType: 'compatibility-rule', values: {
            name: `${modelLabel} memory type`, ruleScope: 'server_model',
            sourceEntityType: 'ServerModel', sourceEntityId: m.id,
            targetEntityType: 'Configuration', targetField: 'memoryType',
            operator: 'equals', value: m.memType, severity: 'error',
            message: `${modelLabel} requires ${m.memType}.`, isActive: 'true',
        }});
    }

    seed(rules);
}
