# Vision-Diff Validation Loop Architecture

## Overview

A closed-loop system where AI-generated reference images are compared against actual gameplay output to produce structured ECS diffs that Game Studio applies as targeted patches. This replaces the current "score + text feedback + full rewrite" eval with a precise, iterative refinement cycle.

```
  +-----------+       +------------------+       +------------------+
  |  Genie    |       |  Game Engine     |       |  Delta Engine    |
  | (Gemini)  |------>|  (ECS Runtime)   |------>|  (Comparison)    |
  |           |       |                  |       |                  |
  | Generates |       | Produces actual  |       | Computes visual  |
  | reference |       | gameplay frames  |       | deltas between   |
  | keyframes |       | via AutoPlayer   |       | ref & actual     |
  +-----------+       +------------------+       +--------+---------+
                                                          |
                                                          v
  +-----------+       +------------------+       +------------------+
  |  Game     |       |  ECS Diff        |       |  3 Validators    |
  |  Studio   |<------| Generator        |<------|                  |
  |           |       |                  |       | Aesthetics       |
  | Applies   |       | Structured       |       | Camera/Layout    |
  | patches   |       | component/system |       | Gameplay Logic   |
  |           |       | patches          |       |                  |
  +-----------+       +------------------+       +------------------+
        |                                                 ^
        +------------------- loop back ------------------+
```

---

## Phase 1: Reference Image Generation (Option A — AI-Generated)

### What

Generate 5-8 keyframe mockups representing "what this game should look like" at critical gameplay moments. Not a video — a curated set of annotated reference images.

### Keyframe Set Per Game Type

| Game Type   | Keyframes |
|-------------|-----------|
| Arcade (Tetris, Snake) | Title screen, early play, mid-game (stacked), line clear animation, game over, HUD close-up |
| Board (Chess, Checkers) | Initial board, mid-game position, capture sequence, end-game, promotion |
| Puzzle (2048, Minesweeper) | Empty board, partial progress, near-win, win state, loss state |

### Generation Pipeline

```javascript
async function generateReferenceKeyframes(gameDescription, gameType) {
  const prompts = KEYFRAME_PROMPTS[gameType]; // 5-8 per type
  const keyframes = [];
  
  for (const prompt of prompts) {
    // Step 1: Generate image with Gemini (Nano Banana)
    const image = await gemini.generateImage({
      model: 'gemini-2.0-flash-preview-image-generation',
      prompt: `${prompt.scene} for a ${gameDescription}. 
               HTML5 canvas game, pixel-art style, dark background.
               Show: ${prompt.expectedElements.join(', ')}`,
    });
    
    // Step 2: Extract structured scene description (do this ONCE, cache it)
    const sceneDesc = await claude.analyze(image, {
      prompt: `Describe this game screenshot as a structured scene graph:
        - List each visual element (type, position_region, color, size_relative)
        - Identify the HUD elements and their positions  
        - Describe the game board/play area layout
        - Note the color palette (dominant, accent, background)
        Return JSON.`
    });
    
    // Step 3: Compute compact representations (all done once, stored)
    keyframes.push({
      id: prompt.id,
      scene: prompt.scene,
      imageBase64: image,                           // Full image (for VLM fallback)
      sceneGraph: sceneDesc,                        // Structured JSON (~2KB)
      clipEmbedding: await clip.embed(image),       // 512 floats (~2KB)
      pHash: await phash(image),                    // 64-bit hash (8 bytes)
      colorMoments: extractColorMoments(image),     // 9 floats (36 bytes)
      expectedElements: prompt.expectedElements,     // What MUST be visible
    });
  }
  
  return keyframes;
}
```

### Why Pre-Compute Representations

The core insight: **parse each reference image exactly once**, then store multiple compact representations that validators can use without re-invoking a VLM.

| Representation | Size | Speed | Best For |
|----------------|------|-------|----------|
| Scene Graph JSON | ~2KB | Instant | Structural comparison (elements present/missing) |
| pHash | 8 bytes | <1ms | Quick "did anything change?" gate |
| CLIP Embedding | 2KB | ~50ms | Semantic similarity score |
| Color Moments | 36 bytes | <1ms | Palette drift detection |
| Full Base64 Image | ~100KB | ~$0.01 | VLM deep analysis (last resort) |

