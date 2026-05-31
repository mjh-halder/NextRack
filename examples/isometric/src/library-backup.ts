// Full localStorage backup / restore.
//
// The component library (and everything else the user builds) currently lives
// only in the browser's localStorage, spread across several keys and three
// shape-persistence layers (shape-registry, shape-store, component-store) plus
// icon config, schema registry, canvases, etc. Clearing site data — or a
// future un-migrated storage-key bump — wipes all of it.
//
// Rather than curate a per-store export (which silently misses a layer), this
// snapshots every NextRack-owned key into one JSON envelope and restores it
// verbatim. It is lossless and layer-agnostic by construction. The same
// envelope is the natural payload for a later localStorage -> Supabase import.

const KEY_PREFIXES = ['nextrack-', 'nr-'];

export interface BackupEnvelope {
    format: 'nextrack-backup';
    version: 1;
    exportedAt: string;
    keys: Record<string, unknown>;
}

function isBackupKey(key: string): boolean {
    return KEY_PREFIXES.some(p => key.startsWith(p));
}

/** Snapshot every NextRack-owned localStorage key into a backup envelope. */
export function collectBackup(): BackupEnvelope {
    const keys: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !isBackupKey(k)) continue;
        const raw = localStorage.getItem(k);
        if (raw == null) continue;
        // Store parsed JSON so the file is human-readable; fall back to the raw
        // string for the few flag-style values that aren't JSON.
        try { keys[k] = JSON.parse(raw); }
        catch { keys[k] = raw; }
    }
    return {
        format: 'nextrack-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        keys,
    };
}

/** Number of NextRack-owned keys currently in localStorage (for UI labels). */
export function backupKeyCount(): number {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && isBackupKey(k)) n++;
    }
    return n;
}

/**
 * Write a backup envelope's keys back into localStorage (overwriting matching
 * keys; keys not present in the backup are left untouched). Throws if the input
 * is not a recognisable NextRack backup.
 *
 * Callers should reload the page afterwards: in-memory caches such as the
 * ShapeRegistry are populated once at module load and won't see the new values
 * until then.
 */
export function restoreBackup(env: unknown): { restored: number } {
    const e = env as Partial<BackupEnvelope> | null;
    if (!e || typeof e !== 'object' || e.format !== 'nextrack-backup' || !e.keys || typeof e.keys !== 'object') {
        throw new Error('Not a NextRack backup file.');
    }
    let restored = 0;
    for (const [k, v] of Object.entries(e.keys)) {
        if (!isBackupKey(k)) continue; // never write foreign keys
        const raw = typeof v === 'string' ? v : JSON.stringify(v);
        try { localStorage.setItem(k, raw); restored++; }
        catch (err) { console.error(`[nextrack] Failed to restore key ${k}:`, err); }
    }
    return { restored };
}
