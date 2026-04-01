const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const itemsToCopy = ['index.html', 'pages', 'assets'];

fs.rmSync(publicDir, { recursive: true, force: true });
fs.mkdirSync(publicDir, { recursive: true });

for (const item of itemsToCopy) {
  const sourcePath = path.join(projectRoot, item);
  const targetPath = path.join(publicDir, item);

  fs.cpSync(sourcePath, targetPath, { recursive: true });
}