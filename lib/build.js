/**
 * game-studio build — Bundle game.js into a standalone dist/game.bundle.js.
 *
 * Two modes:
 *   1. Local build: Uses esbuild-wasm with local engine/ modules (offline)
 *   2. Remote build: POST source to Game Factory /api/compile (requires server)
 *
 * Default: tries local first, falls back to remote.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function buildLocal(cwd) {
  const gameSource = readFileSync(join(cwd, 'game.js'), 'utf-8');
  const engineDir = join(cwd, 'engine');

  if (!existsSync(engineDir)) {
    throw new Error('No engine/ directory. Run "game-studio pull-sdk" first, or use --remote.');
  }

  // Dynamic import esbuild-wasm
  const esbuild = await import('esbuild-wasm');

  // Initialize if not already
  try {
    await esbuild.initialize({ wasmURL: 'https://unpkg.com/esbuild-wasm@0.25.0/esbuild.wasm' });
  } catch {
    // Already initialized
  }

  // Map @engine/* imports to local files
  const engineModules = {
    '@engine/core': join(engineDir, 'core.js'),
    '@engine/ecs': join(engineDir, 'ecs.js'),
    '@engine/board': join(engineDir, 'board.js'),
    '@engine/grid': join(engineDir, 'grid.js'),
    '@engine/render': join(engineDir, 'render.js'),
    '@engine/input': join(engineDir, 'input.js'),
    '@engine': join(engineDir, 'index.js'),
  };

  // Read all engine sources into virtual FS
  const virtualFiles = { 'game.js': gameSource };
  for (const [alias, path] of Object.entries(engineModules)) {
    if (existsSync(path)) {
      virtualFiles[alias] = readFileSync(path, 'utf-8');
    }
  }

  // ECS runtime — engine modules import from ./ecs.js which re-exports
  const ecsPath = join(engineDir, 'ecs/index.js');
  if (existsSync(ecsPath)) {
    virtualFiles['ecs-runtime'] = readFileSync(ecsPath, 'utf-8');
  }

  const virtualPlugin = {
    name: 'game-studio-virtual',
    setup(build) {
      // Resolve @engine/* imports
      build.onResolve({ filter: /^@engine/ }, (args) => {
        return { path: args.path, namespace: 'engine-virtual' };
      });
      build.onLoad({ filter: /.*/, namespace: 'engine-virtual' }, (args) => {
        const source = virtualFiles[args.path];
        if (!source) return { errors: [{ text: `Engine module not found: ${args.path}` }] };
        return { contents: source, loader: 'js' };
      });

      // Resolve ./ecs.js relative imports inside engine modules
      build.onResolve({ filter: /^\.\/ecs\.js$/ }, () => {
        return { path: 'ecs-runtime', namespace: 'engine-virtual' };
      });
      build.onLoad({ filter: /^ecs-runtime$/, namespace: 'engine-virtual' }, () => {
        return { contents: virtualFiles['ecs-runtime'] || '', loader: 'js' };
      });
    },
  };

  const result = await esbuild.build({
    stdin: { contents: gameSource, loader: 'js', resolveDir: '.' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    plugins: [virtualPlugin],
    write: false,
  });

  if (result.errors.length > 0) {
    throw new Error('Build errors:\n' + result.errors.map(e => e.text).join('\n'));
  }

  return result.outputFiles[0].text;
}

async function buildRemote(cwd, factoryUrl) {
  const gameSource = readFileSync(join(cwd, 'game.js'), 'utf-8');

  const resp = await fetch(`${factoryUrl}/api/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: gameSource }),
  });

  const data = await resp.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error('Compile errors:\n' + data.errors.join('\n'));
  }
  return data.code;
}

export default async function build({ args, cwd, factoryUrl }) {
  const useRemote = args.includes('--remote');
  const gameFile = join(cwd, 'game.js');

  if (!existsSync(gameFile)) {
    throw new Error('No game.js found. Run "game-studio init <name>" first or cd into a game project.');
  }

  const source = readFileSync(gameFile, 'utf-8');
  console.log(`Building game.js (${source.length} bytes)...`);

  let code;
  if (useRemote) {
    console.log(`  Using remote build via ${factoryUrl}`);
    code = await buildRemote(cwd, factoryUrl);
  } else {
    try {
      console.log('  Using local esbuild-wasm...');
      code = await buildLocal(cwd);
    } catch (err) {
      console.log(`  Local build failed (${err.message}), trying remote...`);
      code = await buildRemote(cwd, factoryUrl);
    }
  }

  const distDir = join(cwd, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'game.bundle.js'), code);

  console.log(`\nBuild complete: dist/game.bundle.js (${code.length} bytes)`);
  console.log(`  Source: ${source.length} bytes → Bundle: ${code.length} bytes`);
}