---

## Phase 2: Actual Gameplay Capture

Leverages the **existing** infrastructure in Game Factory's `index.html`:

- **AutoPlayer** (line 2888): Plays the game for 8 seconds with random actions
- **TelemetryCollector** (line 2971): Snapshots every 500ms during play
- **captureScreenshot()** (line 2670): `canvas.toDataURL('image/png')`

### Enhancement: Keyframe-Aligned Capture

Instead of capturing random frames, capture frames that **correspond** to reference keyframes:

```javascript
async function captureAlignedFrames(game, referenceKeyframes) {
  const captures = [];
  const autoPlayer = new AIPlayer(game);
  
  for (const ref of referenceKeyframes) {
    // Play until game state matches the keyframe's expected state
    await autoPlayer.playUntil(ref.triggerCondition, { maxMs: 5000 });
    
    const frame = captureScreenshot();
    
    // Pre-compute the same compact representations
    captures.push({
      refId: ref.id,
      imageBase64: frame,
      sceneGraph: await extractSceneGraph(game),     // From ECS state directly!
      clipEmbedding: await clip.embed(frame),
      pHash: await phash(frame),
      colorMoments: extractColorMoments(frame),
      ecsState: snapshotECSState(game.world),        // Full entity dump
    });
  }
  
  return captures;
}
```

**Key advantage**: Since we control the ECS engine, we can extract the scene graph **directly from ECS state** — no vision model needed for the actual game output. This is essentially free.

```javascript
function snapshotECSState(world) {
  const entities = {};
  for (const eid of world.query('Position')) {
    entities[eid] = {
      Position: world.getComponent(eid, 'Position'),
      Sprite: world.getComponent(eid, 'Sprite'),
      // ... all components
    };
  }
  return {
    entities,
    resources: {
      state: world.getResource('state'),
      board: world.getResource('board'),
    },
  };
}
```

---

## Phase 3: Delta Computation (Tiered Comparison)

Based on research (VideoGameQA-Bench, arXiv:2505.15952), VLMs alone achieve only ~45% accuracy on visual regression. The solution is a **tiered pipeline** that escalates from cheap/fast to expensive/accurate:

```
Tier 0: Scene Graph Diff     (structural — free)
  |
  v  (if structural changes found)
Tier 1: pHash Hamming         (<1ms — 8 bytes vs 8 bytes)
  |
  v  (if hash distance > threshold)
Tier 2: SSIM Score            (~10ms — pixel structure)
  |
  v  (if SSIM < 0.85)
Tier 3: CLIP Cosine Sim       (~50ms — semantic)
  |
  v  (if cosine sim < 0.90)
Tier 4: VLM Deep Analysis     (~$0.01 — full vision)
```

### Implementation

```javascript
async function computeDelta(reference, actual) {
  const delta = {
    refId: reference.id,
    scene: reference.scene,
    tiers: {},
    needsDeepAnalysis: false,
  };
  
  // Tier 0: Scene graph structural diff
  delta.tiers.sceneGraph = diffSceneGraphs(reference.sceneGraph, actual.sceneGraph);
  // Returns: { added: [], removed: [], moved: [], changed: [] }
  
  if (delta.tiers.sceneGraph.totalChanges === 0) {
    delta.verdict = 'MATCH';
    return delta;
  }
  
  // Tier 1: Perceptual hash
  delta.tiers.pHash = hammingDistance(reference.pHash, actual.pHash);
  if (delta.tiers.pHash <= 5) { // Within tolerance
    delta.verdict = 'MINOR_DIFF';
    return delta;
  }
  
  // Tier 2: SSIM
  delta.tiers.ssim = computeSSIM(reference.imageBase64, actual.imageBase64);
  if (delta.tiers.ssim >= 0.85) {
    delta.verdict = 'ACCEPTABLE';
    return delta;
  }
  
  // Tier 3: CLIP semantic similarity
  delta.tiers.clipSim = cosineSimilarity(reference.clipEmbedding, actual.clipEmbedding);
  
  // Tier 4: Flag for VLM deep analysis
  delta.needsDeepAnalysis = true;
  delta.verdict = 'NEEDS_REVIEW';
  return delta;
}
```

