#!/usr/bin/env node
const { readFileSync } = require('fs');
const path = require('path');

const readmePath = path.join(__dirname, '..', 'README.md');
const readme = readFileSync(readmePath, 'utf8');

const requiredHeadings = ['Local Development', 'Repo Structure'];
const requiredCommands = ['make dev', 'make lint', 'make format', 'make typecheck', 'make test', 'make build'];
const requiredPaths = ['apps/web', 'apps/api', 'apps/worker', 'packages/shared', 'infra/docker', 'docs', '.github/workflows'];

function ensureIncludes(text, values, label) {
  const missing = values.filter((value) => !text.includes(value));
  if (missing.length) {
    console.error(`README is missing required ${label}: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}

ensureIncludes(readme, requiredHeadings, 'headings');
ensureIncludes(readme, requiredCommands, 'commands');
ensureIncludes(readme, requiredPaths, 'paths');

if (process.exitCode) {
  console.error('Documentation guard failed. Please update README to reflect current structure/commands.');
  process.exit(process.exitCode);
}
