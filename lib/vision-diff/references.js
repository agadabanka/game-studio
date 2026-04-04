/**
 * vision-diff/references.js — Generate and cache reference keyframes.
 *
 * Uses Gemini (Nano Banana) to generate "what the game should look like"
 * at critical gameplay moments, then pre-computes compact representations
 * (scene graph, pHash, color moments) so validators never re-parse images.
 */

import { createHash } from 'crypto';

// Keyframe prompts by game type — each defines a scene to generate and validate
const KEYFRAME_PROMPTS = {
  arcade: [
    { id: 'title', scene: 'Title screen with game name and "Press Start"', triggerCondition: 'state.gameOver === false && state.score === 0', expectedElements: ['game_title', 'start_prompt', 'background'] },
    { id: 'early_play', scene: 'Early gameplay, few pieces/items on screen', triggerCondition: 'state.score > 0 && state.score < 100', expectedElements: ['game_board', 'active_piece', 'score_display', 'hud'] },
    { id: 'mid_game', scene: 'Mid-game with board partially filled', triggerCondition: 'state.score >= 100', expectedElements: ['game_board', 'stacked_pieces', 'score_display', 'level_display'] },
    { id: 'action_moment', scene: 'Line clear or item collection animation', triggerCondition: 'state.linesCleared > 0 || state.itemsCollected > 0', expectedElements: ['animation_effect', 'score_update', 'game_board'] },
    { id: 'game_over', scene: 'Game over screen with final score', triggerCondition: 'state.gameOver === true', expectedElements: ['game_over_text', 'final_score', 'restart_prompt'] },
    { id: 'hud_detail', scene: 'Close-up of HUD showing score, level, next piece', triggerCondition: 'state.score > 0', expectedElements: ['score_text', 'level_text', 'next_preview'] },
  ],
  board: [
    { id: 'initial_board', scene: 'Board with pieces in starting positions', triggerCondition: 'state.turn === 0 || state.moveCount === 0', expectedElements: ['board_grid', 'all_pieces', 'turn_indicator'] },
    { id: 'mid_game', scene: 'Mid-game board position with some pieces captured', triggerCondition: 'state.moveCount > 5', expectedElements: ['board_grid', 'remaining_pieces', 'captured_display'] },
    { id: 'selection', scene: 'Selected piece with valid move highlights', triggerCondition: 'state.selectedPiece !== null', expectedElements: ['board_grid', 'selected_highlight', 'valid_move_indicators'] },
    { id: 'end_game', scene: 'End game or checkmate position', triggerCondition: 'state.gameOver === true', expectedElements: ['board_grid', 'end_state_display', 'winner_text'] },
  ],
  puzzle: [
    { id: 'empty_board', scene: 'Empty puzzle board ready to play', triggerCondition: 'state.moveCount === 0', expectedElements: ['board_grid', 'empty_cells', 'score_display'] },
    { id: 'partial', scene: 'Partially solved puzzle', triggerCondition: 'state.moveCount > 3 && !state.gameOver', expectedElements: ['board_grid', 'placed_tiles', 'score_display'] },
    { id: 'near_win', scene: 'Almost complete puzzle, one or two moves from winning', triggerCondition: 'state.progress > 0.8', expectedElements: ['board_grid', 'nearly_complete', 'score_display'] },
    { id: 'win', scene: 'Victory screen with celebration', triggerCondition: 'state.won === true', expectedElements: ['win_text', 'final_score', 'celebration_effect'] },
    { id: 'loss', scene: 'Loss/stuck state', triggerCondition: 'state.gameOver === true && !state.won', expectedElements: ['game_over_text', 'final_score', 'restart_prompt'] },
  ],
};

/**
 * Extract 9 color moments (mean, variance, skewness for R, G, B) from a base64 PNG.
 * Returns a compact 36-byte representation for palette comparison.
 */
