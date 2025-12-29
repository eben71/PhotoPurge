#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const root = path.resolve(new URL('..', import.meta.url).pathname);

const webCoveragePath = path.join(root, 'apps', 'web', 'coverage', 'coverage-summary.json');
const apiCoveragePath = path.join(root, 'apps', 'api', 'coverage.xml');
const workerCoveragePath = path.join(root, 'apps', 'worker', 'coverage.xml');

const threshold = 80;

function ensureFile(pathToFile, label) {
  if (!existsSync(pathToFile)) {
    console.error(`${label} coverage file not found at ${pathToFile}`);
    process.exit(1);
  }
}

function getWebCoverage() {
  ensureFile(webCoveragePath, 'Web');
  const summary = JSON.parse(readFileSync(webCoveragePath, 'utf8'));
  return summary.total.lines.pct;
}

function parseXmlLineRate(xmlContent) {
  const match = xmlContent.match(/line-rate="([0-9.]+)"/);
  if (!match) {
    console.error('Unable to parse coverage XML');
    process.exit(1);
  }
  return Number.parseFloat(match[1]) * 100;
}

function getPythonCoverage(pathToFile, label) {
  ensureFile(pathToFile, label);
  const xmlContent = readFileSync(pathToFile, 'utf8');
  return parseXmlLineRate(xmlContent);
}

function assertThreshold(label, value) {
  if (value < threshold) {
    console.error(`${label} coverage ${value.toFixed(2)}% is below threshold ${threshold}%`);
    process.exit(1);
  }
}

const webCoverage = getWebCoverage();
const apiCoverage = getPythonCoverage(apiCoveragePath, 'API');
const workerCoverage = getPythonCoverage(workerCoveragePath, 'Worker');

assertThreshold('Web', webCoverage);
assertThreshold('API', apiCoverage);
assertThreshold('Worker', workerCoverage);

console.log('Coverage thresholds met:', {
  web: webCoverage,
  api: apiCoverage,
  worker: workerCoverage
});
