#!/usr/bin/env node
/**
 * game-studio — CLI for creating games with the Game Factory engine SDK.
 *
 * Commands:
 *   init <name>     Scaffold a new game project
 *   build           Bundle game.js → dist/game.bundle.js
 *   eval            Run AI eval against Game Factory
 *   fix             Auto-fix open GitHub issues
 *   publish         Push game to GitHub
 *   pull-sdk        Pull latest @engine SDK from Game Factory
 *   serve           Start local dev server with hot reload
 *   info            Show project info and architecture
 *   title-card      Generate title card image via Gemini (Nano Banana)
 */

import { resolve, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const args = process.argv.slice(2);
const command = args[0];
const cwd = process.cwd();

// Load config
function loadConfig() {
  const configPath = join(cwd, 'game-studio.json');
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return {};
}

const COMMANDS = {
  init: () => import('../lib/init.js'),
  build: () => import('../lib/build.js'),
  eval: () => import('../lib/eval.js'),
  fix: () => import('../lib/fix.js'),
  publish: () => import('../lib/publish.js'),
  'pull-sdk': () => import('../lib/pull-sdk.js'),
  serve: () => import('../lib/serve.js'),
  info: () => import('../lib/info.js'),
  'title-card': () => import('../lib/title-card.js'),
};

function printUsage() {
  console.log(`
  game-studio — Build games with the Game Factory engine SDK

  Usage:
    game-studio <command> [options]

  Commands:
    init <name>       Scaffold a new game project
    build             Bundle game.js → dist/game.bundle.js via esbuild-wasm
    eval              Run AI quality eval via Game Factory API
    fix               Auto-fix open GitHub issues via Game Factory API
    publish           Push/sync game to GitHub repo
    pull-sdk          Pull latest @engine SDK modules from Game Factory
    serve             Start local dev server (port 8080)
    info              Show project config and architecture diagram
    title-card        Generate title card image via Gemini AI (Nano Banana)
                      Use --gif <path> for enhanced mode with gameplay GIF compositing

  Options:
    --factory <url>   Game Factory URL (default: http://localhost:3000)
    --help            Show this help message

  Config:
    Place a game-studio.json in your project root:
    {
      "name": "my-game",
      "factory": "http://localhost:3000",
      "github": { "owner": "username", "repo": "my-game" }
    }

  Architecture:
    See ARCHITECTURE.md for the full system diagram.
`);
}

async function main() {
  if (!command || command === '--help' || command === 'help') {
    printUsage();
    process.exit(0);
  }

  if (!COMMANDS[command]) {
    console.error(`Unknown command: ${command}`);
    console.error(`Run "game-studio --help" for usage.`);
    process.exit(1);
  }

  try {
    const mod = await COMMANDS[command]();
    const config = loadConfig();
    const factoryUrl = args.find((_, i) => args[i - 1] === '--factory') || config.factory || 'http://localhost:3000';
    await mod.default({ args: args.slice(1), cwd, config, factoryUrl });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
