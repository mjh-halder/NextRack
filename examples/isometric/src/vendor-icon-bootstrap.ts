// Bundled-vendor bootstrap.
//
// The app ships with AWS / Azure / GCP icon packs as static ZIP assets under
// `src/assets/`. On startup, for each vendor whose IndexedDB count is zero,
// we fetch the bundled ZIP, run the same extract+import pipeline the Admin
// upload uses, and seed the catalog. If a user has uploaded their own pack
// (count > 0), we leave it alone — bootstrap defers to user state.
//
// Bootstrap runs once per page load. It is fire-and-forget; when each vendor
// finishes importing, `addAwsIcons` / `addGcpIcons` / `addAzureIcons` call
// `rebuildCatalog()` internally, which fires `onCatalogChange` listeners and
// refreshes both palettes.

import awsZipUrl = require('./assets/AWSIcons.zip');
import azureZipUrl = require('./assets/AzureIcons.zip');
import gcpZipUrl = require('./assets/GCPIcons.zip');

import {
    catalogReady,
    extractSvgEntriesFromZip,
    addAwsIcons,
    addGcpIcons,
    addAzureIcons,
    getAwsIconCount,
    getGcpIconCount,
    getAzureIconCount,
} from './icon-catalog';

type Vendor = 'aws' | 'gcp' | 'azure';

interface VendorSpec {
    vendor: Vendor;
    zipUrl: string;
    getCount: () => number;
    addFn: (entries: Array<{ label: string; svg: string }>) => Promise<{ added: number; error?: string }>;
}

const SPECS: VendorSpec[] = [
    { vendor: 'aws',   zipUrl: awsZipUrl,   getCount: getAwsIconCount,   addFn: addAwsIcons   },
    { vendor: 'gcp',   zipUrl: gcpZipUrl,   getCount: getGcpIconCount,   addFn: addGcpIcons   },
    { vendor: 'azure', zipUrl: azureZipUrl, getCount: getAzureIconCount, addFn: addAzureIcons },
];

async function loadOne(spec: VendorSpec): Promise<void> {
    if (spec.getCount() > 0) return;
    try {
        const res = await fetch(spec.zipUrl);
        if (!res.ok) {
            console.error(`[nextrack] Bundled ${spec.vendor} ZIP fetch failed:`, res.status, res.statusText);
            return;
        }
        const buf = await res.arrayBuffer();
        const entries = extractSvgEntriesFromZip(buf);
        const result = await spec.addFn(entries);
        if (result.error) {
            console.error(`[nextrack] Bundled ${spec.vendor} import error:`, result.error);
        }
    } catch (e) {
        console.error(`[nextrack] Bundled ${spec.vendor} bootstrap failed:`, e);
    }
}

/**
 * Seed empty vendor catalogs (AWS / GCP / Azure) from the bundled ZIP assets.
 * No-op for vendors that already have icons in IndexedDB. Awaits `catalogReady`
 * so the count check sees the hydrated state, then loads vendors in parallel.
 */
export async function bootstrapBundledVendorIcons(): Promise<void> {
    await catalogReady;
    await Promise.all(SPECS.map(loadOne));
}
