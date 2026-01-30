// generateManifest.cjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the repo
const ROOT_DIR = path.resolve(__dirname, '..');  // adjust if script is in root

// Folder containing SOPs
const SOP_DIR = path.join(ROOT_DIR, 'SOP');

// Function to recursively get all files
function getAllFiles(dir, basePath = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(basePath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, relativePath));
    } else {
      files.push(relativePath.replace(/\\/g, '/')); // normalize slashes
    }
  }
  return files;
}

// Generate manifest
const manifest = {
  sops: getAllFiles(SOP_DIR),
  generatedAt: new Date().toISOString(),
};

// Write to repo root
const manifestPath = path.join(ROOT_DIR, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Manifest generated at ${manifestPath}`);
