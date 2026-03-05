#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const baseUrl = process.env.BASE_URL || process.argv[2];
if (!baseUrl) {
  console.error('Usage: BASE_URL=https://your-staging-url node scripts/mobile-smoke.mjs');
  process.exit(1);
}

const targets = [
  { name: 'home', path: '/' },
  { name: 'signin', path: '/signin' },
  { name: 'create', path: '/create' },
  { name: 'order', path: '/order' },
  { name: 'dashboard', path: '/dashboard' },
];

const mobileProfiles = [
  { label: 'iphone-12', device: devices['iPhone 12'] },
  { label: 'pixel-7', device: devices['Pixel 7'] },
];

const artifactsRoot = path.resolve('artifacts/mobile-smoke');
await fs.mkdir(artifactsRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const profile of mobileProfiles) {
  const context = await browser.newContext({ ...profile.device });
  const page = await context.newPage();

  for (const target of targets) {
    const url = `${baseUrl.replace(/\/$/, '')}${target.path}`;
    const filenameBase = `${profile.label}-${target.name}`;
    try {
      const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      const status = response?.status() || 0;
      const screenshotPath = path.join(artifactsRoot, `${filenameBase}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      if (status >= 400) {
        failures.push({ profile: profile.label, target: target.path, status, url });
      }

      console.log(JSON.stringify({ profile: profile.label, target: target.path, status, screenshot: screenshotPath }));
    } catch (error) {
      const screenshotPath = path.join(artifactsRoot, `${filenameBase}-error.png`);
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {}

      failures.push({
        profile: profile.label,
        target: target.path,
        status: 'navigation_error',
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(JSON.stringify({ profile: profile.label, target: target.path, error: String(error) }));
    }
  }

  await context.close();
}

await browser.close();

const summaryPath = path.join(artifactsRoot, 'summary.json');
await fs.writeFile(summaryPath, JSON.stringify({ baseUrl, failures }, null, 2));
console.log(`Summary written to ${summaryPath}`);

if (failures.length > 0) {
  console.error(`Mobile smoke failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('Mobile smoke passed.');