---

## Phase 4: Three Specialized Validators

Only invoked for keyframes that reach Tier 4 (need deep analysis). Each validator has a narrow focus and returns structured JSON — not prose.

### Validator 1: Aesthetics

```javascript
const AESTHETICS_PROMPT = `You are a game aesthetics validator.
Compare the REFERENCE image against the ACTUAL game screenshot.
Focus ONLY on visual quality:
- Color palette consistency (background, accents, text)
- Visual clarity (is the game board/play area clearly defined?)
- HUD readability (score, level, status text)
- Element proportions (cells too large/small, text size)

Return JSON:
{
  "issues": [
    { "element": "background", "expected": "dark navy #111122", "actual": "black #000000", "severity": "low" },
    { "element": "score_text", "expected": "top-right, white", "actual": "missing", "severity": "high" }
  ],
  "palette_match": 0.85,  // 0-1
  "overall": "pass" | "fail"
}`;
```

### Validator 2: Camera/Layout

```javascript
const LAYOUT_PROMPT = `You are a game layout validator.
Compare spatial arrangement between REFERENCE and ACTUAL.
Focus ONLY on positioning and layout:
- Game board position and size relative to canvas
- HUD element positions (score top-right, level top-left, etc.)
- Margins and padding around game area
- Canvas utilization (too much dead space? elements cropped?)

Return JSON:
{
  "issues": [
    { "element": "game_board", "expected": "centered, 60% canvas width", "actual": "left-aligned, 40% width", "severity": "high" },
    { "element": "hud_score", "expected": "above board", "actual": "overlapping board", "severity": "medium" }
  ],
  "layout_score": 0.70,
  "overall": "pass" | "fail"
}`;
```

### Validator 3: Gameplay Logic

```javascript
const GAMEPLAY_PROMPT = `You are a gameplay logic validator.
Given the ECS state snapshot and the screenshot, verify game mechanics:
- Are all expected entities present? (pieces, board cells, items)
- Is the game state consistent? (score matches visible score, piece position matches grid)
- Are game rules being followed? (collision detection, scoring, turn order)
- Are required UI elements responding? (game over overlay, restart, controls)

ECS State: {ecsState}
Expected elements for this scene: {expectedElements}

Return JSON:
{
  "issues": [
    { "mechanic": "collision", "expected": "piece stops at filled row", "actual": "piece passes through", "severity": "critical" },
    { "mechanic": "scoring", "expected": "score increments on line clear", "actual": "score stays at 0", "severity": "high" }
  ],
  "entities_present": ["board", "active_piece", "score_display"],
  "entities_missing": ["ghost_piece", "next_piece_preview"],
  "overall": "pass" | "fail"
}`;
```

### Validator Dispatch

```javascript
async function runValidators(delta, reference, actual) {
  // Run all 3 in parallel — they're independent
  const [aesthetics, layout, gameplay] = await Promise.all([
    claude.analyze([reference.imageBase64, actual.imageBase64], {
      system: AESTHETICS_PROMPT,
    }),
    claude.analyze([reference.imageBase64, actual.imageBase64], {
      system: LAYOUT_PROMPT,
    }),
    claude.analyze([reference.imageBase64, actual.imageBase64], {
      system: GAMEPLAY_PROMPT,
      extraContext: { ecsState: actual.ecsState, expectedElements: reference.expectedElements },
    }),
  ]);
  
  return { aesthetics, layout, gameplay };
}
```

---

## Phase 5: ECS Diff Generation

Transform validator issues into **structured ECS patches** — not full code rewrites.

### Diff Format

