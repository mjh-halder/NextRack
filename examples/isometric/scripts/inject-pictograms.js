#!/usr/bin/env node
/**
 * Replaces <!-- picto:NAME --> placeholders in HTML files with the actual
 * Carbon Pictogram SVG content from @carbon/pictograms/svg/NAME.svg.
 *
 * Usage: node scripts/inject-pictograms.js presales.html
 */
const fs = require('fs');
const path = require('path');

const PICTO_DIR = path.join(__dirname, '..', 'node_modules', '@carbon', 'pictograms', 'svg');

const file = process.argv[2];
if (!file) { console.error('Usage: node inject-pictograms.js <file>'); process.exit(1); }

const filePath = path.resolve(file);
let html = fs.readFileSync(filePath, 'utf8');

const re = /<!--\s*picto:([a-z0-9_-]+)\s*-->/gi;
let count = 0;

html = html.replace(re, (match, name) => {
    const svgPath = path.join(PICTO_DIR, `${name}.svg`);
    if (!fs.existsSync(svgPath)) {
        console.warn(`  ⚠ Pictogram not found: ${name}`);
        return match;
    }
    count++;
    return fs.readFileSync(svgPath, 'utf8').trim();
});

fs.writeFileSync(filePath, html);
console.log(`✓ Injected ${count} pictogram(s) into ${path.basename(filePath)}`);
