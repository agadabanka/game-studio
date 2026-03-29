#!/usr/bin/env node
/**
 * Batch generate title cards for all 29 games using Gemini (Nano Banana) API.
 *
 * Usage:
 *   GEMINI_API_KEY=your-key node docs/generate_title_cards.js
 *   GEMINI_API_KEY=your-key node docs/generate_title_cards.js --style neon
 *   GEMINI_API_KEY=your-key node docs/generate_title_cards.js --game chess
 *
 * Output: docs/title-cards/<game-name>.png for each game
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GAMES = [
  'chess', 'tetris', 'snake', 'ludo', 'tic-tac-toe', 'simon', 'lights-out',
  'whack-a-mole', 'space-invaders', 'hangman', 'sliding-puzzle', 'sudoku',
  'memory', 'battleship', 'game2048', 'connect4', 'roguelike', 'tower-defense',
  'flappy', 'solitaire', 'match3', 'gomoku', 'reversi', 'wordle', 'blackjack',
  'pong', 'minesweeper', 'checkers', 'breakout',
];

const GAME_THEMES = {
  chess: { genre: 'strategic board game', elements: 'chess pieces, checkered board, black and white contrast, kings and queens' },
  tetris: { genre: 'puzzle game', elements: 'falling colorful blocks, tetrominoes, completed lines glowing, grid background' },
  snake: { genre: 'arcade game', elements: 'coiled snake, apple/food, grid maze, green on dark background' },
  ludo: { genre: 'board game', elements: 'colorful game tokens (red, blue, green, yellow), dice, cross-shaped board' },
  'tic-tac-toe': { genre: 'classic game', elements: 'X and O marks, grid lines, playful style' },
  simon: { genre: 'memory game', elements: 'four colored quadrants (red, blue, green, yellow), glowing buttons, circular design' },
  'lights-out': { genre: 'puzzle game', elements: 'grid of glowing lights, some on some off, neon bulbs, dark room' },
  'whack-a-mole': { genre: 'reaction game', elements: 'cute moles popping from holes, mallet, grassy field, fun playful mood' },
  'space-invaders': { genre: 'shoot-em-up', elements: 'pixel alien invaders, laser cannon, shields, starfield background, classic formation' },
  hangman: { genre: 'word game', elements: 'gallows silhouette, alphabet letters, mystery word with blanks, dramatic lighting' },
  'sliding-puzzle': { genre: 'puzzle game', elements: 'numbered tiles in grid, one empty space, sliding motion blur' },
  sudoku: { genre: 'number puzzle', elements: '9x9 grid with numbers, pencil marks, clean mathematical feel' },
  memory: { genre: 'card matching game', elements: 'face-down cards, flipping animation, matched pairs revealed, colorful backs' },
  battleship: { genre: 'naval strategy', elements: 'ocean grid, battleships, explosions, radar pings, naval warfare' },
  game2048: { genre: 'sliding number puzzle', elements: 'numbered tiles (2,4,8,16...2048), merging animation, warm gradient colors' },
  connect4: { genre: 'strategy game', elements: 'vertical blue board, red and yellow discs, dropping animation' },
  roguelike: { genre: 'dungeon crawler', elements: 'dark dungeon, torch light, pixel hero, treasure chest, monster silhouettes' },
  'tower-defense': { genre: 'strategy game', elements: 'towers along a path, waves of enemies, projectiles, fantasy landscape' },
  flappy: { genre: 'arcade game', elements: 'small bird character, green pipes, blue sky, side-scrolling motion' },
  solitaire: { genre: 'card game', elements: 'playing cards in tableau layout, green felt table, card suits' },
  match3: { genre: 'casual puzzle', elements: 'colorful gems/jewels, match-3 grid, sparkling effects, cascading matches' },
  gomoku: { genre: 'strategy board game', elements: 'Go-style board with black and white stones, five in a row highlighted' },
  reversi: { genre: 'strategy board game', elements: 'black and white discs on green board, flipping disc animation' },
  wordle: { genre: 'word puzzle', elements: 'letter tiles in green/yellow/gray, 5-letter grid, keyboard below' },
  blackjack: { genre: 'casino card game', elements: 'playing cards showing 21, poker chips, green felt table, ace and king' },
  pong: { genre: 'arcade classic', elements: 'two paddles, bouncing ball, score display, minimalist court lines' },
  minesweeper: { genre: 'puzzle game', elements: 'grid with numbered cells, flags, hidden mines, one revealed explosion' },
  checkers: { genre: 'board game', elements: 'red and black pieces on checkerboard, kinged piece with crown' },
  breakout: { genre: 'arcade game', elements: 'paddle at bottom, bouncing ball, colorful brick wall, breaking bricks' },
};

const STYLE_PROMPTS = {
  pixel: 'pixel art style with rich 16-bit color palette, crisp pixels, retro gaming aesthetic',
  neon: 'neon cyberpunk style with glowing edges, dark background, vibrant electric colors',
  retro: 'classic retro arcade cabinet art style, bold colors, 80s aesthetic, dramatic lighting',
  painterly: 'painterly illustrated style, rich textures, hand-painted feel, warm lighting',
  minimal: 'clean minimalist design, bold typography, flat colors, modern aesthetic',
};

function buildPrompt(gameName, style) {
  const theme = GAME_THEMES[gameName] || { genre: 'video game', elements: gameName };
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.retro;
  const displayName = gameName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    `Generate a professional game title card image for "${displayName}". ` +
    `This is a ${theme.genre}. ` +
    `Visual elements: ${theme.elements}. ` +
    `The game title "${displayName}" must be prominently displayed as large, clear, readable text. ` +
    `Style: ${styleDesc}. ` +
    `16:9 landscape title screen for a web game. ` +
    `Include subtle "Press Start" text at the bottom. ` +
    `Make it visually stunning and professional.`
  );
}

async function generateImage(gameName, apiKey, style) {
  const prompt = buildPrompt(gameName, style);
  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  for (const candidate of (data.candidates || [])) {
    for (const part of (candidate.content?.parts || [])) {
      if (part.inlineData) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }
  }
  throw new Error('No image in response');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: Set GEMINI_API_KEY environment variable');
    console.error('       For GIF-based generation without API:');
    console.error('       python3 docs/generate_title_card_with_gif.py <game> --gif <gif-path>');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const style = args.find((_, i) => args[i - 1] === '--style') || 'retro';
  const singleGame = args.find((_, i) => args[i - 1] === '--game');

  const games = singleGame ? [singleGame] : GAMES;
  const outDir = join(__dirname, 'title-cards');
  mkdirSync(outDir, { recursive: true });

  console.log(`Generating ${games.length} title cards (style: ${style})...\n`);

  let ok = 0, fail = 0;
  for (const game of games) {
    const outPath = join(outDir, `${game}.png`);
    if (existsSync(outPath) && !singleGame) {
      console.log(`  [skip] ${game} — already exists`);
      ok++;
      continue;
    }

    process.stdout.write(`  [gen]  ${game}... `);
    try {
      const imageData = await generateImage(game, apiKey, style);
      writeFileSync(outPath, imageData);
      console.log(`ok (${(imageData.length / 1024).toFixed(0)} KB)`);
      ok++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      fail++;
    }

    // Rate limit: ~2 seconds between requests
    if (games.indexOf(game) < games.length - 1) {
      await sleep(2500);
    }
  }

  console.log(`\nDone: ${ok} generated, ${fail} failed`);
  console.log(`Output: docs/title-cards/`);
}

main();