```json
{
  "patches": [
    {
      "type": "component_update",
      "target": "HUD system",
      "description": "Score text not rendering",
      "diff": {
        "system": "render",
        "action": "add_call",
        "code": "drawHUD(ctx, state, offsetX, canvasWidth, offsetY, { fields: ['score', 'level'] })"
      },
      "severity": "high",
      "validator": "aesthetics"
    },
    {
      "type": "resource_update", 
      "target": "display config",
      "description": "Game board too small",
      "diff": {
        "resource": "display",
        "field": "cellSize",
        "from": 20,
        "to": 30
      },
      "severity": "medium",
      "validator": "layout"
    },
    {
      "type": "system_fix",
      "target": "collision system",
      "description": "Ghost piece not calculated",
      "diff": {
        "system": "gravity",
        "action": "add_after_line",
        "anchor": "// apply gravity",
        "code": "const ghostPos = ghostY(shape, px, py, board);\nworld.getComponent(eid, 'Ghost').y = ghostPos;"
      },
      "severity": "critical",
      "validator": "gameplay"
    }
  ],
  "summary": {
    "total_issues": 3,
    "critical": 1,
    "high": 1,
    "medium": 1,
    "low": 0,
    "estimated_score_impact": "+15"
  }
}
```

### Diff Generator Prompt

```javascript
const DIFF_GENERATOR_PROMPT = `You are an ECS game code patcher.
Given validator issues and the current game.js source, generate MINIMAL targeted patches.

Rules:
1. Each patch modifies ONE thing (a single component, resource, or system call)
2. Use the existing @engine API — never introduce new abstractions
3. Patches must reference exact line anchors in the source
4. Prefer modifying existing code over adding new code
5. Never rewrite entire systems — surgical fixes only

Current source:
{source}

Validator issues:
{validatorIssues}

Return the patches JSON array.`;
```

---

## Phase 6: Patch Application & Loop

```javascript
async function visionDiffLoop(gameSource, gameDescription, gameType, maxIterations = 3) {
  // Step 1: Generate references ONCE (cached across iterations)
  const references = await generateReferenceKeyframes(gameDescription, gameType);
  
  let currentSource = gameSource;
  
  for (let i = 0; i < maxIterations; i++) {
    console.log(`\n── Iteration ${i + 1}/${maxIterations} ──`);
    
    // Step 2: Compile & run the game
    const compiled = await compile(currentSource);
    const game = await launchHeadless(compiled);
    
    // Step 3: Capture aligned frames
    const captures = await captureAlignedFrames(game, references);
    
    // Step 4: Compute deltas (tiered — most will short-circuit at Tier 0-2)
    const deltas = await Promise.all(
      references.map((ref, idx) => computeDelta(ref, captures[idx]))
    );
    
    // Step 5: Run validators ONLY on frames that need deep analysis
    const needsReview = deltas.filter(d => d.needsDeepAnalysis);
    if (needsReview.length === 0) {
      console.log('All keyframes match references. Done!');
      return { source: currentSource, iterations: i + 1, score: 100 };
    }
    
    const validations = await Promise.all(
      needsReview.map(d => {
        const ref = references.find(r => r.id === d.refId);
        const actual = captures.find(c => c.refId === d.refId);
        return runValidators(d, ref, actual);
      })
    );
    
    // Step 6: Generate ECS diffs
    const allIssues = validations.flatMap(v => [
      ...v.aesthetics.issues,
      ...v.layout.issues,
      ...v.gameplay.issues,
    ]);
    
    const patches = await generateECSDiffs(currentSource, allIssues);
    
    // Step 7: Apply patches
    currentSource = applyPatches(currentSource, patches);
    console.log(`Applied ${patches.length} patches`);
  }
  
  return { source: currentSource, iterations: maxIterations };
}
```

---

## Integration with Existing Codebase

### Where This Lives

| Component | Location | Status |
|-----------|----------|--------|
| Reference generator | `lib/vision-diff/references.js` | **New** |
| Tiered comparator | `lib/vision-diff/compare.js` | **New** |
| 3 Validators | `lib/vision-diff/validators.js` | **New** |
| ECS diff generator | `lib/vision-diff/diff.js` | **New** |
| Patch applier | `lib/vision-diff/patch.js` | **New** |
| CLI command | `lib/eval.js` (extend with `--vision-diff` flag) | **Modify** |
| Server endpoint | `server.js` `/api/projects/:id/vision-eval` | **New** |
| Frontend loop | `index.html` `runVisionEval()` | **New** |
| AutoPlayer enhancements | `index.html` `AIPlayer.playUntil()` | **Modify** |
| ECS state snapshot | `index.html` `snapshotECSState()` | **New** |

