const fs = require('fs');
const path = require('path');

const SOP_ROOT = path.join(__dirname, 'SOP');
const MANIFEST_PATH = path.join(__dirname, 'manifest.json');

function walkDir(dir) {
  const result = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = walkDir(fullPath);
      if (Object.keys(subFiles).length > 0) {
        result[entry.name] = subFiles;
      }
    } else if (entry.isFile()) {
      if (!result.files) result.files = [];
      result.files.push(path.relative(__dirname, fullPath).replace(/\\/g, '/'));
    }
  }
  return result;
}

const manifest = walkDir(SOP_ROOT);

// Optionally flatten so categories point to arrays of files directly
function flattenManifest(obj) {
  const flattened = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value.files) {
      flattened[key] = value.files;
    } else {
      flattened[key] = flattenManifest(value);
    }
  }
  return flattened;
}

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(flattenManifest(manifest), null, 2));
console.log('manifest.json generated successfully.');
