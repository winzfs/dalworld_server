#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverProtocolPath = resolve(root, 'src/protocol/messages.ts');
const clientProtocolPath = resolve(root, '../dalworld_client/src/protocol/messages.ts');

const REQUIRED_CLIENT_HINT = '../dalworld_client/src/protocol/messages.ts';

function readRequired(path) {
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8');
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');
}

function collectExports(source) {
  const clean = stripComments(source);
  const names = new Set();
  const regex = /export\s+(?:type|interface|const|enum)\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function collectMessageLiterals(source) {
  const clean = stripComments(source);
  const literals = new Set();
  const regex = /type\s*:\s*['"]([A-Z0-9_]+|[a-z0-9_]+)['"]/g;
  let match;
  while ((match = regex.exec(clean)) !== null) {
    literals.add(match[1]);
  }
  return [...literals].sort();
}

function diff(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

const serverSource = readRequired(serverProtocolPath);
const clientSource = readRequired(clientProtocolPath);

if (!serverSource) {
  console.error(`[protocol-sync] Missing server protocol file: ${serverProtocolPath}`);
  process.exit(1);
}

if (!clientSource) {
  console.warn(`[protocol-sync] Skipped: client repository was not found at ${REQUIRED_CLIENT_HINT}.`);
  console.warn('[protocol-sync] To enable cross-repository protocol checks, keep dalworld_client and dalworld_server as sibling folders.');
  process.exit(0);
}

const serverExports = collectExports(serverSource);
const clientExports = collectExports(clientSource);
const serverMessages = collectMessageLiterals(serverSource);
const clientMessages = collectMessageLiterals(clientSource);

const missingInClientExports = diff(serverExports, clientExports);
const missingInServerExports = diff(clientExports, serverExports);
const missingInClientMessages = diff(serverMessages, clientMessages);
const missingInServerMessages = diff(clientMessages, serverMessages);

const hasMismatch =
  missingInClientExports.length > 0 ||
  missingInServerExports.length > 0 ||
  missingInClientMessages.length > 0 ||
  missingInServerMessages.length > 0;

if (hasMismatch) {
  console.error('[protocol-sync] Server/client protocol mismatch detected.');
  if (missingInClientExports.length) console.error('  Exports only in server:', missingInClientExports.join(', '));
  if (missingInServerExports.length) console.error('  Exports only in client:', missingInServerExports.join(', '));
  if (missingInClientMessages.length) console.error('  Message literals only in server:', missingInClientMessages.join(', '));
  if (missingInServerMessages.length) console.error('  Message literals only in client:', missingInServerMessages.join(', '));
  process.exit(1);
}

console.log('[protocol-sync] Server/client protocol exports and message literals are aligned.');
