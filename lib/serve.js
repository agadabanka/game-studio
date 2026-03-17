/**
 * game-studio serve — Start a local dev server.
 *
 * Serves the game project directory on port 8080 (configurable).
 * Open index.html in a browser to play. Uses dist/game.bundle.js
 * so run "game-studio build" first.
 */

import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export default async function serve({ args, cwd }) {
  const port = parseInt(args.find((_, i) => args[i - 1] === '--port') || '8080');

  const server = createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const filePath = join(cwd, urlPath);

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
    res.end(readFileSync(filePath));
  });

  server.listen(port, () => {
    console.log(`\n  Game server running at http://localhost:${port}`);
    console.log(`  Open in browser to play your game.`);
    console.log(`  Press Ctrl+C to stop.\n`);
  });
}
