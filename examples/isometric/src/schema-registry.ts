export type FieldType = 'text' | 'number' | 'boolean' | 'select';

export interface FieldDefinition {
    key: string;
    label: string;
    type: FieldType;
    system: boolean;
    placeholder?: string;
    multiline?: boolean;
    options?: string[];
    /** For cross-entity references: the entity type whose IDs populate this field. */
    refEntityType?: string;
}

export type DataTypeKind = 'data-type' | 'option-set';

export interface DataTypeDefinition {
    id: string;
    label: string;
    description: string;
    system: boolean;
    kind: DataTypeKind;
    fields: FieldDefinition[];
}

const STORAGE_KEY = 'nextrack-schema-registry-v1';

const BUILT_IN_TYPES: DataTypeDefinition[] = [
    {
        id: 'node',
        label: 'Node',
        description: 'Components placed on the canvas — servers, switches, firewalls, etc.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',                  label: 'ID',                type: 'text',    system: true },
            { key: 'name',                label: 'Name',              type: 'text',    system: true },
            { key: 'shapeType',           label: 'Shape Type',        type: 'text',    system: true },
            { key: 'serverId',            label: 'Server',            type: 'text',    system: true },
            { key: 'notes',               label: 'Notes',             type: 'text',    system: true, multiline: true },
            { key: 'position.x',          label: 'Position X',        type: 'number',  system: true },
            { key: 'position.y',          label: 'Position Y',        type: 'number',  system: true },
            { key: 'size.width',          label: 'Width',             type: 'number',  system: true },
            { key: 'size.height',         label: 'Height',            type: 'number',  system: true },
            { key: 'isometricHeight',     label: 'Isometric Height',  type: 'number',  system: true },
            { key: 'z',                   label: 'Z-Index',           type: 'number',  system: true },
            { key: 'componentRole',       label: 'Component Role',    type: 'select',  system: true, options: ['base', 'child'] },
            { key: 'ports',               label: 'Ports',             type: 'text',    system: true },
        ],
    },
    {
        id: 'server',
        label: 'Server',
        description: 'Server hardware specification.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',           label: 'ID',             type: 'text',   system: true },
            { key: 'name',         label: 'Name',           type: 'text',   system: true },
            { key: 'vendor',       label: 'Vendor',         type: 'text',   system: true, placeholder: 'e.g. Dell, HPE' },
            { key: 'model',        label: 'Model',          type: 'text',   system: true, placeholder: 'e.g. PowerEdge R770' },
            { key: 'formFactor',   label: 'Form Factor',    type: 'text',   system: true, placeholder: 'e.g. 2U Rack' },
            { key: 'cpuVendor',    label: 'CPU Vendor',     type: 'text',   system: true, placeholder: 'e.g. Intel, AMD' },
            { key: 'cpuFamily',    label: 'CPU Family',     type: 'text',   system: true, placeholder: 'e.g. Xeon 6, EPYC 9005' },
            { key: 'socketCount',  label: 'CPU Sockets',    type: 'number', system: true },
            { key: 'coresPerCpu',  label: 'Cores per CPU',  type: 'number', system: true },
            { key: 'ram',          label: 'RAM (GB)',        type: 'number', system: true },
            { key: 'dimmSlots',    label: 'DIMM Slots',     type: 'number', system: true },
            { key: 'maxRamGB',     label: 'Max RAM (GB)',    type: 'number', system: true },
            { key: 'storageGB',    label: 'Storage (GB)',    type: 'number', system: true },
            { key: 'nicProduct',   label: 'NIC',             type: 'text',   system: true },
            { key: 'maxPower',     label: 'Max Power (W)',   type: 'number', system: true },
        ],
    },
    {
        id: 'firewall',
        label: 'Firewall',
        description: 'Firewall appliance specification — throughput, interfaces, and security features.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',                type: 'text',    system: true },
            { key: 'name',            label: 'Name',              type: 'text',    system: true },
            { key: 'vendor',          label: 'Vendor',            type: 'text',    system: true },
            { key: 'model',           label: 'Model',             type: 'text',    system: true },
            { key: 'throughput',      label: 'Throughput (Gbps)', type: 'number',  system: true },
            { key: 'interfaces',      label: 'Interfaces',        type: 'number',  system: true },
            { key: 'ha',              label: 'HA Support',        type: 'select',  system: true, options: ['yes', 'no'] },
            { key: 'formFactor',      label: 'Form Factor',       type: 'text',    system: true },
            { key: 'maxPower',        label: 'Max Power (W)',     type: 'number',  system: true },
        ],
    },
    {
        id: 'switch',
        label: 'Switch',
        description: 'Network switch specification — ports, bandwidth, and switching features.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',                type: 'text',    system: true },
            { key: 'name',            label: 'Name',              type: 'text',    system: true },
            { key: 'vendor',          label: 'Vendor',            type: 'text',    system: true },
            { key: 'model',           label: 'Model',             type: 'text',    system: true },
            { key: 'portCount',       label: 'Port Count',        type: 'number',  system: true },
            { key: 'portSpeed',       label: 'Port Speed (Gbps)', type: 'number',  system: true },
            { key: 'uplinkSpeed',     label: 'Uplink Speed (Gbps)', type: 'number', system: true },
            { key: 'layer',           label: 'Layer',             type: 'select',  system: true, options: ['L2', 'L3', 'L2/L3'] },
            { key: 'stackable',       label: 'Stackable',         type: 'select',  system: true, options: ['yes', 'no'] },
            { key: 'formFactor',      label: 'Form Factor',       type: 'text',    system: true },
            { key: 'maxPower',        label: 'Max Power (W)',     type: 'number',  system: true },
        ],
    },
    {
        id: 'storage',
        label: 'Storage',
        description: 'Storage system specification — capacity, IOPS, and connectivity.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',                type: 'text',    system: true },
            { key: 'name',            label: 'Name',              type: 'text',    system: true },
            { key: 'vendor',          label: 'Vendor',            type: 'text',    system: true },
            { key: 'model',           label: 'Model',             type: 'text',    system: true },
            { key: 'capacityTB',      label: 'Capacity (TB)',     type: 'number',  system: true },
            { key: 'mediaType',       label: 'Media Type',        type: 'select',  system: true, options: ['SSD', 'HDD', 'NVMe', 'Hybrid'] },
            { key: 'iops',            label: 'IOPS',              type: 'number',  system: true },
            { key: 'interface',       label: 'Interface',         type: 'select',  system: true, options: ['SAS', 'SATA', 'NVMe', 'FC', 'iSCSI'] },
            { key: 'raidLevels',      label: 'RAID Levels',       type: 'text',    system: true },
            { key: 'formFactor',      label: 'Form Factor',       type: 'text',    system: true },
            { key: 'maxPower',        label: 'Max Power (W)',     type: 'number',  system: true },
        ],
    },
    {
        id: 'nic',
        label: 'NIC',
        description: 'Network interface card specification — bandwidth, ports, and offload features.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',                type: 'text',    system: true },
            { key: 'name',            label: 'Name',              type: 'text',    system: true },
            { key: 'vendor',          label: 'Vendor',            type: 'text',    system: true },
            { key: 'model',           label: 'Model',             type: 'text',    system: true },
            { key: 'portCount',       label: 'Port Count',        type: 'number',  system: true },
            { key: 'portSpeed',       label: 'Port Speed (Gbps)', type: 'number',  system: true },
            { key: 'medium',          label: 'Medium',            type: 'select',  system: true, options: ['Copper', 'Fiber', 'SFP+', 'QSFP'] },
            { key: 'busType',         label: 'Bus Type',          type: 'select',  system: true, options: ['PCIe 3.0', 'PCIe 4.0', 'PCIe 5.0'] },
            { key: 'offload',         label: 'Offload',           type: 'select',  system: true, options: ['none', 'TCP', 'RDMA', 'SR-IOV'] },
            { key: 'maxPower',        label: 'Max Power (W)',     type: 'number',  system: true },
        ],
    },
    {
        id: 'stretch-cluster',
        label: 'Stretch Cluster',
        description: 'A group of zones connected via zone-to-zone links, representing a stretched infrastructure cluster.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',                type: 'text',    system: true },
            { key: 'name',            label: 'Name',              type: 'text',    system: true },
            { key: 'zoneCount',       label: 'Zones',             type: 'number',  system: true },
            { key: 'totalNodes',      label: 'Total Nodes',       type: 'number',  system: true },
            { key: 'totalCpuCount',   label: 'Total CPUs',        type: 'number',  system: true },
            { key: 'totalCoreCount',  label: 'Total Cores',       type: 'number',  system: true },
            { key: 'totalRamGB',      label: 'Total RAM (GB)',    type: 'number',  system: true },
            { key: 'totalStorageGB',  label: 'Total Storage (GB)', type: 'number', system: true },
            { key: 'totalMaxPower',   label: 'Total Max Power (W)', type: 'number', system: true },
        ],
    },
    {
        id: 'connection',
        label: 'Connection',
        description: 'Links between nodes — cables, fibers, wireless links.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'linkType',   label: 'Link Type',   type: 'select',  system: true, options: ['Host Access', 'Cluster Link'] },
            { key: 'id',         label: 'ID',          type: 'text', system: true },
            { key: 'bandwidth',  label: 'Bandwidth',   type: 'text', system: true, placeholder: 'e.g. 10Gbps' },
            { key: 'medium',     label: 'Medium',      type: 'text', system: true, placeholder: 'e.g. fiber' },
            { key: 'encryption', label: 'Encryption',  type: 'text', system: true, placeholder: 'e.g. TLS' },
            { key: 'sourceId',   label: 'Source Node',  type: 'text', system: true },
            { key: 'targetId',   label: 'Target Node',  type: 'text', system: true },
            { key: 'sourcePort', label: 'Source Port',  type: 'select', system: true, options: ['front', 'back', 'left', 'right'] },
            { key: 'targetPort', label: 'Target Port',  type: 'select', system: true, options: ['front', 'back', 'left', 'right'] },
            { key: 'vertices',   label: 'Vertices',    type: 'text', system: true },
            { key: 'labels',     label: 'Labels',      type: 'text', system: true },
        ],
    },
    {
        id: 'zone',
        label: 'Zone',
        description: 'Grouping areas on the canvas — racks, rooms, security zones.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',            label: 'ID',             type: 'text',   system: true },
            { key: 'name',          label: 'Zone Name',      type: 'text',   system: true },
            { key: 'color',         label: 'Color',          type: 'text',   system: true },
            { key: 'labelPosition', label: 'Label Position', type: 'select', system: true, options: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] },
            { key: 'isFrame',       label: 'Is Frame',       type: 'boolean', system: true },
            { key: 'position.x',    label: 'Position X',     type: 'number', system: true },
            { key: 'position.y',    label: 'Position Y',     type: 'number', system: true },
            { key: 'size.width',    label: 'Width',          type: 'number', system: true },
            { key: 'size.height',   label: 'Height',         type: 'number', system: true },
            { key: 'z',             label: 'Z-Index',        type: 'number', system: true },
            { key: 'embeddedCells', label: 'Embedded Cells', type: 'text',   system: true },
        ],
    },
    {
        id: 'shape',
        label: 'Shape',
        description: 'Visual templates — geometry, size, icon, and style for rendered components.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',                     label: 'ID',                type: 'text',    system: true },
            { key: 'displayName',            label: 'Display Name',      type: 'text',    system: true },
            { key: 'componentType',          label: 'Component Type',    type: 'select',  system: true, options: ['Server', 'Firewall', 'Switch', 'Storage', 'NIC'] },
            { key: 'baseShape',              label: 'Base Shape',        type: 'select',  system: true, options: ['cuboid', 'cylinder', 'tube', 'pipe', 'duct', 'channel', 'pyramid', 'octagon', 'hexahedron', 'custom'] },
            { key: 'defaultSize.width',      label: 'Default Width',     type: 'number',  system: true },
            { key: 'defaultSize.height',     label: 'Default Height',    type: 'number',  system: true },
            { key: 'defaultIsometricHeight', label: 'Isometric Height',  type: 'number',  system: true },
            { key: 'collection',             label: 'Collection',        type: 'text',    system: true },
            { key: 'icon',                   label: 'Icon',              type: 'text',    system: true },
            { key: 'iconFace',               label: 'Icon Face',         type: 'select',  system: true, options: ['top', 'front', 'side'] },
            { key: 'iconSize',               label: 'Icon Size',         type: 'number',  system: true },
            { key: 'iconBgColor',            label: 'Icon BG Color',     type: 'text',    system: true },
            { key: 'iconBgShape',            label: 'Icon BG Shape',     type: 'select',  system: true, options: ['circle', 'square', 'octagon'] },
            { key: 'iconBgRadius',           label: 'Icon BG Radius',   type: 'number',  system: true },
            { key: 'iconHref',               label: 'Icon Href',        type: 'text',    system: true },
            { key: 'iconLayerIndex',         label: 'Icon Layer Index',  type: 'number',  system: true },
            { key: 'complexShape',           label: 'Complex Shape',     type: 'boolean', system: true },
            { key: 'layers',                 label: 'Layers',            type: 'text',    system: true },
            { key: 'cornerRadius',           label: 'Corner Radius',     type: 'number',  system: true },
            { key: 'chamferSize',            label: 'Chamfer Size',      type: 'number',  system: true },
        ],
    },
    {
        id: 'component',
        label: 'Component',
        description: 'Domain-level components — link a shape template to a named, categorized entity.',
        system: true,
        kind: 'data-type',
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
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',              type: 'text',   system: true },
            { key: 'name',            label: 'Name',            type: 'text',   system: true },
            { key: 'baseShape',       label: 'Base Shape',      type: 'select', system: true, options: ['cuboid', 'cylinder', 'tube', 'pipe', 'duct', 'channel', 'pyramid', 'octagon', 'hexahedron', 'custom'] },
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
        id: 'canvas',
        label: 'Canvas',
        description: 'A diagram canvas — infrastructure or application workload view.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',          label: 'ID',            type: 'text',   system: true },
            { key: 'name',        label: 'Name',          type: 'text',   system: true },
            { key: 'canvasType',  label: 'Canvas Type',   type: 'select', system: true, options: ['Infra_Logical', 'Infra_Physical', 'App_Workload'] },
            { key: 'projectId',   label: 'Project',       type: 'text',   system: true },
            { key: 'author',      label: 'Author',        type: 'text',   system: true },
            { key: 'createdAt',   label: 'Created',       type: 'text',   system: true },
            { key: 'updatedAt',   label: 'Updated',       type: 'text',   system: true },
        ],
    },
    {
        id: 'project',
        label: 'Project',
        description: 'A project grouping one or more canvases.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',          label: 'ID',            type: 'text',   system: true },
            { key: 'name',        label: 'Name',          type: 'text',   system: true },
            { key: 'description', label: 'Description',   type: 'text',   system: true },
            { key: 'createdAt',   label: 'Created',       type: 'text',   system: true },
        ],
    },
    {
        id: 'product',
        label: 'Product',
        description: 'Hardware product catalog — servers, NICs, switches, storage, and other infrastructure components.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',              label: 'ID',               type: 'text',   system: true },
            { key: 'name',            label: 'Name',             type: 'text',   system: true },
            { key: 'vendor',          label: 'Vendor',           type: 'text',   system: true },
            { key: 'sku',             label: 'SKU',              type: 'text',   system: true },
            { key: 'productCategory', label: 'Category',         type: 'select', system: true, options: ['Server', 'NIC', 'Switch', 'Router', 'Firewall', 'Storage_Array', 'Storage_Controller', 'PSU', 'CPU', 'Memory', 'HBA', 'Cable', 'Chassis', 'Optical_Transceiver', 'GPU'] },
            { key: 'formFactor',      label: 'Form Factor',      type: 'text',   system: true },
            { key: 'description',     label: 'Description',      type: 'text',   system: true, multiline: true },
            { key: 'releaseYear',     label: 'Release Year',     type: 'number', system: true },
            { key: 'endOfLife',       label: 'End of Life',      type: 'boolean', system: true },
            { key: 'maxPower',        label: 'Max Power (W)',    type: 'number', system: true },
            { key: 'weight',          label: 'Weight (kg)',      type: 'number', system: true },
        ],
    },
    {
        id: 'canvas-type',
        label: 'Canvas Type',
        description: 'The kind of diagram a canvas represents.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Infra_Logical',  label: 'Infra Logical',  type: 'text', system: true },
            { key: 'Infra_Physical', label: 'Infra Physical', type: 'text', system: true },
            { key: 'App_Workload',   label: 'App Workload',   type: 'text', system: true },
        ],
    },
    {
        id: 'application',
        label: 'Application',
        description: 'An application workload with resource requirements.',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'id',           label: 'ID',              type: 'text',   system: true },
            { key: 'name',         label: 'Name',             type: 'text',   system: true },
            { key: 'serverCount',  label: 'Servers',          type: 'number', system: true },
            { key: 'cpuCores',     label: 'CPU Cores',        type: 'number', system: true },
            { key: 'ram',          label: 'RAM (GB)',         type: 'number', system: true },
            { key: 'serviceLevel', label: 'Service Level',    type: 'select', system: true, options: ['Gold', 'Silver', 'Bronze'] },
        ],
    },
    {
        id: 'deployment-model',
        label: 'Deployment Model',
        description: 'How the application is deployed.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Containerized',    label: 'Containerized',    type: 'text', system: true },
            { key: 'Virtual Machine',  label: 'Virtual Machine',  type: 'text', system: true },
            { key: 'Bare Metal',       label: 'Bare Metal',       type: 'text', system: true },
        ],
    },
    {
        id: 'operating-system',
        label: 'Operating System',
        description: 'Target operating system for the application.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Linux',   label: 'Linux',   type: 'text', system: true },
            { key: 'Windows', label: 'Windows', type: 'text', system: true },
            { key: 'Other',   label: 'Other',   type: 'text', system: true },
        ],
    },
    {
        id: 'app-server',
        label: 'Application Server',
        description: 'Application server technology.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'None',              label: 'None',              type: 'text', system: true },
            { key: 'Tomcat',            label: 'Tomcat',            type: 'text', system: true },
            { key: 'JBoss / WildFly',   label: 'JBoss / WildFly',  type: 'text', system: true },
            { key: 'Nginx',             label: 'Nginx',             type: 'text', system: true },
            { key: 'Apache HTTP Server', label: 'Apache HTTP Server', type: 'text', system: true },
            { key: 'IIS',               label: 'IIS',               type: 'text', system: true },
            { key: 'Other',             label: 'Other',             type: 'text', system: true },
        ],
    },
    {
        id: 'database-technology',
        label: 'Database Technology',
        description: 'Database engine used by the application.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'None',                label: 'None',                type: 'text', system: true },
            { key: 'PostgreSQL',           label: 'PostgreSQL',          type: 'text', system: true },
            { key: 'MySQL',               label: 'MySQL',               type: 'text', system: true },
            { key: 'MariaDB',             label: 'MariaDB',             type: 'text', system: true },
            { key: 'Oracle',              label: 'Oracle',              type: 'text', system: true },
            { key: 'Microsoft SQL Server', label: 'Microsoft SQL Server', type: 'text', system: true },
            { key: 'MongoDB',             label: 'MongoDB',             type: 'text', system: true },
            { key: 'Other',               label: 'Other',               type: 'text', system: true },
        ],
    },
    {
        id: 'storage-type',
        label: 'Storage Type',
        description: 'Kind of storage attached to an application.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'File Storage',   label: 'File Storage',   type: 'text', system: true },
            { key: 'Block Storage',  label: 'Block Storage',  type: 'text', system: true },
            { key: 'Object Storage', label: 'Object Storage', type: 'text', system: true },
        ],
    },
    {
        id: 'replication-level',
        label: 'Replication Level',
        description: 'How many times the application is replicated.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: '1x', label: '1x', type: 'text', system: true },
            { key: '2x', label: '2x', type: 'text', system: true },
            { key: '3x', label: '3x', type: 'text', system: true },
            { key: '4x', label: '4x', type: 'text', system: true },
        ],
    },
    {
        id: 'service-level',
        label: 'Service Level',
        description: 'Application service tier.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Gold',   label: 'Gold',   type: 'text', system: true },
            { key: 'Silver', label: 'Silver', type: 'text', system: true },
            { key: 'Bronze', label: 'Bronze', type: 'text', system: true },
        ],
    },
    {
        id: 'layer-type',
        label: 'Layer Type',
        description: 'Semantic type of a layer/canvas.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Infrastructure', label: 'Infrastructure', type: 'text', system: true },
            { key: 'Workloads',      label: 'Workloads',      type: 'text', system: true },
        ],
    },
    {
        id: 'component-type',
        label: 'Component Type',
        description: 'Top-level infrastructure component types placed on the canvas.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Server',   label: 'Server',   type: 'text', system: true },
            { key: 'Firewall', label: 'Firewall', type: 'text', system: true },
            { key: 'Switch',   label: 'Switch',   type: 'text', system: true },
            { key: 'Storage',  label: 'Storage',  type: 'text', system: true },
            { key: 'NIC',      label: 'NIC',      type: 'text', system: true },
        ],
    },
    {
        id: 'product-category',
        label: 'Product Category',
        description: 'Classification of hardware products in the catalog.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Server',              label: 'Server',              type: 'text', system: true },
            { key: 'NIC',                 label: 'NIC',                 type: 'text', system: true },
            { key: 'Switch',              label: 'Switch',              type: 'text', system: true },
            { key: 'Router',              label: 'Router',              type: 'text', system: true },
            { key: 'Firewall',            label: 'Firewall',            type: 'text', system: true },
            { key: 'Storage_Array',       label: 'Storage Array',       type: 'text', system: true },
            { key: 'Storage_Controller',  label: 'Storage Controller',  type: 'text', system: true },
            { key: 'PSU',                 label: 'PSU',                 type: 'text', system: true },
            { key: 'CPU',                 label: 'CPU',                 type: 'text', system: true },
            { key: 'Memory',              label: 'Memory',              type: 'text', system: true },
            { key: 'HBA',                 label: 'HBA',                 type: 'text', system: true },
            { key: 'Cable',               label: 'Cable',               type: 'text', system: true },
            { key: 'Chassis',             label: 'Chassis',             type: 'text', system: true },
            { key: 'Optical_Transceiver', label: 'Optical Transceiver', type: 'text', system: true },
            { key: 'GPU',                 label: 'GPU',                 type: 'text', system: true },
        ],
    },
    {
        id: 'base-shape',
        label: 'Base Shape',
        description: 'Enumeration of available 3D geometry primitives for shapes and layers.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'cuboid',     label: 'Cuboid',     type: 'text', system: true },
            { key: 'cylinder',   label: 'Cylinder',   type: 'text', system: true },
            { key: 'pyramid',    label: 'Pyramid',    type: 'text', system: true },
            { key: 'octagon',    label: 'Octagon',    type: 'text', system: true },
            { key: 'hexahedron', label: 'Hexahedron', type: 'text', system: true },
        ],
    },
    {
        id: 'component-category',
        label: 'Component Category',
        description: 'Classification of components — general (shared) or user (private).',
        system: true,
        kind: 'option-set',
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
        kind: 'option-set',
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
        kind: 'option-set',
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
        kind: 'option-set',
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
        kind: 'option-set',
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
        kind: 'option-set',
        fields: [
            { key: 'label', label: 'Label', type: 'text', system: true },
            { key: 'base',  label: 'Base',  type: 'text', system: true },
            { key: 'hover', label: 'Hover', type: 'text', system: true },
        ],
    },
    {
        id: 'link-type',
        label: 'Link Type',
        description: 'Classification of connections between elements or zones.',
        system: true,
        kind: 'option-set',
        fields: [
            { key: 'Host Access',   label: 'Host Access',   type: 'text', system: true },
            { key: 'Cluster Link',  label: 'Cluster Link',  type: 'text', system: true },
        ],
    },

    // ── Hardware entity types (reserved for future compatibility engine) ────
    // Kept as schema definitions for structured import. Not shown in main catalog UI.
    {
        id: 'cpu-family',
        label: 'CPU Family',
        description: 'Processor family definitions (e.g. Intel Xeon 6, AMD EPYC 9005)',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'name',          label: 'Name',           type: 'text',   system: true, placeholder: 'e.g. Intel Xeon Scalable 4th Gen' },
            { key: 'vendor',        label: 'Vendor',         type: 'select', system: true, options: ['Intel', 'AMD', 'ARM'] },
            { key: 'generation',    label: 'Generation',     type: 'text',   system: true, placeholder: 'e.g. Sapphire Rapids' },
            { key: 'socket',        label: 'Socket',         type: 'text',   system: true, placeholder: 'e.g. LGA 4677' },
            { key: 'coreCountMin',  label: 'Min Cores',      type: 'number', system: true },
            { key: 'coreCountMax',  label: 'Max Cores',      type: 'number', system: true },
            { key: 'baseTdpW',      label: 'Base TDP (W)',   type: 'number', system: true },
            { key: 'launchYear',    label: 'Launch Year',    type: 'number', system: true },
            { key: 'architecture',  label: 'Architecture',   type: 'select', system: true, options: ['x86_64', 'ARM64'] },
            { key: 'notes',         label: 'Notes',          type: 'text',   system: true, multiline: true },
        ],
    },
    {
        id: 'memory-spec',
        label: 'Memory Spec',
        description: 'Memory specifications and rules (DDR type, DIMM form factor, capacity limits)',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'name',             label: 'Name',              type: 'text',   system: true, placeholder: 'e.g. DDR5-4800 RDIMM Config' },
            { key: 'memoryType',       label: 'Memory Type',       type: 'select', system: true, options: ['DDR4', 'DDR5', 'HBM3'] },
            { key: 'formFactor',       label: 'DIMM Form Factor',  type: 'select', system: true, options: ['RDIMM', 'LRDIMM', 'UDIMM', 'SO-DIMM'] },
            { key: 'allowedDimmSizes', label: 'Allowed DIMM Sizes',type: 'text',   system: true, placeholder: '16,32,64,128,256 (GB)' },
            { key: 'dimmSlots',        label: 'DIMM Slots',        type: 'number', system: true },
            { key: 'maxMemoryTB',      label: 'Max Memory (TB)',   type: 'number', system: true },
            { key: 'speedMHz',         label: 'Speed (MHz)',       type: 'number', system: true },
            { key: 'ecc',              label: 'ECC',               type: 'select', system: true, options: ['Yes', 'No'] },
            { key: 'populationRules',  label: 'Population Rules',  type: 'text',   system: true, multiline: true, placeholder: 'e.g. Populate in pairs, fill channel A first' },
            { key: 'notes',            label: 'Notes',             type: 'text',   system: true, multiline: true },
        ],
    },
    {
        id: 'server-model',
        label: 'Server Model',
        description: 'Server hardware models with references to supported CPUs and memory configurations',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'name',                   label: 'Name',                  type: 'text',   system: true, placeholder: 'e.g. Dell PowerEdge R760' },
            { key: 'vendor',                 label: 'Vendor',                type: 'text',   system: true, placeholder: 'e.g. Dell, HPE, Lenovo' },
            { key: 'productFamily',          label: 'Product Family',        type: 'text',   system: true, placeholder: 'e.g. PowerEdge' },
            { key: 'modelName',              label: 'Model',                 type: 'text',   system: true, placeholder: 'e.g. R760' },
            { key: 'formFactor',             label: 'Form Factor',           type: 'select', system: true, options: ['Rack', 'Tower', 'Blade', 'Multi-Node'] },
            { key: 'rackUnits',              label: 'Rack Units (U)',        type: 'number', system: true },
            { key: 'cpuVendor',              label: 'CPU Vendor',            type: 'select', system: true, options: ['Intel', 'AMD', 'Both'] },
            { key: 'socketCount',            label: 'CPU Sockets',           type: 'number', system: true },
            { key: 'supportedCpuFamilyIds',  label: 'Supported CPU Families',type: 'text',   system: true, refEntityType: 'cpu-family' },
            { key: 'dimmSlots',              label: 'DIMM Slots',            type: 'number', system: true },
            { key: 'memoryType',             label: 'Memory Type',            type: 'select', system: true, options: ['DDR5 RDIMM', 'DDR4 RDIMM', 'DDR5 LRDIMM'] },
            { key: 'maxMemoryTB',            label: 'Max Memory (TB)',        type: 'number', system: true },
            { key: 'supportedMemorySpecIds', label: 'Memory Specs',           type: 'text',   system: true, refEntityType: 'memory-spec' },
            { key: 'maxStorageBays',         label: 'Max Storage Bays',      type: 'number', system: true },
            { key: 'maxPowerW',              label: 'Max Power (W)',          type: 'number', system: true },
            { key: 'releaseYear',            label: 'Release Year',           type: 'number', system: true },
            { key: 'notes',                  label: 'Notes',                  type: 'text',   system: true, multiline: true },
        ],
    },
    {
        id: 'compatibility-rule',
        label: 'Compatibility Rule',
        description: 'Declarative validation rules for hardware configurations',
        system: true,
        kind: 'data-type',
        fields: [
            { key: 'name',             label: 'Name',              type: 'text',   system: true, placeholder: 'e.g. R770 CPU vendor must be Intel' },
            { key: 'ruleScope',        label: 'Scope',             type: 'select', system: true, options: ['server_model', 'cpu_family', 'memory_spec', 'configuration'] },
            { key: 'sourceEntityType', label: 'Source Entity Type', type: 'select', system: true, options: ['ServerModel', 'CpuFamily', 'MemorySpec'] },
            { key: 'sourceEntityId',   label: 'Source Entity',      type: 'text',   system: true, refEntityType: 'server-model' },
            { key: 'targetEntityType', label: 'Target Entity Type', type: 'select', system: true, options: ['Configuration', 'CpuFamily', 'MemorySpec'] },
            { key: 'targetField',      label: 'Target Field',       type: 'text',   system: true, placeholder: 'e.g. cpuVendor, socketCount, maxMemoryTB' },
            { key: 'operator',         label: 'Operator',           type: 'select', system: true, options: ['equals', 'not_equals', 'in', '<=', '>=', '<', '>'] },
            { key: 'value',            label: 'Value',              type: 'text',   system: true, placeholder: 'e.g. Intel, 2, Xeon 6' },
            { key: 'valueSource',      label: 'Value Source',       type: 'text',   system: true, placeholder: 'Optional: field reference instead of fixed value' },
            { key: 'severity',         label: 'Severity',           type: 'select', system: true, options: ['error', 'warning', 'info'] },
            { key: 'message',          label: 'Message',            type: 'text',   system: true, placeholder: 'Human-readable validation message' },
            { key: 'isActive',         label: 'Active',             type: 'select', system: true, options: ['true', 'false'] },
            { key: 'notes',            label: 'Notes',              type: 'text',   system: true, multiline: true },
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

export function getDataTypes(kind?: DataTypeKind): DataTypeDefinition[] {
    if (!kind) return registry;
    return registry.filter(t => t.kind === kind);
}

export function getDataType(id: string): DataTypeDefinition | undefined {
    return registry.find(t => t.id === id);
}

export function addDataType(id: string, label: string, description: string, kind: DataTypeKind = 'data-type'): DataTypeDefinition {
    const existing = registry.find(t => t.id === id);
    if (existing) throw new Error(`Data type "${id}" already exists`);
    const dt: DataTypeDefinition = { id, label, description, system: false, kind, fields: [] };
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
