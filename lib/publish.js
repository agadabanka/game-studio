/**
 * game-studio publish — Push game to GitHub.
 *
 * Creates a GitHub repo (if needed) and pushes:
 *   - game.js (source)
 *   - dist/game.bundle.js (standalone bundle)
 *   - spec.json (if exists, for backward compat)
 *   - index.html (playable page)
 *   - README.md (auto-generated)
 *
 * Uses the GitHub CLI (gh) for authentication.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function gh(cmd) {
  return execSync(`gh ${cmd}`, { encoding: 'utf-8' }).trim();
}

function pushFile(fullName, path, content, message, sha) {
  const encoded = Buffer.from(content).toString('base64');
  const shaArg = sha ? `-f sha="${sha}"` : '';
  try {
    execSync(
      `gh api "repos/${fullName}/contents/${path}" --method PUT -f message="${message}" -f content="${encoded}" ${shaArg}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return true;
  } catch (err) {
    // If file exists, get SHA and retry
    if (!sha && err.message.includes('422')) {
      try {
        const existing = JSON.parse(
          execSync(`gh api "repos/${fullName}/contents/${path}" --jq '.sha'`, { encoding: 'utf-8', stdio: 'pipe' })
        );
        return pushFile(fullName, path, content, message, existing);
      } catch { /* fall through */ }
    }
    return false;
  }
}

export default async function publish({ args, cwd, config }) {
  const gameFile = join(cwd, 'game.js');
  if (!existsSync(gameFile)) {
    throw new Error('No game.js found.');
  }

  const owner = config.github?.owner;
  const repo = config.github?.repo || config.name;

  if (!owner) {
    throw new Error(
      'No GitHub owner configured. Add to game-studio.json:\n' +
      '  "github": { "owner": "your-username", "repo": "game-name" }'
    );
  }

  const fullName = `${owner}/${repo}`;
  console.log(`Publishing to ${fullName}...`);

  // Check if repo exists, create if not
  try {
    gh(`repo view ${fullName} --json name`);
    console.log(`  Repo exists: ${fullName}`);
  } catch {
    console.log(`  Creating repo: ${fullName}`);
    gh(`repo create ${fullName} --public --description "${config.name || repo} — Built with Game Studio"`);
  }

  // Collect files to push
  const files = [];

  // game.js (source)
  files.push({
    path: 'game.js',
    content: readFileSync(gameFile, 'utf-8'),
    message: 'Update game.js',
  });

  // dist/game.bundle.js
  const bundlePath = join(cwd, 'dist/game.bundle.js');
  if (existsSync(bundlePath)) {
    files.push({
      path: 'dist/game.bundle.js',
      content: readFileSync(bundlePath, 'utf-8'),
      message: 'Update dist/game.bundle.js',
    });
  } else {
    console.log('  Warning: dist/game.bundle.js not found. Run "game-studio build" first.');
  }

  // index.html
  const htmlPath = join(cwd, 'index.html');
  if (existsSync(htmlPath)) {
    files.push({
      path: 'index.html',
      content: readFileSync(htmlPath, 'utf-8'),
      message: 'Update index.html',
    });
  }

  // spec.json (optional)
  const specPath = join(cwd, 'spec.json');
  if (existsSync(specPath)) {
    files.push({
      path: 'spec.json',
      content: readFileSync(specPath, 'utf-8'),
      message: 'Update spec.json',
    });
  }

  // assets/title-card.png
  const titleCardPath = join(cwd, 'assets/title-card.png');
  if (existsSync(titleCardPath)) {
    files.push({
      path: 'assets/title-card.png',
      content: readFileSync(titleCardPath).toString('base64'),
      message: 'Update title card',
    });
  }

  // README.md (auto-generate)
  const readme = `# ${config.name || repo}\n\nBuilt with [Game Studio](https://github.com/agadabanka/game-studio) using the ECS Game Factory engine.\n\n## Play\n\nOpen \`index.html\` in a browser, or serve with any static file server.\n\n## Development\n\n\`\`\`bash\ngame-studio build    # Bundle game.js → dist/game.bundle.js\ngame-studio eval     # Run AI quality evaluation\ngame-studio publish  # Push to GitHub\n\`\`\`\n`;
  files.push({ path: 'README.md', content: readme, message: 'Update README.md' });

  // Push each file
  let ok = 0, fail = 0;
  for (const file of files) {
    process.stdout.write(`  ${file.path}... `);
    if (pushFile(fullName, file.path, file.content, file.message)) {
      console.log('ok');
      ok++;
    } else {
      console.log('FAILED');
      fail++;
    }
  }

  console.log(`\nPublished ${ok} files to https://github.com/${fullName}`);
  if (fail > 0) console.log(`  (${fail} files failed)`);
}
