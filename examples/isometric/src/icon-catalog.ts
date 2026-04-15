// Single source of truth for all icons selectable in the Component Designer.
// Custom project assets are merged with the full @carbon/icons set so the
// Admin > Icon Configuration view can offer both pools from one catalog.

import cubeIconSvg from '../assets/cube-icon.svg';
import routerIconSvg from '../assets/router-icon.svg';
import switchIconSvg from '../assets/switch-icon.svg';
import k8sControlNodeIconSvg from '../assets/kubernetesControlNode-logo.svg';
import k8sWorkerNodeIconSvg from '../assets/kubernetesWorkerNode-logo.svg';
import virtualInstanceIconSvg from '../assets/virtualinstance-logo.svg';
import serverDnsSvg from '../assets/server--dns.svg';
import pipelinesSvg from '../assets/pipelines.svg';
import boxSvg from '../assets/box.svg';
import securitySvg from '../assets/security (1).svg';
import mediaLibrarySvg from '../assets/media--library--filled.svg';
import licenseSvg from '../assets/license.svg';
import apiSvg from '../assets/API--1.svg';
import sapSvg from '../assets/SAP.svg';
import vmwareSvg from '../assets/logo--vmware.svg';
import ansibleSvg from '../assets/logo--red-hat-ansible.svg';
import reactSvg from '../assets/logo--react.svg';
import pythonSvg from '../assets/logo--python.svg';
import openshiftSvg from '../assets/logo--openshift.svg';
import kubernetesSvg from '../assets/logo--kubernetes.svg';
import gitSvg from '../assets/logo--git.svg';
import virtualMachineSvg from '../assets/virtual-machine.svg';
import databaseSvg from '../assets/data--base.svg';
import objectStorageSvg from '../assets/object-storage.svg';
import bareMetalServerSvg from '../assets/ibm-cloud--bare-metal-server.svg';
import tuningSvg from '../assets/tuning.svg';
import aiAgentSvg from '../assets/ai-agent-invocation.svg';
import cubeSvg from '../assets/cube.svg';
import k8sControlPlaneSvg from '../assets/kubernetes--control-plane-node.svg';
import instanceVirtualSvg from '../assets/instance--virtual.svg';
import k8sWorkerNodeSvg from '../assets/kubernetes--worker-node.svg';

import { CARBON_ICONS } from './carbon-icons-all';

export type IconSource = 'custom' | 'carbon';

export interface IconCatalogEntry {
    id: string;
    label: string;
    svg: string;
    source: IconSource;
}

const CUSTOM_ICONS: ReadonlyArray<IconCatalogEntry> = [
    // Generic
    { id: 'cube',                  label: 'Cube',                  svg: cubeIconSvg,            source: 'custom' },
    { id: 'cube-alt',              label: 'Cube (alt)',            svg: cubeSvg,                source: 'custom' },
    { id: 'box',                   label: 'Box',                   svg: boxSvg,                 source: 'custom' },
    { id: 'license',               label: 'License',               svg: licenseSvg,             source: 'custom' },
    { id: 'tuning',                label: 'Tuning',                svg: tuningSvg,              source: 'custom' },
    { id: 'media-library',         label: 'Media Library',         svg: mediaLibrarySvg,        source: 'custom' },
    { id: 'pipelines',             label: 'Pipelines',             svg: pipelinesSvg,           source: 'custom' },
    { id: 'ai-agent',              label: 'AI Agent',              svg: aiAgentSvg,             source: 'custom' },
    // Network & Security
    { id: 'router',                label: 'Router',                svg: routerIconSvg,          source: 'custom' },
    { id: 'switch',                label: 'Switch',                svg: switchIconSvg,          source: 'custom' },
    { id: 'server-dns',            label: 'DNS Server',            svg: serverDnsSvg,           source: 'custom' },
    { id: 'security',              label: 'Security',              svg: securitySvg,            source: 'custom' },
    { id: 'api',                   label: 'API',                   svg: apiSvg,                 source: 'custom' },
    // Compute & Storage
    { id: 'virtual-machine',       label: 'Virtual Machine',       svg: virtualMachineSvg,      source: 'custom' },
    { id: 'instance-virtual',      label: 'Instance',              svg: instanceVirtualSvg,     source: 'custom' },
    { id: 'virtual-instance',      label: 'Virtual Instance',      svg: virtualInstanceIconSvg, source: 'custom' },
    { id: 'bare-metal-server',     label: 'Bare Metal Server',     svg: bareMetalServerSvg,     source: 'custom' },
    { id: 'database',              label: 'Database',              svg: databaseSvg,            source: 'custom' },
    { id: 'object-storage',        label: 'Object Storage',        svg: objectStorageSvg,       source: 'custom' },
    // Kubernetes
    { id: 'k8s-control-node',      label: 'K8s Control Node',      svg: k8sControlNodeIconSvg,  source: 'custom' },
    { id: 'k8s-control-plane',     label: 'K8s Control Plane',     svg: k8sControlPlaneSvg,     source: 'custom' },
    { id: 'k8s-worker-node',       label: 'K8s Worker Node',       svg: k8sWorkerNodeIconSvg,   source: 'custom' },
    { id: 'k8s-worker-node-alt',   label: 'K8s Worker (alt)',      svg: k8sWorkerNodeSvg,       source: 'custom' },
    { id: 'kubernetes',            label: 'Kubernetes',            svg: kubernetesSvg,          source: 'custom' },
    { id: 'openshift',             label: 'OpenShift',             svg: openshiftSvg,           source: 'custom' },
    // Platforms & Tools
    { id: 'vmware',                label: 'VMware',                svg: vmwareSvg,              source: 'custom' },
    { id: 'ansible',               label: 'Ansible',               svg: ansibleSvg,             source: 'custom' },
    { id: 'python',                label: 'Python',                svg: pythonSvg,              source: 'custom' },
    { id: 'react',                 label: 'React',                 svg: reactSvg,               source: 'custom' },
    { id: 'git',                   label: 'Git',                   svg: gitSvg,                 source: 'custom' },
    { id: 'sap',                   label: 'SAP',                   svg: sapSvg,                 source: 'custom' },
];

const CARBON_ENTRIES: ReadonlyArray<IconCatalogEntry> = CARBON_ICONS.map(ic => ({
    id:     ic.id,     // already namespaced 'carbon:<name>'
    label:  ic.label,
    svg:    ic.svg,
    source: 'carbon' as const,
}));

export const ICON_CATALOG: ReadonlyArray<IconCatalogEntry> = [...CUSTOM_ICONS, ...CARBON_ENTRIES];

// Fast lookup map, built once — 2.5k+ icons with .find() per call is wasteful.
const ICON_BY_ID: Map<string, IconCatalogEntry> = new Map(
    ICON_CATALOG.map(i => [i.id, i])
);

export function getIconById(id: string): IconCatalogEntry | undefined {
    return ICON_BY_ID.get(id);
}
