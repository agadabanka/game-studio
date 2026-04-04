#!/usr/bin/env python3
"""
Chapter 9: Vision Hill Climb -- Visual Validation Loop

Documents the vision-diff architecture, the Game Factory Vision Hill Climb UI,
tiered comparison pipeline, three specialized validators, ECS diff generation,
and relevant research references.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import (
    BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE,
    ACCENT_PURPLE, ACCENT_RED, TEXT_PRIMARY, TEXT_SECONDARY,
)

pdf = BookPDF("Ch.9 Vision Hill Climb")
pdf.chapter_cover(9, "Vision Hill Climb", "AI-Powered Visual Validation for Games")

# ── 9.1 Motivation ──────────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Why Vision-Based Validation?")
pdf.body_text(
    "The existing eval system (Chapter 3) sends game source to Claude for quality scoring. "
    "It returns a 0-100 score with text feedback and sometimes a full rewrite. But this "
    "approach has critical limitations:"
)
pdf.bullet_list([
    "No visual ground truth: the evaluator has no reference for what the game SHOULD look like",
    "Coarse feedback: 'the game looks wrong' doesn't tell you WHAT is wrong",
    "Full rewrites are risky: a single mistake in rewritten code can break working features",
    "No regression detection: improving one thing often breaks another",
])
pdf.body_text(
    "Vision Hill Climb solves these by introducing AI-generated reference images, tiered "
    "visual comparison, three specialized validators, and targeted ECS patches instead of "
    "full rewrites. The system works identically from both the CLI (game-studio vision-diff) "
    "and the web UI (Game Factory /vision-hill-climb.html)."
)

pdf.info_box(
    "Key Insight",
    "Parse each reference image exactly ONCE, then store compact representations "
    "(scene graph JSON, perceptual hash, color moments) that validators can compare "
    "without re-invoking a VLM. This makes iteration nearly free for well-made games.",
    ACCENT_BLUE,
)

# ── 9.2 Architecture ────────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Architecture Overview")

pdf.diagram_box("Vision Hill Climb Pipeline", """
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
""")

pdf.body_text(
    "The pipeline has six steps, executed in a loop up to N iterations (default 3). "
    "Each iteration is cheaper than the last because the tiered comparison "
    "short-circuits at lower tiers as the game improves."
)

pdf.table(
    ["Step", "Component", "Cost", "What It Does"],
    [
        ["1", "Reference Gen", "~$0.05 (one-time)", "Gemini generates keyframe mockups"],
        ["2", "Compile + Play", "~$0 (local)", "esbuild + AutoPlayer captures frames"],
        ["3", "Tiered Compare", "~$0 (local)", "pHash/SSIM/scene-graph gate"],
        ["4", "3 Validators", "~$0.03/keyframe", "Claude evaluates flagged frames"],
        ["5", "ECS Diffs", "~$0.02", "Claude generates targeted patches"],
        ["6", "Apply + Loop", "~$0", "Patches applied, source updated"],
    ],
    [15, 35, 40, 100],
)

# ── 9.3 Reference Keyframes ─────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Step 1: Reference Keyframe Generation")
pdf.body_text(
    "Each game type has a curated set of 4-6 keyframe prompts representing critical "
    "gameplay moments. These are sent to Gemini (Nano Banana) to generate 'what the game "
    "should look like' as reference images."
)

pdf.section_title("Keyframe Sets by Game Type", level=2)
pdf.table(
    ["Game Type", "Count", "Keyframes"],
    [
        ["Arcade", "6", "title, early play, mid-game, action, game over, HUD"],
        ["Board", "4", "initial board, mid-game, selection, end game"],
        ["Puzzle", "5", "empty, partial, near-win, win, loss"],
    ],
    [30, 15, 145],
)

pdf.section_title("Compact Representations", level=2)
pdf.body_text(
    "Each reference image is analyzed exactly once to extract multiple compact "
    "representations. Validators and comparators use these instead of re-parsing "
    "the full image on every iteration."
)

pdf.table(
    ["Representation", "Size", "Speed", "Best For"],
    [
        ["Scene Graph JSON", "~2 KB", "Instant", "Structural comparison (elements)"],
        ["Perceptual Hash", "8 bytes", "<1ms", "Quick change detection gate"],
        ["Color Moments", "36 bytes", "<1ms", "Palette drift detection"],
        ["Full Base64 Image", "~100 KB", "~$0.01", "VLM deep analysis (last resort)"],
    ],
    [40, 25, 25, 100],
)

pdf.info_box(
    "VDLM-Style Descriptions",
    "An emerging technique (Visual Description Language Model) converts screenshots "
    "to structured JSON text. By diffing text descriptions instead of re-analyzing "
    "images, we can perform semantic comparison without any VLM calls.",
    ACCENT_GREEN,
)

# ── 9.4 Tiered Comparison ───────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Step 3: Tiered Visual Comparison")
pdf.body_text(
    "Based on research (VideoGameQA-Bench, NeurIPS 2025), VLMs alone achieve only "
    "~45% accuracy on visual regression testing. The solution is a tiered pipeline "
    "that escalates from cheap/fast to expensive/accurate. Most frames short-circuit "
    "at Tier 0-1, saving ~99% of VLM API calls."
)

pdf.diagram_box("Tiered Comparison Pipeline", """
  Tier 0: Scene Graph Diff     (structural - free)
    |
    v  (if structural changes found)
  Tier 1: pHash Hamming         (<1ms - 8 bytes vs 8 bytes)
    |
    v  (if hash distance > threshold)
  Tier 2: Color Moment Distance (<1ms - 36 bytes vs 36 bytes)
    |
    v  (if palette drift detected)
  Tier 3: VLM Deep Analysis     (~$0.01/frame - full Claude vision)
