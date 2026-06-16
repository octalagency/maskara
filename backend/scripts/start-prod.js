#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findEntry() {
  const candidates = ['dist/main.js', 'dist/src/main.js'];
  for (const rel of candidates) {
    const abs = path.join(process.cwd(), rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

const entry = findEntry();
if (!entry) {
  console.error('ERROR: Cannot find dist/main.js — backend was not compiled in the Docker image.');
  console.error('  Rebuild with: docker compose -f docker-compose.hostinger.yml build --no-cache backend');
  process.exit(1);
}

require(entry);
