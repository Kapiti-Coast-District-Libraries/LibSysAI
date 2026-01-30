// generateManifest.cjs
const fs = require('fs');
const path = require('path');

// Root folder where SOPs are stored
const SOP_ROOT = path.join(__dirname, 'SOP');

// Output file
const OUTPUT_FILE = path.join(__dirname, 'manifest.json');

function walkDir(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (item.isFile() && /\.(pdf|docx?|xlsx?|html?|json?)$/i.test(item.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

function buildManifest() {
  const files = walkDir(SOP_ROOT);

  const manifest = files.map((filePath) => {
    // Make paths relative to repo root
    const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
    const parts = relativePath.split('/');
    const category = parts[1]; // Assuming SOP/<category>/file

    return {
      file: relativePath,
      category: category || 'uncategorized',
      name: path.basename(filePath),
    };
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Manifest generated with ${manifest.length} files at ${OUTPUT_FILE}`);
}

buildManifest();