""")

pdf.section_title("Perceptual Hashing (pHash)", level=2)
pdf.body_text(
    "A 64-bit fingerprint generated by resizing the image to 8x8 grayscale and "
    "comparing each pixel against the mean. Two images' similarity is measured by "
    "Hamming distance: 0 = identical, <=8 = very similar, >8 = different. Robust to "
    "scaling, compression, and minor color changes. Cost: near-zero computation, "
    "8 bytes storage per frame."
)

pdf.section_title("SSIM (Structural Similarity Index)", level=2)
pdf.body_text(
    "Compares luminance, contrast, and structure between two images, producing a "
    "score from -1 to 1 (1 = identical). Models human visual perception better than "
    "MSE/PSNR. SSIM > 0.85 means the images are visually similar; < 0.85 triggers "
    "deeper analysis. Available in scikit-image and OpenCV."
)

pdf.section_title("CLIP Embeddings", level=2)
pdf.body_text(
    "OpenAI's CLIP encodes images and text into a shared 512-dimensional embedding "
    "space. Two screenshots can be compared via cosine similarity of their embeddings. "
    "The killer feature: you can compare a text description ('a platformer with a blue "
    "sky') against a screenshot without any VLM call. Storage: 512 floats (~2KB) per image."
)

# ── 9.5 Three Validators ────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Step 4: Three Specialized Validators")
pdf.body_text(
    "Only invoked for keyframes that reach Tier 3 (need deep analysis). Each validator "
    "has a narrow focus and returns structured JSON -- not prose. They run in parallel."
)

pdf.section_title("Validator 1: Aesthetics", level=2)
pdf.bullet_list([
    "Color palette consistency (background, accents, text)",
    "Visual clarity (game board clearly defined?)",
    "HUD readability (score, level visible and legible?)",
    "Element proportions (cells right size, text readable)",
    'Returns: { "issues": [...], "palette_match": 0.85, "overall": "pass|fail" }',
])

pdf.section_title("Validator 2: Layout", level=2)
pdf.bullet_list([
    "Game board position and size relative to canvas",
    "HUD element positions (score top-right, level top-left)",
    "Canvas utilization (dead space? cropping?)",
    "Alignment of elements (centered, properly spaced)",
    'Returns: { "issues": [...], "layout_score": 0.70, "overall": "pass|fail" }',
])

pdf.section_title("Validator 3: Gameplay Logic", level=2)
pdf.bullet_list([
    "Entity presence (pieces, board cells, items all visible?)",
    "State consistency (score matches display, positions match grid)",
    "Game rules (collision, scoring, turn order correct?)",
    "UI elements (game over overlay, restart prompt, controls)",
    'Returns: { "issues": [...], "entities_missing": [...], "overall": "pass|fail" }',
])

pdf.info_box(
    "Why Three Instead of One?",
    "A single 'evaluate everything' prompt produces vague feedback. By splitting into "
    "aesthetics/layout/gameplay, each validator has a narrow focus that produces "
    "actionable, structured issues. The ECS diff generator can then map each issue "
    "to a specific component, resource, or system in the game code.",
    ACCENT_PURPLE,
)

# ── 9.6 ECS Diff Format ─────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Step 5: ECS Diff Generation")
pdf.body_text(
    "Validator issues are transformed into structured ECS patches -- not full code "
    "rewrites. Each patch modifies ONE thing: a single component default, resource "
    "value, system call, or display config. This is the key innovation over the "
    "existing eval system's 'rewrite everything' approach."
)

pdf.code_block("""{
  "patches": [
    {
      "type": "display_config",
      "target": "display",
      "description": "Game board too small",
      "diff": {
        "action": "modify",
        "anchor": "cellSize: 20",
        "code": "cellSize: 30"
      },
      "severity": "medium",
      "validator": "layout"
    },
    {
      "type": "system_fix",
      "target": "render system",
      "description": "Score text not rendering",
      "diff": {
        "action": "add_after_line",
        "anchor": "clearCanvas(ctx, '#111');",
        "code": "drawHUD(ctx, state, offsetX, W, offsetY, ...);"
      },
      "severity": "high",
      "validator": "aesthetics"
    }
  ]
}""", "ECS Patch Format")

pdf.body_text(
    "Patches reference exact text anchors in the source code. The patch applier uses "
    "string matching (with fuzzy fallback) to locate the anchor and apply the change. "
    "This approach means patches are precise and safe -- a failing patch is simply skipped "
    "rather than corrupting the source."
)

# ── 9.7 Game Factory Integration ────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Game Factory Integration")
pdf.body_text(
    "The Vision Hill Climb page (/vision-hill-climb.html) provides a visual dashboard "
    "for running and inspecting the validation loop. It follows the same patterns as "
    "the Sprite Eval page, with a dark theme, pipeline visualization, and interactive "
    "iteration timeline."
)

pdf.section_title("UI Components", level=2)
pdf.table(
    ["Component", "Purpose"],
    [
        ["Pipeline strip", "6-step visualization with active/done states"],
        ["Showcase grid", "5 preset games (Tetris, Chess, Snake, Minesweeper, 2048)"],
        ["Keyframe strip", "Scrollable reference keyframe cards with images"],
        ["Score chart", "Canvas line chart of score progression across iterations"],
        ["Iteration timeline", "Cards showing patches applied and issues found per iteration"],
        ["Validator grid", "3-column view of aesthetics/layout/gameplay results"],
        ["Diff view", "Side-by-side reference vs actual comparison"],
        ["History table", "All previous runs with View button"],
    ],
    [40, 150],
)

pdf.section_title("Shared Pipeline", level=2)
pdf.body_text(
    "Game Factory calls into the same vision-diff pipeline that game-studio CLI uses. "
    "The server-side runner (src/vision-hill-climb/index.js) implements the identical loop: "
    "reference generation, compilation via bundleGame(), validator calls via Claude, and "
    "patch generation. Game sources are fetched from the projects table or from GitHub."
)

pdf.section_title("API Endpoints", level=2)
pdf.table(
    ["Method", "Endpoint", "Purpose"],
    [
        ["GET", "/api/vision-hill-climb", "List all runs + showcase games"],
        ["GET", "/api/vision-hill-climb/games", "Get showcase game list"],
        ["GET", "/api/vision-hill-climb/:runId", "Get iterations + keyframes for a run"],
        ["POST", "/api/vision-hill-climb/run", "Start a new vision hill climb run"],
    ],
    [20, 75, 95],
)

pdf.section_title("Storage Schema", level=2)
pdf.body_text(
    "Two new SQLite tables extend the existing database:"
)
pdf.bullet_list([
    "vision_hill_climb_runs: One row per iteration, stores score, delta summary, "
    "validator JSON, patches JSON, duration, and source hash",
    "vision_reference_keyframes: Reference images with scene descriptions, expected "
    "elements, perceptual hashes, and color moments",
])

# ── 9.8 Showcase: Tetris ────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Showcase: Tetris Validation")
pdf.body_text(
    "Tetris serves as the primary showcase game because it exercises all three validators: "
    "aesthetics (color palette, piece rendering), layout (game board positioning, HUD "
    "placement, next-piece preview), and gameplay logic (collision detection, line clears, "
    "scoring, ghost piece, rotation)."
)

pdf.section_title("Tetris Keyframes", level=2)
pdf.table(
    ["ID", "Scene", "Expected Elements", "What It Tests"],
    [
        ["early_play", "Game just started", "board, active piece, score, HUD", "Initial rendering"],
        ["mid_game", "Board half-filled", "stacked pieces, level display", "State accumulation"],
        ["action", "Line clear moment", "clear animation, score update", "Scoring + animation"],
        ["game_over", "Final state", "game over text, final score", "End-state UI"],
    ],
    [25, 35, 60, 70],
)

pdf.section_title("Typical Iteration Progression", level=2)
pdf.body_text(
    "A typical Tetris validation run progresses as follows:"
)
pdf.bullet_list([
    "Iteration 1: Score 60 - Missing HUD elements, ghost piece not rendered, "
    "score text overlapping board. 4 patches applied (2 layout, 2 aesthetics).",
    "Iteration 2: Score 80 - HUD fixed, ghost piece added. Line clear animation "
    "missing. 2 patches applied (1 gameplay, 1 aesthetics).",
    "Iteration 3: Score 92 - All visual elements present. Minor color palette drift "
    "in level display. 1 patch applied. Passes all three validators.",
])

# ── 9.9 Research References ──────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("Research References")
pdf.body_text(
    "The Vision Hill Climb architecture is informed by recent research in visual game "
    "testing, perceptual image comparison, and VLM-based evaluation:"
)

pdf.section_title("Visual Game Testing", level=2)
pdf.table(
    ["Paper", "Key Finding"],
    [
        ["VideoGameQA-Bench (NeurIPS 2025)", "Best VLM: 45.2% on visual regression. Glitch detection: 82.8%"],
        ["VLMs for Canvas Bugs (ASE 2022)", "Scene graph decomposition achieves 100% bug detection"],
        ["41 Hours of Gameplay (Mar 2026)", "FFmpeg I-frames preserve 98.79% bugs from 0.46% frames"],
        ["GAMEBoT (ACL 2025)", "Modular decomposition of game reasoning into subproblems"],
    ],
    [70, 120],
)

pdf.section_title("Image Comparison Techniques", level=2)
pdf.table(
    ["Technique", "Size", "Use Case"],
    [
        ["pHash (perceptual hash)", "8 bytes", "Fast binary change detection"],
        ["SSIM (structural similarity)", "1 float", "Perceptual quality comparison"],
        ["CLIP embeddings", "~2 KB (512 floats)", "Semantic similarity + text-image matching"],
        ["DINOv2 (Meta)", "~3 KB (768 floats)", "Fine-grained structural comparison"],
        ["Color moments", "36 bytes", "Palette drift detection"],
        ["Scene graph JSON", "~2 KB", "Structural comparison (cheapest)"],
    ],
    [50, 40, 100],
)

pdf.section_title("Key Tools & Libraries", level=2)
pdf.bullet_list([
    "imagehash (Python): pHash, dHash, wHash implementations - github.com/JohannesBuchner/imagehash",
    "PySceneDetect: Scene change detection for keyframe extraction - github.com/Breakthrough/PySceneDetect",
    "OpenAI CLIP: Image/text embeddings for semantic comparison - github.com/openai/CLIP",
    "scikit-image structural_similarity: SSIM implementation",
    "VDLM: Visual scene to structured text descriptions - mikewangwzhl.github.io/VDLM/",
])

pdf.section_title("Key Takeaways", level=2)
pdf.body_text(
    "1. Do not rely on VLMs alone for regression testing (only 45% accuracy). "
    "Use deterministic metrics (pHash, SSIM, scene graph diff) as the primary gate. "
    "2. VLMs are good at glitch detection (~83%) -- use them as final-pass reviewers. "
    "3. Scene graph serialization is the cheapest comparison for engine-controlled games. "
    "4. CLIP embeddings are the best compact semantic representation without resending images. "
    "5. The tiered pipeline (Tier 0-3) minimizes cost while maintaining thoroughness."
)

# ── 9.10 File Structure ─────────────────────────────────────────────────────
pdf.add_page()
pdf.section_title("File Structure")

pdf.section_title("game-studio (CLI)", level=2)
pdf.code_block("""lib/vision-diff/
  references.js    # Reference keyframe generation via Gemini
  compare.js       # Tiered delta computation engine
  validators.js    # 3 specialized visual validators
  diff.js          # ECS patch generator and applier
  index.js         # Main loop orchestrator + CLI entry point

