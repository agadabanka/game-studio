#!/usr/bin/env python3
"""Chapter 6: The 34 Games"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, ACCENT_GREEN, ACCENT_ORANGE, ACCENT_PURPLE, ACCENT_RED

pdf = BookPDF("The 34 Games")

pdf.chapter_cover(6, "The 34 Games", "Catalog of Published Games Built with the Framework")

pdf.add_page()
pdf.section_title("Overview")
pdf.body_text(
    "The Game Factory ecosystem has produced 34 published games spanning multiple genres: "
    "puzzle, arcade, board, card, strategy, and casual games. Each game is a standalone GitHub "
    "repository with game.js source, compiled bundle, and playable index.html. Together they "
    "serve as both a validation suite for the @engine SDK and a showcase of what the system "
    "can produce. The latest batch of 5 games (Pac-Man, Frogger, Sokoban, Poker, Go) drove "
    "the creation of three new SDK modules: turns.js, cards.js, and animate.js."
)

pdf.section_title("Games by Category", level=1)

# ── BOARD GAMES ──
pdf.section_title("Board Games (8)", level=2)

games_board = [
    ("Chess", "chess", "Classic two-player chess with full piece movement rules, castling, en passant, "
     "and check/checkmate detection. Uses @engine/board for move validation.",
     ["core", "board", "render", "input"], "24KB"),
    ("Checkers", "checkers", "Two-player checkers (draughts) with diagonal movement, capturing, "
     "king promotion, and forced captures.",
     ["core", "board", "render", "input"], "~18KB"),
    ("Ludo", "ludo", "4-player Ludo with AI opponents, dice rolling, track-based movement, "
     "captures, safe zones, and home stretch. First non-grid game.",
     ["core", "render", "input", "ai"], "~22KB"),
    ("Reversi", "reversi", "Othello/Reversi with disc flipping mechanics. Two-player "
     "turn-based strategy on 8x8 grid.",
     ["core", "board", "render", "input"], "~16KB"),
    ("Gomoku", "gomoku", "Five-in-a-row on a Go-style board. Two-player with win detection.",
     ["core", "board", "render", "input"], "~15KB"),
    ("Connect 4", "connect4", "Vertical dropping connect-four. Gravity mechanics, "
     "4-in-a-row detection across rows/columns/diagonals.",
     ["core", "grid", "render", "input"], "~16KB"),
    ("Tic-Tac-Toe", "tic-tac-toe", "Classic 3x3 grid. Two-player with win/draw detection. "
     "Simplest board game in the collection.",
     ["core", "render", "input"], "~10KB"),
    ("Go (9x9)", "go", "Territory control on 9x9 board. Stone placement, capture via liberties, "
     "ko rule, territory counting, AI opponent. Flood-fill algorithms for group detection. "
     "First game to use @engine/turns for turn management.",
     ["core", "render", "input", "ai", "turns"], "~20KB"),
]

for name, repo, desc, modules, size in games_board:
    pdf.section_title(name, level=3)
    pdf.body_text(desc)
    pdf.body_text(f"Repository: agadabanka/{repo} | Bundle: {size} | Modules: {', '.join(modules)}")

# ── PUZZLE GAMES ──
pdf.section_title("Puzzle Games (7)", level=2)

games_puzzle = [
    ("Tetris", "tetris", "Classic Tetris with 7 tetromino types, rotation, hard/soft drop, "
     "line clearing, scoring, and level progression. Definitive grid-game example.",
     ["core", "grid", "render", "input"], "19KB"),
    ("2048", "game2048", "Sliding tile puzzle. Merge matching numbers to reach 2048. "
     "Four-directional input with gravity-based tile sliding.",
     ["core", "grid", "render", "input"], "~15KB"),
    ("Sudoku", "sudoku", "9x9 number puzzle with cell selection, number input, "
     "conflict detection, and puzzle generation.",
     ["core", "render", "input"], "~18KB"),
    ("Sliding Puzzle", "sliding-puzzle", "Classic 15-puzzle. Numbered tiles in 4x4 grid "
     "with one empty space. Slide to arrange in order.",
     ["core", "grid", "render", "input"], "~14KB"),
    ("Minesweeper", "minesweeper", "Grid-based mine detection. Click to reveal, "
     "flag suspected mines. Flood-fill for empty regions.",
     ["core", "grid", "render", "input"], "~17KB"),
    ("Wordle", "wordle", "5-letter word guessing. Color-coded feedback (green/yellow/gray). "
     "6 attempts to guess the daily word.",
     ["core", "render", "input"], "~16KB"),
    ("Sokoban", "sokoban", "Box-pushing puzzle with 5 hand-crafted levels. Push mechanics, "
     "undo/history stack, move counting, level progression. Validated push-entity "
     "interaction pattern and undo system for ECS.",
     ["core", "grid", "render", "input"], "~16KB"),
]

for name, repo, desc, modules, size in games_puzzle:
    pdf.section_title(name, level=3)
    pdf.body_text(desc)
    pdf.body_text(f"Repository: agadabanka/{repo} | Bundle: {size} | Modules: {', '.join(modules)}")

# ── ARCADE GAMES ──
pdf.section_title("Arcade Games (9)", level=2)

games_arcade = [
    ("Snake", "snake", "Classic snake game. Continuous movement, food collection, "
     "growing segments, self-collision, and wrapping walls.",
     ["core", "grid", "render", "input"], "17KB"),
    ("Pong", "pong", "Two-paddle ball game. AI opponent, ball physics with angle variation, "
     "score tracking.",
     ["core", "render", "input", "ai"], "~14KB"),
    ("Breakout", "breakout", "Brick-breaking game. Paddle, ball, brick grid with different "
     "durability levels. Power-ups and score multipliers.",
     ["core", "grid", "render", "input"], "~18KB"),
    ("Flappy", "flappy", "Flappy Bird clone. Gravity-based flight through pipe gaps. "
     "Single-button input, procedural obstacles.",
     ["core", "render", "input"], "~13KB"),
    ("Space Invaders", "space-invaders", "Classic shoot-em-up. Rows of descending aliens, "
     "player ship, bullets, shields. Wave-based progression.",
     ["core", "grid", "render", "input"], "~19KB"),
    ("Whack-a-Mole", "whack-a-mole", "Timed reaction game. Moles appear randomly, "
     "click to score. Speed increases over time.",
     ["core", "render", "input"], "~12KB"),
    ("Simon", "simon", "Memory pattern game. Colored buttons flash in sequence, "
     "player repeats. Sequence grows each round.",
     ["core", "render", "input"], "~11KB"),
    ("Pac-Man", "pac-man", "Grid-based maze game. 4 AI ghosts with distinct chase strategies "
     "(Blinky=chase, Pinky=ambush, Inky=flank, Clyde=random). Power pellet mode, "
     "dot collection, tunnel wrapping. Validated compositeEvaluator for multi-personality AI.",
     ["core", "grid", "render", "input", "ai"], "~20KB"),
    ("Frogger", "frogger", "Lane-based obstacle avoidance. Cars on roads, logs on rivers. "
     "Frog must ride logs (entity-rides-entity pattern). 5 home slots per level. "
     "Per-lane scrolling at different speeds validates wrapPosition edge cases.",
     ["core", "grid", "render", "input"], "~18KB"),
]

for name, repo, desc, modules, size in games_arcade:
    pdf.section_title(name, level=3)
    pdf.body_text(desc)
    pdf.body_text(f"Repository: agadabanka/{repo} | Bundle: {size} | Modules: {', '.join(modules)}")

# ── CARD GAMES ──
pdf.section_title("Card Games (3)", level=2)

games_card = [
    ("Solitaire", "solitaire", "Klondike solitaire. 7 tableau columns, stock/waste, "
     "4 foundation piles. Drag-and-drop card movement.",
     ["core", "render", "input"], "~20KB"),
    ("Blackjack", "blackjack", "Casino card game (21). Hit/stand decisions, dealer AI, "
     "bet management, standard deck dealing.",
     ["core", "render", "input", "ai"], "~16KB"),
    ("Poker (Texas Hold'em)", "poker", "Multi-round tournament with 3 AI opponents. "
     "Full hand evaluation (10 rankings from High Card to Royal Flush). "
     "Multi-phase betting (preflop/flop/turn/river/showdown). AI personalities "
     "(tight/loose/balanced). Drove creation of @engine/cards and @engine/turns modules.",
     ["core", "render", "input", "ai", "cards", "turns"], "~22KB"),
]

for name, repo, desc, modules, size in games_card:
    pdf.section_title(name, level=3)
    pdf.body_text(desc)
    pdf.body_text(f"Repository: agadabanka/{repo} | Bundle: {size} | Modules: {', '.join(modules)}")

# ── STRATEGY GAMES ──
pdf.section_title("Strategy Games (3)", level=2)

games_strategy = [
    ("Tower Defense", "tower-defense", "Path-based tower defense. Enemies follow fixed path, "
     "player places towers with different attack types. Wave system.",
     ["core", "render", "input"], "~21KB"),
    ("Roguelike", "roguelike", "Dungeon crawler with procedural level generation. "
     "Turn-based movement, enemies, items, fog of war.",
     ["core", "grid", "render", "input"], "~22KB"),
    ("Battleship", "battleship", "Two-grid naval combat. Ship placement phase, "
     "attack phase with hit/miss tracking. AI opponent.",
     ["core", "grid", "render", "input", "ai"], "~19KB"),
]

for name, repo, desc, modules, size in games_strategy:
    pdf.section_title(name, level=3)
    pdf.body_text(desc)
    pdf.body_text(f"Repository: agadabanka/{repo} | Bundle: {size} | Modules: {', '.join(modules)}")

# ── MATCHING/CASUAL ──
pdf.section_title("Matching & Casual Games (4)", level=2)

games_casual = [
    ("Match 3", "match3", "Bejeweled-style gem swapping. Match 3+ in row/column to clear. "
     "Cascading matches, score combos.",
     ["core", "grid", "render", "input"], "~17KB"),
    ("Memory", "memory", "Card-matching game. Flip two cards per turn, match pairs. "
     "Tracks moves and time.",
     ["core", "render", "input"], "~13KB"),
    ("Lights Out", "lights-out", "Toggle puzzle. Pressing a light toggles it and its "
     "neighbors. Goal: turn all lights off.",
     ["core", "grid", "render", "input"], "~12KB"),
    ("Hangman", "hangman", "Word guessing with letter selection. Limited wrong guesses "
     "before game over. Visual hangman figure.",
     ["core", "render", "input"], "~14KB"),
]

for name, repo, desc, modules, size in games_casual:
    pdf.section_title(name, level=3)
    pdf.body_text(desc)
    pdf.body_text(f"Repository: agadabanka/{repo} | Bundle: {size} | Modules: {', '.join(modules)}")

# ── SUMMARY TABLE ──
pdf.add_page()
pdf.section_title("SDK Module Usage Matrix", level=1)
pdf.body_text(
    "This matrix shows which @engine modules each game category uses. "
    "Core and render are universal; other modules are specialized."
)

pdf.table(
    ["Category", "Count", "core", "grid", "render", "board", "input", "ai", "turns", "cards"],
    [
        ["Board", "8", "Yes", "1/8", "Yes", "5/8", "Yes", "2/8", "1/8", "No"],
        ["Puzzle", "7", "Yes", "5/7", "Yes", "No", "Yes", "No", "No", "No"],
        ["Arcade", "9", "Yes", "5/9", "Yes", "No", "Yes", "2/9", "No", "No"],
        ["Card", "3", "Yes", "No", "Yes", "No", "Yes", "2/3", "1/3", "1/3"],
        ["Strategy", "3", "Yes", "2/3", "Yes", "No", "Yes", "1/3", "No", "No"],
        ["Casual", "4", "Yes", "2/4", "Yes", "No", "Yes", "No", "No", "No"],
    ],
    col_widths=[24, 16, 18, 18, 20, 18, 20, 18, 18, 18]
)

pdf.section_title("Game Complexity Spectrum", level=1)
pdf.diagram_box("Simple to Complex", """
  Simple                                                    Complex
  |                                                              |
  |  Tic-Tac-Toe   Snake    Tetris    Chess    Ludo    Roguelike |
  |  Simon         Pong     2048      Reversi  Tower-D Solitaire |
  |  Lights-Out    Flappy   Wordle    Gomoku   Battle  Blackjack |
  |  Hangman       Whack    Memory    Connect4 Match3  Space-Inv |
  |                Breakout Sudoku    Checkers         Minesweep |
  |                         Sliding                              |
  |                                                              |
  |  ~10-12KB      ~13-15KB  ~15-18KB  ~16-19KB  ~19-22KB       |
  |                                                              |
  |  1-2 systems   3-4 sys   4-5 sys   5-7 sys   6-8+ systems   |
  |  No AI         Basic     Grid ops  Board     AI + Track      |
  |  Grid/Custom   Physics   Turn mgmt Move val  Multi-player    |
""")

pdf.output(os.path.join(os.path.dirname(__file__), "ch05.pdf"))
print("ch05.pdf generated")
