#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDataDir = resolve(root, 'data');
const clientDataDir = resolve(root, '../dalworld_client/data');

const DATA_FILES = ['items.json', 'recipes.json', 'monsters.json', 'buildingParts.json'];

function readNormalizedJson(path) {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return JSON.stringify(parsed, null, 2);
}

if (!existsSync(clientDataDir)) {
  console.warn('[game-data-sync] Skipped: client data directory was not found at ../dalworld_client/data.');
  console.warn('[game-data-sync] To enable cross-repository data checks, keep dalworld_client and dalworld_server as sibling folders.');
  process.exit(0);
}

const mismatches = [];
for (const fileName of DATA_FILES) {
  const serverPath = resolve(serverDataDir, fileName);
  const clientPath = resolve(clientDataDir, fileName);

  if (!existsSync(serverPath)) {
    mismatches.push(`${fileName}: missing in server`);
    continue;
  }
  if (!existsSync(clientPath)) {
    mismatches.push(`${fileName}: missing in client`);
    continue;
  }

  const serverJson = readNormalizedJson(serverPath);
  const clientJson = readNormalizedJson(clientPath);
  if (serverJson !== clientJson) {
    mismatches.push(`${fileName}: server/client contents differ`);
  }
}

if (mismatches.length > 0) {
  console.error('[game-data-sync] Server/client game data mismatch detected.');
  for (const mismatch of mismatches) {
    console.error(`  - ${mismatch}`);
  }
  process.exit(1);
}

console.log('[game-data-sync] Server/client data/*.json files are aligned.');
