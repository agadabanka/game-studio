/**
 * vision-diff/validators.js — Three specialized visual validators.
 *
 * Each validator has a narrow focus and returns structured JSON issues,
 * not prose. They are only invoked for keyframes that reach Tier 3+
 * in the tiered comparison pipeline.
 *
 * Validators:
 *   1. Aesthetics — color, clarity, HUD readability, proportions
 *   2. Layout — spatial arrangement, canvas utilization, positioning
 *   3. Gameplay — entity presence, state consistency, rule correctness
 */

// ── Validator System Prompts ────────────────────────────────────────

const AESTHETICS_PROMPT = `You are a game aesthetics validator for HTML5 canvas games.
Compare the REFERENCE image/description against the ACTUAL game screenshot.
Focus ONLY on visual quality:
- Color palette consistency (background, accents, text colors)
- Visual clarity (is the game board/play area clearly defined?)
- HUD readability (score, level, status text visible and legible?)
- Element proportions (cells right size, text readable, no overlap)
- Animation/effect presence (line clears, highlights, transitions)

Return ONLY valid JSON:
{
  "issues": [
    { "element": "<what>", "expected": "<description>", "actual": "<description>", "severity": "low|medium|high|critical" }
  ],
  "palette_match": <0-1 float>,
  "overall": "pass|fail"
}`;

const LAYOUT_PROMPT = `You are a game layout validator for HTML5 canvas games.
Compare spatial arrangement between REFERENCE and ACTUAL.
Focus ONLY on positioning and layout:
- Game board position and size relative to canvas
- HUD element positions (score, level, next piece, etc.)
- Margins and padding around game area
- Canvas utilization (too much dead space? elements cropped?)
- Alignment of elements (centered, left/right aligned as expected)

Return ONLY valid JSON:
{
  "issues": [
    { "element": "<what>", "expected": "<position/size>", "actual": "<position/size>", "severity": "low|medium|high|critical" }
  ],
  "layout_score": <0-1 float>,
  "overall": "pass|fail"
}`;

const GAMEPLAY_PROMPT = `You are a gameplay logic validator for ECS-based HTML5 canvas games.
Given the ECS state snapshot and screenshot, verify game mechanics:
- Are all expected entities present? (pieces, board cells, items)
- Is the game state consistent? (score matches display, positions match grid)
- Are game rules being followed? (collision, scoring, turn order)
- Are required UI elements present? (game over overlay, restart prompt, controls hint)
- Is the render system drawing all components? (no invisible entities)

ECS State:
{ecsState}

Expected elements for this scene:
{expectedElements}

Return ONLY valid JSON:
{
  "issues": [
    { "mechanic": "<what>", "expected": "<behavior>", "actual": "<behavior>", "severity": "low|medium|high|critical" }
  ],
  "entities_present": ["<list>"],
  "entities_missing": ["<list>"],
  "overall": "pass|fail"
}`;

/**
 * Build a vision eval request body for the Game Factory eval endpoint.
 * Uses the existing /api/eval with screenshot vision support.
 */
function buildEvalRequest(systemPrompt, referenceDesc, actualScreenshot, extraContext) {
  // Compose the user prompt with reference + actual
  let userPrompt = `REFERENCE (what the game SHOULD look like):\n${
    typeof referenceDesc === 'string' ? referenceDesc : JSON.stringify(referenceDesc, null, 2)
  }\n\nACTUAL game screenshot is attached as an image.\n`;

  if (extraContext) {
    if (extraContext.ecsState) {
      userPrompt += `\nECS State Snapshot:\n${JSON.stringify(extraContext.ecsState, null, 2)}\n`;
    }
    if (extraContext.expectedElements) {
      userPrompt += `\nExpected elements: ${extraContext.expectedElements.join(', ')}\n`;
    }
  }

  return {
    spec: { _tsSource: `// Validator request\n// ${systemPrompt.slice(0, 100)}`, _specType: 'ts' },
    screenshot: actualScreenshot,
    telemetry: {
      source: 'vision-diff-validator',
      timestamp: Date.now(),
      systemPrompt,
      userPrompt,
    },
  };
}

/**
 * Parse a validator response, handling potential JSON-in-text issues.
 */
function parseValidatorResponse(responseText) {
  // Try direct parse
  try {
    return JSON.parse(responseText);
  } catch {}

  // Extract JSON from markdown code blocks
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch {}
  }

  // Extract any JSON object
  const objMatch = responseText.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {}
  }

  // Fallback: return raw text as a single issue
  return {
    issues: [{ element: 'parse_error', expected: 'JSON response', actual: responseText.slice(0, 200), severity: 'low' }],
    overall: 'fail',
  };
}

/**
 * Run all three validators on a single keyframe pair.
 *
 * @param {object} reference - Reference keyframe (from references.js)
 * @param {object} actual - Actual capture (imageBase64, ecsState, sceneGraph)
 * @param {string} factoryUrl - Game Factory server URL
 * @returns {object} { aesthetics, layout, gameplay } — each with issues[] and overall
 */
export async function runValidators(reference, actual, factoryUrl) {
  // Use scene graph / text description as reference (not re-sending reference image)
  const referenceDesc = reference.sceneGraph || {
    scene: reference.scene,
    expectedElements: reference.expectedElements,
  };

  // Build requests for all 3 validators
  const requests = [
    { name: 'aesthetics', prompt: AESTHETICS_PROMPT },
    { name: 'layout', prompt: LAYOUT_PROMPT },
    { name: 'gameplay', prompt: GAMEPLAY_PROMPT },
  ];

  // Run all 3 in parallel
  const results = await Promise.all(
    requests.map(async ({ name, prompt }) => {
      const body = buildEvalRequest(
        prompt,
        referenceDesc,
        actual.imageBase64,
        name === 'gameplay' ? {
          ecsState: actual.ecsState,
          expectedElements: reference.expectedElements,
        } : undefined
      );

      try {
        const resp = await fetch(`${factoryUrl}/api/eval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          return { name, result: { issues: [], overall: 'error', error: `HTTP ${resp.status}` } };
        }

        const data = await resp.json();
        // The eval endpoint returns { analysis, score, bugs, ... }
        // Parse the analysis field for our structured JSON
        const parsed = parseValidatorResponse(data.analysis || JSON.stringify(data));
        return { name, result: parsed };
      } catch (err) {
        return { name, result: { issues: [], overall: 'error', error: err.message } };
      }
    })
  );

  const output = {};
  for (const { name, result } of results) {
    output[name] = result;
  }

  return output;
}

/**
 * Aggregate all validator issues into a flat list with validator attribution.
 */
export function aggregateIssues(validationResults) {
  const allIssues = [];

  for (const [validator, result] of Object.entries(validationResults)) {
    if (result.issues) {
      for (const issue of result.issues) {
        allIssues.push({ ...issue, validator });
      }
    }
  }

  // Sort by severity: critical > high > medium > low
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  allIssues.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  return allIssues;
}

export { AESTHETICS_PROMPT, LAYOUT_PROMPT, GAMEPLAY_PROMPT };
