#!/usr/bin/env python3
"""Chapter 9: Learnings & Evolution + Chapter 10: Future Directions"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, ACCENT_PURPLE, ACCENT_RED

pdf = BookPDF("Learnings & Evolution")

# ── CHAPTER 9: LEARNINGS ──────────────────────────
pdf.chapter_cover(9, "Learnings & Evolution", "Gaps Found, Fixes Applied, Roadmap")

pdf.add_page()
pdf.section_title("How We Learn: Battle-Testing the SDK")
pdf.body_text(
    "The @engine SDK evolves through real-world use. Each new game type reveals where the "
    "abstractions break down. This chapter documents the 10 concrete gaps discovered while "
    "building Chess, Tetris, Snake, and Ludo - the first 4 battle-tested games."
)

pdf.info_box("Process",
    "Build game -> Hit SDK limitation -> Implement workaround -> Document gap -> "
    "Propose fix -> Update SDK -> All future games benefit.")

# ── Gap 1 ──
pdf.section_title("Gap 1: Canvas Sizing Assumes Grid Layout", level=1)
pdf.body_text("Exposed by: Ludo (first non-grid game)")
pdf.body_text(
    "Problem: core.js hardcoded canvas size as width * cellSize + 180 (grid width + HUD). "
    "Ludo's board is a 15x15 cross shape that needs custom pixel dimensions."
)
pdf.body_text(
    "Fix: Added 'custom' display type with canvasWidth, canvasHeight, offsetX, offsetY. "
    "Falls back to grid calculation when custom values are absent."
)
pdf.code_block("""// Before (grid-only):
canvas.width = config.width * config.cellSize + 180;

