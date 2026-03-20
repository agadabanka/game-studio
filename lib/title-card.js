/**
 * game-studio title-card — Generate beautiful title card images for games.
 *
 * Uses the Gemini (Nano Banana) image generation API to create
 * professional game title card PNGs. Reads GEMINI_API_KEY from
 * environment (never stored in repo).
 *
 * Usage:
 *   game-studio title-card                # Generate for current game
 *   game-studio title-card --style pixel  # Pixel art style
 *   game-studio title-card --style neon   # Neon/cyberpunk style
 *   game-studio title-card --style retro  # Retro arcade style
 *   game-studio title-card --style painterly  # Painterly/illustrated
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const STYLE_PROMPTS = {
  pixel: 'pixel art style with rich 16-bit color palette, crisp pixels, retro gaming aesthetic',
  neon: 'neon cyberpunk style with glowing edges, dark background, vibrant electric colors',
  retro: 'classic retro arcade cabinet art style, bold colors, 80s aesthetic, dramatic lighting',
  painterly: 'painterly illustrated style, rich textures, hand-painted feel, warm lighting',
  minimal: 'clean minimalist design, bold typography, flat colors, modern aesthetic',
};

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

function buildPrompt(gameName, style) {
  const theme = GAME_THEMES[gameName] || {
    genre: 'video game',
    elements: `visual elements representing ${gameName}`,
  };
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.retro;

  const displayName = gameName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    `Generate a professional game title card image for "${displayName}". ` +
    `This is a ${theme.genre}. ` +
    `Visual elements to include: ${theme.elements}. ` +
    `The game title "${displayName}" must be prominently displayed as large, clear, readable text. ` +
    `Style: ${styleDesc}. ` +
    `The image should be a 16:9 landscape title screen suitable for a web game. ` +
    `Include a subtle "Press Start" or "Click to Play" text at the bottom. ` +
    `Make it visually stunning and professional — this is the first thing players see.`
  );
}

async function generateTitleCard(gameName, apiKey, style) {
  const prompt = buildPrompt(gameName, style);

  const resp = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error (${resp.status}): ${errText}`);
  }

  const data = await resp.json();

  // Extract the image from the response
  const candidates = data.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        return {
          data: Buffer.from(part.inlineData.data, 'base64'),
          mimeType: part.inlineData.mimeType || 'image/png',
        };
      }
    }
  }

  throw new Error('No image returned from Gemini API. Response: ' + JSON.stringify(data).slice(0, 500));
}

export default async function titleCard({ args, cwd, config }) {
  // Check for --gif flag (enhanced mode with gameplay GIF compositing)
  const gifIndex = args.indexOf('--gif');
  const gifPath = gifIndex !== -1 && args[gifIndex + 1]
    ? join(cwd, args[gifIndex + 1])
    : null;

  if (gifPath) {
    // Enhanced mode: analyze GIF, generate background, composite
    console.log('Enhanced title card mode: using gameplay GIF compositing...');
    const { execSync } = await import('child_process');
    const scriptPath = join(cwd, 'docs', 'generate_title_card_with_gif.py');
    const gameName = config.name || args.find(a => !a.startsWith('-')) || 'game';
    const env = { ...process.env };
    if (process.env.GEMINI_API_KEY) {
      env.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    }
    try {
      execSync(
        `python3 "${scriptPath}" "${gameName}" --gif "${gifPath}"`,
        { cwd, env, stdio: 'inherit' }
      );
      return;
    } catch (e) {
      throw new Error(`Enhanced title card generation failed: ${e.message}`);
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable not set.\n' +
      'Set it with: export GEMINI_API_KEY=your-key-here\n' +
      'Get a key at: https://ai.google.dev/'
    );
  }

  const gameName = config.name || args[0];
  if (!gameName) {
    throw new Error('No game name found. Run from a game project directory or pass the name.');
  }

  const style = args.find((_, i) => args[i - 1] === '--style') || 'retro';
  if (!STYLE_PROMPTS[style]) {
    console.log(`Available styles: ${Object.keys(STYLE_PROMPTS).join(', ')}`);
    throw new Error(`Unknown style: ${style}`);
  }

  console.log(`Generating title card for "${gameName}" (style: ${style})...`);
  console.log(`  Using Gemini model: ${GEMINI_MODEL}`);

  const image = await generateTitleCard(gameName, apiKey, style);

  // Determine output path
  const ext = image.mimeType.includes('png') ? 'png' : 'jpg';
  const assetsDir = join(cwd, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  const outputPath = join(assetsDir, `title-card.${ext}`);

  writeFileSync(outputPath, image.data);
  console.log(`\n  Title card saved: assets/title-card.${ext}`);
  console.log(`  Size: ${(image.data.length / 1024).toFixed(1)} KB`);

  // Update index.html to include title screen overlay if not already present
  const htmlPath = join(cwd, 'index.html');
  if (existsSync(htmlPath)) {
    let html = readFileSync(htmlPath, 'utf-8');
    if (!html.includes('title-overlay')) {
      html = injectTitleScreen(html, `assets/title-card.${ext}`, gameName);
      writeFileSync(htmlPath, html);
      console.log('  Updated index.html with title screen overlay.');
    } else {
      console.log('  index.html already has title screen overlay.');
    }
  }

  console.log('\n  Players will see the title card before gameplay starts.');
  console.log('  Click or press any key to dismiss and start playing.');
}

function injectTitleScreen(html, imagePath, gameName) {
  const displayName = gameName
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const titleScreenCSS = `
  #title-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #000; display: flex; justify-content: center; align-items: center;
    z-index: 1000; cursor: pointer; transition: opacity 0.5s ease;
  }
  #title-overlay.hidden { opacity: 0; pointer-events: none; }
  #title-overlay img {
    max-width: 90%; max-height: 85vh; object-fit: contain;
    border-radius: 8px; box-shadow: 0 0 40px rgba(59,130,246,0.3);
  }
  #title-overlay .start-hint {
    position: absolute; bottom: 40px; color: #888; font-size: 14px;
    font-family: monospace; animation: blink 1.5s infinite;
  }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`;

  const titleScreenHTML = `
<div id="title-overlay">
  <img src="${imagePath}" alt="${displayName} Title Card">
  <div class="start-hint">Click or press any key to play</div>
</div>`;

  const titleScreenJS = `
  const overlay = document.getElementById('title-overlay');
  function dismissTitle() {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.style.display = 'none', 500);
    document.removeEventListener('keydown', dismissTitle);
    overlay.removeEventListener('click', dismissTitle);
  }
  overlay.addEventListener('click', dismissTitle);
  document.addEventListener('keydown', dismissTitle);`;

  // Inject CSS into <style> block
  html = html.replace('</style>', titleScreenCSS + '\n</style>');

  // Inject HTML before canvas
  html = html.replace('<canvas', titleScreenHTML + '\n<canvas');

  // Inject JS into script block (after game.start)
  html = html.replace(
    /game\.start\([^)]*\);/,
    (match) => match + '\n' + titleScreenJS
  );

  return html;
}
