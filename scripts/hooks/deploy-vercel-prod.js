const { execFileSync } = require('child_process');

function run(command, args) {
  execFileSync(command, args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: process.platform === 'win32'
  });
}

function repoHasChanges() {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      shell: process.platform === 'win32'
    }).trim();

    return output.length > 0;
  } catch (error) {
    console.warn('[vercel-prod-deploy] Unable to read git status, continuing with deploy.');
    return true;
  }
}

function main() {
  if (!repoHasChanges()) {
    console.log('[vercel-prod-deploy] No repository changes detected, skipping production deploy.');
    return;
  }

  console.log('[vercel-prod-deploy] Repository changes detected, starting production Vercel build.');
  run('npm', ['run', 'vercel:build:prod']);

  console.log('[vercel-prod-deploy] Production build finished, starting production Vercel deploy.');
  run('npm', ['run', 'vercel:deploy:prod']);

  console.log('[vercel-prod-deploy] Production Vercel deploy finished.');
}

main();