bin/game-studio.js # CLI command: vision-diff
lib/eval.js        # --vision-diff flag delegates here""", "game-studio file structure")

pdf.section_title("game-factory (Server)", level=2)
pdf.code_block("""src/vision-hill-climb/
  index.js               # Server-side runner (shared pipeline)

src/db/
  vision-hill-climb.js   # CRUD: saveVisionIteration, listVisionRuns, etc.
  schema.sql             # vision_hill_climb_runs + vision_reference_keyframes

public/
  vision-hill-climb.html # UI dashboard with pipeline visualization

server.js                # /api/vision-hill-climb/* endpoints""", "game-factory file structure")

pdf.section_title("Usage", level=2)
pdf.code_block("""# CLI (game-studio)
game-studio vision-diff                          # Run for current game
game-studio vision-diff --type board             # Board game mode
game-studio vision-diff --iterations 5           # More fix iterations
game-studio eval --vision-diff                   # Via eval command

# Web UI (Game Factory)
# Navigate to /vision-hill-climb.html
# Select a showcase game, click Run, watch the pipeline""", "Usage examples")

# ── Output ──
out_path = os.path.join(os.path.dirname(__file__), "ch09.pdf")
pdf.output(out_path)
print(f"ch09.pdf generated ({pdf.page_no()} pages)")