// After (supports custom):
if (config.display.type === 'custom') {
  canvas.width = config.display.canvasWidth;
  canvas.height = config.display.canvasHeight;
} else {
  canvas.width = config.display.width * config.display.cellSize + 180;
}""")
pdf.body_text("Status: FIXED in core.js")

# ── Gap 2 ──
pdf.section_title("Gap 2: No AI/Decision-Making Module", level=1)
pdf.body_text("Exposed by: Ludo (first game with AI opponents)")
pdf.body_text(
    "Problem: The SDK had no helpers for AI. Chess, Tetris, and Snake are all human-controlled. "
    "Ludo requires 4 AI players making strategic decisions each turn."
)
pdf.body_text(
    "Fix: Created @engine/ai.js with pickBestMove, pickWeightedMove, pickRandomMove, "
    "and compositeEvaluator. Game-agnostic: operates on abstract moves and evaluator functions."
)
pdf.body_text("Status: FIXED - ai.js added to SDK")

# ── Gap 3 ──
pdf.section_title("Gap 3: Board Module Too Chess-Specific", level=1)
pdf.body_text("Exposed by: Ludo")
pdf.body_text(
    "Problem: @engine/board.js has buildBoardMap, isLegalMove, isPathClear - all designed "
    "for chess-style grid movement. None works for Ludo's track-based movement."
)
pdf.body_text(
    "Workaround: Ludo implements its own trackToPixel(), getValidMoves(), checkCapture(). "
    "Does not use board.js at all."
)
pdf.body_text("Status: PROPOSED - Split into board-grid.js and board-track.js, or create @engine/path.js")

# ── Gap 4 ──
pdf.section_title("Gap 4: Grid Module Doesn't Cover Tracks", level=1)
pdf.body_text("Exposed by: Ludo")
pdf.body_text(
    "Problem: @engine/grid.js only handles rectangular grids. No support for circular tracks, "
    "branching paths, or dice-based movement."
)
pdf.body_text("Status: PROPOSED - Add @engine/path.js for track/path data structures")

# ── Gap 5 ──
pdf.section_title("Gap 5: Render Module Lacked Pixel Primitives", level=1)
pdf.body_text("Exposed by: Ludo")
pdf.body_text(
    "Problem: All render helpers assumed grid-cell positioning. No circles, dice, or "
    "arbitrary-position drawing."
)
pdf.body_text(
    "Fix: Added drawToken (circles), drawDice (dice faces), drawSquare (rectangles) "
    "as pixel-coordinate primitives alongside the existing grid-coordinate helpers."
)
pdf.body_text("Status: FIXED in render.js")

# ── Gap 6 ──
pdf.section_title("Gap 6: No Turn Management System", level=1)
pdf.body_text("Exposed by: Ludo (4 players), Chess (2 players)")
pdf.body_text(
    "Problem: Turn management is hand-coded in each game. Chess manually toggles between "
    "'white' and 'black'. Ludo implements nextPlayer() cycling through 4 players."
)
pdf.body_text("Status: PROPOSED - Add @engine/turns.js with createTurnManager()")

# ── Gap 7 ──
pdf.section_title("Gap 7: Restart Logic Is Incomplete", level=1)
pdf.body_text("Exposed by: All games")
pdf.body_text(
    "Problem: core.js restart handler only resets _board.grid and state. But Tetris needs "
    "to destroy entities, Snake needs to respawn, Ludo needs to reset 16 tokens."
)
pdf.body_text("Status: PROPOSED - Add game.onRestart(callback) for game-specific cleanup")

# ── Gap 8 ──
pdf.section_title("Gap 8: No Animation/Tween System", level=1)
pdf.body_text("Exposed by: Ludo (token movement should animate along track)")
pdf.body_text(
    "Problem: Movement is instant - tokens teleport. No position interpolation, tweens, "
    "easing functions, or animation queues."
)
pdf.body_text("Status: PROPOSED - Add @engine/animate.js")

# ── Gap 9 ──
pdf.section_title("Gap 9: Events Are Frame-Scoped Only", level=1)
pdf.body_text("Exposed by: Ludo (multi-frame coordination)")
pdf.body_text(
    "Problem: world.emit() events are cleared every frame. Fine for single-frame pipelines "
    "(Tetris lock->clear->score). But Ludo needs multi-frame sequences (roll->animate->capture)."
)
pdf.body_text("Status: PROPOSED - Add persistent events or state machine helper")

# ── Gap 10 ──
pdf.section_title("Gap 10: roundRect Browser Compatibility", level=1)
pdf.body_text("Exposed by: Ludo (dice drawing)")
pdf.body_text(
    "Problem: ctx.roundRect() used in drawDice is Chrome 99+, Firefox 112+, Safari 15.4+. "
    "Older browsers will crash."
)
pdf.body_text("Status: PROPOSED - Add polyfill with manual arc-based fallback")

# ── Summary table ──
pdf.add_page()
pdf.section_title("Gap Status Summary", level=1)
pdf.table(
    ["#", "Gap", "Exposed By", "Status"],
    [
        ["1", "Canvas sizing assumes grid", "Ludo", "FIXED"],
        ["2", "No AI module", "Ludo", "FIXED"],
        ["3", "Board module chess-specific", "Ludo", "PROPOSED"],
        ["4", "Grid doesn't cover tracks", "Ludo", "PROPOSED"],
        ["5", "Render lacks pixel primitives", "Ludo", "FIXED"],
        ["6", "No turn management", "Ludo, Chess", "PROPOSED"],
        ["7", "Restart logic incomplete", "All games", "PROPOSED"],
        ["8", "No animation system", "Ludo", "PROPOSED"],
        ["9", "Events frame-scoped only", "Ludo", "PROPOSED"],
        ["10", "roundRect compat", "Ludo", "PROPOSED"],
    ],
    col_widths=[10, 60, 55, 35]
)

# ── CHAPTER 10: FUTURE DIRECTIONS ──────────────────────────
pdf.chapter_cover(10, "Future Directions", "Proposed Modules & Enhancements")

pdf.add_page()
pdf.section_title("Proposed New Modules")
pdf.body_text(
    "Based on the gaps discovered, here are the proposed additions to the @engine SDK, "
    "ordered by priority."
)

pdf.section_title("Priority 1: @engine/turns.js", level=2)
pdf.body_text("High value, low effort. Every multi-player game needs turn management.")
pdf.code_block("""export function createTurnManager(players, opts) {
  return {
    current()     { ... },  // Get current player
    next()        { ... },  // Advance to next player
    skip()        { ... },  // Skip current player's turn
    extraTurn()   { ... },  // Grant extra turn (e.g., rolled 6)
    onTurnEnd(cb) { ... },  // Register turn-end callback
  };
}""", "@engine/turns.js")

pdf.section_title("Priority 2: @engine/path.js", level=2)
pdf.body_text("Unlocks track-based board games (Ludo, Monopoly, Sorry!, Snakes & Ladders).")
pdf.code_block("""export function defineTrack(positions, opts) { ... }
export function branchAt(track, position, branch) { ... }
export function advanceOnTrack(currentPos, steps, track) { ... }
export function findOccupants(pos, tokens) { ... }""", "@engine/path.js")

pdf.section_title("Priority 3: Render Module Split", level=2)
pdf.body_text("Code organization to prevent render.js from growing beyond 1000+ lines.")
pdf.bullet_list([
    "@engine/render-grid.js: Grid-specific (drawGridBoard, drawPieceCells)",
    "@engine/render-primitives.js: Pixel-level (drawToken, drawDice, drawCircle)",
    "@engine/render-hud.js: HUD and overlays (drawHUD, drawGameOver)",
])

pdf.section_title("Priority 4: @engine/animate.js", level=2)
pdf.body_text("Smooth movement, tweens, and animation queues for visual polish.")
pdf.code_block("""export function tween(entity, property, from, to, duration, easing) { ... }
export function animateAlongPath(entity, waypoints, speed) { ... }
export function waitForAnimation(entity) { ... }""", "@engine/animate.js")

pdf.section_title("Priority 5: AI Enhancements", level=2)
pdf.body_text("Currently supports greedy/weighted selection. Need deeper strategies.")
pdf.bullet_list([
    "Minimax with alpha-beta pruning for adversarial games (Chess AI, Connect 4)",
    "Monte Carlo Tree Search for complex state spaces",
    "AI difficulty levels: easy (more random) to hard (more optimal)",
])

pdf.section_title("Priority 6: Event System Upgrade", level=2)
pdf.body_text("Enable multi-frame coordination without manual state machines.")
pdf.code_block("""// Option A: Persistent events
world.emitPersistent('diceRolled', { value: 6 });
world.consumeEvent('diceRolled');  // Explicit clear

