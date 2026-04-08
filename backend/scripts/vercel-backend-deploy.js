#!/usr/bin/env node
/**
 * Vercel backend build/deploy helper.
 * The osk-kamenna-poruba-back project has rootDirectory=backend on Vercel,
 * so build/deploy must run from the repo root with the backend project.json active.
 *
 * Usage (from backend/):
 *   npm run vercel:build:prod   → node scripts/vercel-backend-deploy.js build
 *   npm run vercel:deploy:prod  → node scripts/vercel-backend-deploy.js deploy
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const action = process.argv[2]; // 'build' or 'deploy'
if (!['build', 'deploy'].includes(action)) {
  console.error('Usage: node vercel-backend-deploy.js build|deploy');
  process.exit(1);
}

const backendDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(backendDir, '..');
const rootVercelDir = path.join(rootDir, '.vercel');
const rootProjectJson = path.join(rootVercelDir, 'project.json');
const backupJson = path.join(rootVercelDir, 'project.json.frontend-backup');
const backendProjectJson = path.join(backendDir, '.vercel', 'project.json');

if (!fs.existsSync(backendProjectJson)) {
  console.error('backend/.vercel/project.json not found. Run: cd backend && npx vercel link --yes --scope=darksimperium --project=osk-kamenna-poruba-back');
  process.exit(1);
}

// Backup current frontend project.json
if (fs.existsSync(rootProjectJson)) {
  fs.copyFileSync(rootProjectJson, backupJson);
}

// Swap in backend project.json
fs.copyFileSync(backendProjectJson, rootProjectJson);

function restore() {
  if (fs.existsSync(backupJson)) {
    fs.copyFileSync(backupJson, rootProjectJson);
    fs.unlinkSync(backupJson);
  }
}

try {
  if (action === 'build') {
    execSync('npx vercel build --prod', { cwd: rootDir, stdio: 'inherit' });
  } else {
    execSync('npx vercel deploy --prebuilt --prod', { cwd: rootDir, stdio: 'inherit' });
  }
} finally {
  // Always restore frontend project.json
  if (fs.existsSync(backupJson)) {
    fs.copyFileSync(backupJson, rootProjectJson);
    fs.unlinkSync(backupJson);
  }
}