### What Already Exists (Reuse)

- `captureScreenshot()` — canvas → base64 PNG
- `captureVideo()` — MediaRecorder 30fps WebM
- `AIPlayer` — random + smart gameplay
- `TelemetryCollector` — 500ms state snapshots
- `runEval()` — compile → play → capture → eval → fix loop (the skeleton of what we need)
- `/api/eval` and `/api/projects/:id/eval` — existing eval endpoints with vision support

---

## Efficient Image Representation: Research Summary

### Key Findings

1. **VLMs alone are not enough for regression testing.** VideoGameQA-Bench (NeurIPS 2025, arXiv:2505.15952) shows best VLM achieves only 45.2% accuracy on visual regression. Use deterministic metrics first.

2. **FFmpeg I-frame extraction** preserves 98.79% of bugs from <0.5% of frames (arXiv:2603.22706). Use this for video-based capture.

3. **Scene graph serialization is the cheapest comparison** for engine-controlled games. Since we own the ECS runtime, we can serialize `world.toJSON()` directly — no image processing needed for structural comparison.

4. **Tiered pipeline** (scene graph → pHash → SSIM → CLIP → VLM) minimizes cost. Most frames will short-circuit at Tier 0-1, saving ~99% of VLM calls.

5. **CLIP embeddings** (512 floats, 2KB) are the best compact semantic representation. Cosine similarity between reference and actual CLIP vectors detects "semantic drift" without full VLM parsing.

6. **Structured text descriptions (VDLM-style)** are an emerging approach: have a VLM describe the scene as structured JSON once, then diff the JSON across iterations instead of re-analyzing images.

### References

| Paper/Tool | Relevance |
|------------|-----------|
| [VideoGameQA-Bench](https://arxiv.org/abs/2505.15952) (NeurIPS 2025) | VLM accuracy benchmarks for game testing |
| [VLMs for Game Bug Detection](https://arxiv.org/abs/2603.22706) (Mar 2026) | Keyframe extraction + VLM classification pipeline |
| [GAMEBoT](https://arxiv.org/abs/2412.13602) (ACL 2025) | LLM game reasoning evaluation framework |
| [VDLM](https://mikewangwzhl.github.io/VDLM/) | Visual scene → structured text descriptions |
| [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) | Scene change detection for keyframe extraction |
| [imagehash (Python)](https://github.com/JohannesBuchner/imagehash) | Perceptual hashing library |
| [OpenAI CLIP](https://github.com/openai/CLIP) | Image/text embeddings for semantic comparison |
| [Konva.js serialization](https://konvajs.org/docs/data_and_serialization/Serialize_a_Stage.html) | Scene graph JSON export pattern |
| [Scene-LLM](https://arxiv.org/abs/2403.11401) | Scene graph extraction via VLMs |

---

## Cost Estimate Per Eval Iteration

| Step | Cost | Calls |
|------|------|-------|
| Reference generation (one-time) | ~$0.05 | 6 Gemini image generations |
| Reference scene descriptions (one-time) | ~$0.06 | 6 Claude vision calls |
| Tiered comparison (Tiers 0-3) | ~$0 | Local compute only |
| Validator calls (Tier 4 only) | ~$0.03/keyframe | 0-6 depending on match quality |
| ECS diff generation | ~$0.02 | 1 Claude call with issues + source |
| **Total per iteration** | **~$0.05-$0.15** | vs ~$0.10 for current single-shot eval |
| **Total per game (3 iterations)** | **~$0.20-$0.50** | With reference gen amortized |

The tiered approach means well-made games cost almost nothing to validate (short-circuit at Tier 0-1), while buggy games get progressively deeper analysis only where needed.