// Option B: Built-in state machine
const fsm = createStateMachine({
  states: ['idle', 'rolling', 'moving', 'capturing'],
  transitions: {
    idle: { roll: 'rolling' },
    rolling: { rolled: 'moving' },
    moving: { arrived: 'capturing' },
    capturing: { done: 'idle' },
  }
});""", "Event System Options")

pdf.section_title("SDK Evolution Timeline", level=1)
pdf.diagram_box("Past, Present, and Future", """
  PAST (v0.x)                    PRESENT (v1.0)              FUTURE (v2.0)
  +--------------------------+  +------------------------+  +---------------------+
  | core.js (grid-only)      |  | core.js (grid+custom)  |  | core.js (responsive)|
  | grid.js                  |  | grid.js                |  | grid.js             |
  | render.js (grid only)    |  | render.js (grid+pixel) |  | render-grid.js      |
  | board.js (chess only)    |  | board.js (chess only)  |  | render-primitives   |
  | input.js                 |  | input.js               |  | render-hud.js       |
  |                          |  | ai.js (NEW)            |  | board-grid.js       |
  |                          |  |                        |  | board-track.js      |
  |                          |  |                        |  | path.js (NEW)       |
  |                          |  |                        |  | turns.js (NEW)      |
  |                          |  |                        |  | animate.js (NEW)    |
  |                          |  |                        |  | ai.js (enhanced)    |
  +--------------------------+  +------------------------+  +---------------------+
  3 games supported              29 games published          50+ games target
  Grid games only                Grid + custom layouts        All game types
  Human players only             Human + basic AI             Advanced AI
""")

pdf.section_title("How to Contribute", level=1)
pdf.body_text(
    "The SDK improves through the feedback loop: build games, find gaps, propose fixes. "
    "Here's how the process works:"
)
pdf.bullet_list([
    "1. Build a game that pushes the SDK's boundaries (new genre, new mechanic)",
    "2. Run game-studio eval - if bugs are 'compiler limitations', file on game-factory",
    "3. Document the gap in LEARNINGS.md with problem, workaround, and recommendation",
    "4. Implement the fix in the appropriate @engine module",
    "5. Run game-studio pull-sdk on existing games to verify backward compatibility",
    "6. All 29+ games benefit from the improvement",
])

pdf.output(os.path.join(os.path.dirname(__file__), "ch08.pdf"))
print("ch08.pdf generated")