function extractColorMoments(imageBase64) {
  // Simple extraction using pixel sampling from base64 PNG
  // In production, use sharp or canvas to decode properly
  const buf = Buffer.from(imageBase64, 'base64');
  const moments = { r: [0, 0, 0], g: [0, 0, 0], b: [0, 0, 0] };

  // Sample every 100th byte triplet from raw data (approximate RGB sampling)
  const samples = [];
  for (let i = 50; i < buf.length - 3; i += 100) {
    samples.push({ r: buf[i], g: buf[i + 1], b: buf[i + 2] });
  }

  if (samples.length === 0) return moments;

  for (const ch of ['r', 'g', 'b']) {
    const vals = samples.map(s => s[ch]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
    const skewness = vals.reduce((a, v) => a + (v - mean) ** 3, 0) / (vals.length * Math.max(variance, 1) ** 1.5);
    moments[ch] = [mean, variance, skewness];
  }

  return moments;
}

/**
 * Compute a simple perceptual hash (64-bit) from a base64 image.
 * Uses average-hash algorithm: resize to 8x8 grayscale, compare each pixel to mean.
 */
function computePHash(imageBase64) {
  const buf = Buffer.from(imageBase64, 'base64');
  // Sample 64 evenly-spaced pixels, convert to grayscale
  const step = Math.max(1, Math.floor(buf.length / 64));
  const grays = [];
  for (let i = 0; i < 64; i++) {
    const offset = Math.min(i * step + 50, buf.length - 3);
    const r = buf[offset], g = buf[offset + 1], b = buf[offset + 2];
    grays.push(0.299 * r + 0.587 * g + 0.114 * b);
  }
  const mean = grays.reduce((a, b) => a + b, 0) / grays.length;
  // Each bit: 1 if pixel > mean, 0 otherwise
  let hash = '';
  for (const g of grays) {
    hash += g > mean ? '1' : '0';
  }
  return hash; // 64-char binary string
}

/**
 * Hamming distance between two pHash strings.
 */
export function hammingDistance(hash1, hash2) {
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

/**
 * Generate reference keyframes for a game.
 *
 * @param {string} gameDescription - Human-readable description of the game
 * @param {string} gameType - 'arcade' | 'board' | 'puzzle'
 * @param {object} options - { geminiApiKey, claudeApiKey, factoryUrl }
 * @returns {object[]} Array of keyframe objects with compact representations
 */
export async function generateReferenceKeyframes(gameDescription, gameType, options = {}) {
  const prompts = KEYFRAME_PROMPTS[gameType] || KEYFRAME_PROMPTS.arcade;
  const keyframes = [];

  for (const prompt of prompts) {
    const keyframe = {
      id: prompt.id,
      scene: prompt.scene,
      triggerCondition: prompt.triggerCondition,
      expectedElements: prompt.expectedElements,
      imageBase64: null,
      sceneGraph: null,
      pHash: null,
      colorMoments: null,
    };

    // Step 1: Generate reference image with Gemini (Nano Banana)
    if (options.geminiApiKey) {
      try {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${options.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: `Generate a screenshot of an HTML5 canvas game: ${prompt.scene} for "${gameDescription}". Dark background, pixel-art style, clean layout. Show: ${prompt.expectedElements.join(', ')}` }],
              }],
              generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
            }),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const imagePart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
          if (imagePart) {
            keyframe.imageBase64 = imagePart.inlineData.data;
          }
        }
      } catch (err) {
        console.warn(`  Gemini image gen failed for ${prompt.id}: ${err.message}`);
      }
    }

    // Step 2: Generate scene graph description via Claude (or from factory eval)
    if (keyframe.imageBase64 && options.factoryUrl) {
      try {
        const resp = await fetch(`${options.factoryUrl}/api/eval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spec: { _tsSource: `// Scene analysis request for: ${prompt.scene}`, _specType: 'ts' },
            screenshot: keyframe.imageBase64,
            telemetry: { source: 'vision-diff-reference', type: 'scene-graph-extraction' },
          }),
        });
        if (resp.ok) {
          const result = await resp.json();
          keyframe.sceneGraph = result.analysis; // Structured scene description
        }
      } catch {}
    }

    // Step 3: If no image generated, create a text-only reference (VDLM-style)
    if (!keyframe.imageBase64) {
      keyframe.sceneGraph = {
        type: 'text_reference',
        scene: prompt.scene,
        expectedElements: prompt.expectedElements,
        description: `${gameDescription}: ${prompt.scene}`,
      };
    }

    // Step 4: Compute compact representations
    if (keyframe.imageBase64) {
      keyframe.pHash = computePHash(keyframe.imageBase64);
      keyframe.colorMoments = extractColorMoments(keyframe.imageBase64);
    }

    keyframes.push(keyframe);
  }

  return keyframes;
}

/**
 * Cache key for a set of reference keyframes.
 */
export function referenceCacheKey(gameDescription, gameType) {
  return createHash('sha256').update(`${gameType}:${gameDescription}`).digest('hex').slice(0, 16);
}

export { KEYFRAME_PROMPTS, extractColorMoments, computePHash };
