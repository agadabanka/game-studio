/**
 * vision-diff/diff.js — ECS diff generator and patch applier.
 *
 * Transforms validator issues into structured ECS patches that modify
 * specific components, resources, or system calls — never full rewrites.
 */

/**
 * ECS Diff format:
 * {
 *   patches: [
 *     {
 *       type: 'component_update' | 'resource_update' | 'system_fix' | 'system_add' | 'display_config',
 *       target: string,          // What system/component/resource to modify
 *       description: string,     // Human-readable explanation
 *       validator: string,       // Which validator reported this
 *       severity: string,        // critical | high | medium | low
 *       diff: {
 *         action: 'modify' | 'add' | 'remove' | 'add_after_line' | 'replace_line',
 *         anchor: string,        // Line or pattern to find in source
 *         code: string,          // New code to insert/replace
 *         field: string,         // For resource/component updates
 *         from: any,             // Previous value
 *         to: any,               // New value
 *       }
 *     }
 *   ],
 *   summary: { total_issues, critical, high, medium, low, estimated_score_impact }
 * }
 */

const DIFF_GENERATOR_PROMPT = `You are an ECS game code patcher for the @engine SDK.
Given validator issues and the current game.js source, generate MINIMAL targeted patches.

Available @engine APIs:
- defineGame(config) — config.display (type, width, height, cellSize, background, canvasWidth, canvasHeight)
- game.component(name, defaults) — register component
- game.resource(name, defaults) — register singleton resource
- game.system(name, fn(world, dt)) — register system
- world.createEntity() / world.destroyEntity(eid)
- world.addComponent(eid, name, data) / world.getComponent(eid, name) / world.removeComponent(eid, name)
- world.query(componentName) — returns entity IDs with that component
- world.getResource(name) / world.setResource(name, value)
- world.emit(event, data) / world.on(event, handler)
- @engine/render: clearCanvas, drawGridBoard, drawPieceCells, drawHUD, drawGameOver, drawBorder, drawHighlight, drawEntitiesAsText
- @engine/grid: rotateShape, collides, clearLines, ghostY, lockCells, wrapPosition
- @engine/input: consumeAction, moveCursor

Rules:
1. Each patch modifies ONE thing — a single component default, resource value, system call, or display config
2. Use ONLY the existing @engine API — never introduce new functions or imports
3. Patches must reference exact text anchors in the source (a line or unique code pattern)
4. Prefer modifying existing code over adding new code
5. Never rewrite entire systems — surgical fixes only
6. For rendering issues: usually a missing drawX() call in the render system
7. For gameplay issues: usually a missing check or wrong condition in a game logic system
8. For layout issues: usually a display config value (cellSize, offsets, canvas dimensions)

Return ONLY a JSON array of patch objects. Each patch:
{
  "type": "system_fix|component_update|resource_update|display_config|system_add",
  "target": "<system name or component name>",
  "description": "<what this fixes>",
  "severity": "<from validator>",
  "validator": "<aesthetics|layout|gameplay>",
  "diff": {
    "action": "replace_line|add_after_line|modify",
    "anchor": "<exact text to find in source>",
    "code": "<new code>"
  }
}`;

/**
 * Generate ECS diff patches from validator issues.
 *
 * @param {string} gameSource - Current game.js source code
 * @param {object[]} issues - Aggregated issues from validators
 * @param {string} factoryUrl - Game Factory URL
 * @returns {object} { patches, summary }
 */
export async function generateECSDiffs(gameSource, issues, factoryUrl) {
  if (issues.length === 0) {
    return { patches: [], summary: { total_issues: 0, critical: 0, high: 0, medium: 0, low: 0, estimated_score_impact: 0 } };
  }

  const userPrompt = `Current game.js source (${gameSource.length} bytes):
\`\`\`javascript
${gameSource}
\`\`\`

Validator issues to fix:
${JSON.stringify(issues, null, 2)}

Generate minimal ECS patches to fix these issues. Return ONLY a JSON array.`;

  try {
    const resp = await fetch(`${factoryUrl}/api/eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spec: { _tsSource: gameSource, _specType: 'ts' },
        telemetry: {
          source: 'vision-diff-patcher',
          timestamp: Date.now(),
          systemPrompt: DIFF_GENERATOR_PROMPT,
          userPrompt,
          issueCount: issues.length,
        },
      }),
    });

    if (!resp.ok) {
      throw new Error(`Diff generation failed: ${resp.status}`);
    }

    const result = await resp.json();

    // Parse patches from the response
    let patches = [];
    try {
      // The eval endpoint returns analysis — try parsing it as JSON
      const analysis = result.analysis || result.fixed_source || '';
      const parsed = typeof analysis === 'string' ? extractJSON(analysis) : analysis;
      patches = Array.isArray(parsed) ? parsed : parsed.patches || [];
    } catch {
      // If the eval returned a fixed_spec, we can compute a diff ourselves
      if (result.fixed_spec?._tsSource) {
        patches = computeSourceDiff(gameSource, result.fixed_spec._tsSource, issues);
      }
    }

    const summary = {
      total_issues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      estimated_score_impact: Math.min(patches.length * 5, 30),
    };

    return { patches, summary };
  } catch (err) {
    console.error(`  Diff generation error: ${err.message}`);
    return { patches: [], summary: { total_issues: issues.length, error: err.message } };
  }
}

/**
 * Extract JSON from a text response that might contain markdown or prose.
 */
function extractJSON(text) {
  // Try direct parse
  try { return JSON.parse(text); } catch {}

  // Try extracting from code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch {}
  }

  // Try extracting array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try { return JSON.parse(arrayMatch[0]); } catch {}
  }

  return [];
}

/**
 * When we get a full fixed source instead of patches, compute a simple line-level diff.
 * Maps changes back to validator issues by proximity.
 */
function computeSourceDiff(original, fixed, issues) {
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  const patches = [];

  // Simple LCS-based diff
  let oi = 0, fi = 0;
  while (oi < origLines.length && fi < fixedLines.length) {
    if (origLines[oi].trim() === fixedLines[fi].trim()) {
      oi++;
      fi++;
    } else {
      // Found a difference — create a patch
      patches.push({
        type: 'system_fix',
        target: 'auto-detected',
        description: `Line ${oi + 1} modified`,
        severity: 'medium',
        validator: issues[0]?.validator || 'auto',
        diff: {
          action: 'replace_line',
          anchor: origLines[oi].trim(),
          code: fixedLines[fi].trim(),
        },
      });
      oi++;
      fi++;
    }
  }

  return patches;
}

/**
 * Apply patches to game source code.
 * Returns the modified source.
 *
 * @param {string} source - Original game.js source
 * @param {object[]} patches - Array of patch objects
 * @returns {string} Modified source
 */
export function applyPatches(source, patches) {
  let result = source;
  let applied = 0;
  let skipped = 0;

  for (const patch of patches) {
    const { diff } = patch;
    if (!diff || !diff.anchor) {
      skipped++;
      continue;
    }

    const anchorIdx = result.indexOf(diff.anchor);
    if (anchorIdx === -1) {
      // Try fuzzy match (trimmed, case-insensitive)
      const lines = result.split('\n');
      const matchIdx = lines.findIndex(l => l.trim() === diff.anchor.trim());
      if (matchIdx === -1) {
        skipped++;
        continue;
      }

      // Apply at matched line
      if (diff.action === 'replace_line') {
        lines[matchIdx] = lines[matchIdx].replace(lines[matchIdx].trim(), diff.code);
        result = lines.join('\n');
        applied++;
      } else if (diff.action === 'add_after_line') {
        const indent = lines[matchIdx].match(/^(\s*)/)[1];
        lines.splice(matchIdx + 1, 0, indent + diff.code);
        result = lines.join('\n');
        applied++;
      }
    } else {
      // Exact match found
      if (diff.action === 'replace_line') {
        // Replace the line containing the anchor
        const lineStart = result.lastIndexOf('\n', anchorIdx) + 1;
        const lineEnd = result.indexOf('\n', anchorIdx);
        const originalLine = result.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        result = result.slice(0, lineStart) + originalLine.replace(diff.anchor, diff.code) +
          (lineEnd === -1 ? '' : result.slice(lineEnd));
        applied++;
      } else if (diff.action === 'add_after_line') {
        const lineEnd = result.indexOf('\n', anchorIdx);
        if (lineEnd !== -1) {
          const indent = result.slice(result.lastIndexOf('\n', anchorIdx) + 1, anchorIdx).match(/^(\s*)/)[1];
          result = result.slice(0, lineEnd + 1) + indent + diff.code + '\n' + result.slice(lineEnd + 1);
          applied++;
        }
      } else if (diff.action === 'modify') {
        result = result.replace(diff.anchor, diff.code);
        applied++;
      }
    }
  }

  console.log(`  Applied ${applied}/${patches.length} patches (${skipped} skipped)`);
  return result;
}

export { DIFF_GENERATOR_PROMPT };
