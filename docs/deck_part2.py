#!/usr/bin/env python3
"""
VC Pitch Deck: Game Factory + Game Studio
Slides 7-15: Traction, Moat, Business Model, Market, Comp, Roadmap, Team, Ask, Close
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fpdf import FPDF

W, H = 297, 167

NAVY = (15, 23, 42)
WHITE = (255, 255, 255)
BLUE = (59, 130, 246)
LIGHT_BLUE = (96, 165, 250)
GREEN = (34, 197, 94)
ORANGE = (249, 115, 22)
PURPLE = (168, 85, 247)
RED = (239, 68, 68)
GRAY = (148, 163, 184)
LIGHT_GRAY = (226, 232, 240)
DARK = (30, 41, 59)
CARD_BG = (30, 41, 59)
GOLD = (234, 179, 8)


class Deck(FPDF):
    def __init__(self):
        super().__init__(orientation="L", format=(167, 297))
        self.set_auto_page_break(auto=False)

    def slide(self):
        self.add_page()
        self.set_fill_color(*NAVY)
        self.rect(0, 0, W, H, "F")

    def slide_number(self, n, total=15):
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*GRAY)
        self.set_xy(W - 25, H - 10)
        self.cell(20, 5, f"{n} / {total}", align="R")

    def title_text(self, text, y=25, size=28, color=WHITE):
        self.set_font("Helvetica", "B", size)
        self.set_text_color(*color)
        self.set_xy(25, y)
        self.cell(W - 50, 12, text)

    def subtitle_text(self, text, y=42, size=14, color=LIGHT_BLUE):
        self.set_font("Helvetica", "", size)
        self.set_text_color(*color)
        self.set_xy(25, y)
        self.cell(W - 50, 8, text)

    def accent_bar(self, y=22, w=60, color=BLUE):
        self.set_fill_color(*color)
        self.rect(25, y, w, 2.5, "F")

    def metric_box(self, x, y, w, h, value, label, color=BLUE):
        self.set_fill_color(*CARD_BG)
        self.rect(x, y, w, h, "F")
        self.set_fill_color(*color)
        self.rect(x, y, w, 2.5, "F")
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(*WHITE)
        self.set_xy(x + 2, y + 7)
        self.cell(w - 4, 9, value, align="C")
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*GRAY)
        self.set_xy(x + 2, y + 19)
        self.cell(w - 4, 5, label, align="C")

    def bullet(self, text, x=25, size=10, color=LIGHT_GRAY, bullet_color=BLUE):
        y = self.get_y()
        self.set_fill_color(*bullet_color)
        self.rect(x, y + 2, 3, 3, "F")
        self.set_font("Helvetica", "", size)
        self.set_text_color(*color)
        self.set_xy(x + 7, y)
        self.multi_cell(W - x - 40, 5.5, text)
        self.set_y(self.get_y() + 1.5)

    def card(self, x, y, w, h, title, items, color=BLUE):
        self.set_fill_color(*CARD_BG)
        self.rect(x, y, w, h, "F")
        self.set_fill_color(*color)
        self.rect(x, y, w, 2.5, "F")
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(*WHITE)
        self.set_xy(x + 4, y + 5)
        self.cell(w - 8, 6, title)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*LIGHT_GRAY)
        for i, item in enumerate(items):
            self.set_xy(x + 6, y + 15 + i * 9)
            self.set_fill_color(*color)
            self.rect(x + 4, y + 17 + i * 9, 2, 2, "F")
            self.cell(w - 12, 5, item)


pdf = Deck()

# ── SLIDE 7: TRACTION ──
pdf.slide()
pdf.accent_bar(color=GREEN)
pdf.title_text("Traction & Proof Points", color=WHITE)
pdf.subtitle_text("29 games shipped. Zero lines of code required for users.", color=GREEN)

pdf.metric_box(25, 55, 52, 30, "29", "Games Published")
pdf.metric_box(82, 55, 52, 30, "7", "SDK Modules")
pdf.metric_box(139, 55, 52, 30, "6", "Game Genres")
pdf.metric_box(196, 55, 52, 30, "~1,300", "Lines of CLI Code")

pdf.set_y(92)
pdf.bullet("Full genre coverage: Board, Puzzle, Arcade, Card, Strategy, Casual -- proving engine generality", bullet_color=GREEN)
pdf.bullet("Quality scores consistently 80+ across all game types after AI eval and fix loop", bullet_color=GREEN)
pdf.bullet("Engine SDK battle-tested on 4 deep builds (Chess, Tetris, Snake, Ludo) -- 10 gaps found, 3 already fixed", bullet_color=GREEN)
pdf.bullet("Two creation paths operational: Web UI (non-technical) and CLI (developers) share one engine", bullet_color=GREEN)
pdf.bullet("Full publish pipeline: init -> build -> eval -> fix -> publish to GitHub in a single workflow", bullet_color=GREEN)
pdf.slide_number(7)

# ── SLIDE 8: THE 29 GAMES ──
pdf.slide()
pdf.accent_bar(color=PURPLE)
pdf.title_text("The 29 Games", color=WHITE)
pdf.subtitle_text("Built with Game Factory. Published on GitHub. Playable in browser.", color=PURPLE)

games = [
    ("Board (7)", ["Chess", "Checkers", "Ludo", "Reversi", "Gomoku", "Connect 4", "Tic-Tac-Toe"], BLUE),
    ("Puzzle (6)", ["Tetris", "2048", "Sudoku", "Sliding Puzzle", "Minesweeper", "Wordle"], PURPLE),
    ("Arcade (7)", ["Snake", "Pong", "Breakout", "Flappy", "Space Invaders", "Whack-a-Mole", "Simon"], GREEN),
    ("Card (2)", ["Solitaire", "Blackjack"], RED),
    ("Strategy (3)", ["Tower Defense", "Roguelike", "Battleship"], ORANGE),
    ("Casual (4)", ["Match 3", "Memory", "Lights Out", "Hangman"], LIGHT_BLUE),
]
for i, (cat, names, color) in enumerate(games):
    x = 25 + (i % 3) * 87
    y = 52 + (i // 3) * 52
    pdf.set_fill_color(*CARD_BG)
    pdf.rect(x, y, 82, 46, "F")
    pdf.set_fill_color(*color)
    pdf.rect(x, y, 82, 2, "F")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*color)
    pdf.set_xy(x + 4, y + 4)
    pdf.cell(74, 5, cat)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(*LIGHT_GRAY)
    for j, name in enumerate(names):
        col = j % 2
        row = j // 2
        pdf.set_xy(x + 4 + col * 40, y + 12 + row * 8)
        pdf.cell(38, 5, name)

pdf.slide_number(8)

# ── SLIDE 9: COMPETITIVE MOAT ──
pdf.slide()
pdf.accent_bar(color=ORANGE)
pdf.title_text("Competitive Moat", color=WHITE)
pdf.subtitle_text("Why we win and keep winning", color=ORANGE)

moats = [
    ("Flywheel Effect", "Every game built improves the engine. Engine improvements make all future games better. "
     "29 games have already fed back 10 concrete improvements. This compounds.", ORANGE),
    ("Two-Path Synergy", "Web UI users generate volume (data). CLI developers generate depth (quality). "
     "No competitor has both -- they are either no-code OR dev tools.", BLUE),
    ("AI Quality Layer", "Built-in Claude-powered eval scores every game 0-100. Auto-fixes bugs. "
     "No other platform has an AI quality gate -- we ship fewer broken games.", GREEN),
    ("ECS Architecture", "Entity-Component-System design means any game type works with the same primitives. "
     "Not locked to one genre. Chess, Tetris, Roguelikes -- one engine.", PURPLE),
]
for i, (title, desc, color) in enumerate(moats):
    y = 55 + i * 25
    pdf.set_fill_color(*CARD_BG)
    pdf.rect(25, y, 250, 22, "F")
    pdf.set_fill_color(*color)
    pdf.rect(25, y, 3, 22, "F")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*color)
    pdf.set_xy(32, y + 2)
    pdf.cell(80, 6, title)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*LIGHT_GRAY)
    pdf.set_xy(32, y + 9)
    pdf.multi_cell(238, 4.2, desc)

pdf.slide_number(9)

# ── SLIDE 10: BUSINESS MODEL ──
pdf.slide()
pdf.accent_bar(color=GREEN)
pdf.title_text("Business Model", color=WHITE)
pdf.subtitle_text("Platform + Marketplace + Pro Tools", color=GREEN)

pdf.card(25, 55, 82, 55, "Free Tier", [
    "Create unlimited games",
    "AI eval (5/day)",
    "Publish to GitHub",
    "Community SDK modules",
], GREEN)

pdf.card(112, 55, 82, 55, "Pro ($19/mo)", [
    "Unlimited AI eval",
    "Priority generation",
    "Custom title cards (AI)",
    "Analytics dashboard",
    "Private repos",
], BLUE)

pdf.card(199, 55, 82, 55, "Enterprise", [
    "White-label platform",
    "Custom SDK modules",
    "SLA & support",
    "On-premise deployment",
    "Team management",
], PURPLE)

# Revenue streams
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(*GOLD)
pdf.set_xy(25, 118)
pdf.cell(250, 6, "Additional Revenue Streams")
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(25, 126)
pdf.cell(130, 5, "- Game Marketplace: revenue share on published games")
pdf.set_xy(25, 133)
pdf.cell(130, 5, "- SDK Module Store: premium community engine modules")
pdf.set_xy(160, 126)
pdf.cell(115, 5, "- Asset Generation: AI title cards, sprites, audio")
pdf.set_xy(160, 133)
pdf.cell(115, 5, "- Education: game dev courses using our platform")
pdf.slide_number(10)

# ── SLIDE 11: MARKET SIZING ──
pdf.slide()
pdf.accent_bar(color=BLUE)
pdf.title_text("Market Sizing", color=WHITE)
pdf.subtitle_text("TAM -> SAM -> SOM", color=LIGHT_BLUE)

# Concentric circles representation
# TAM
pdf.set_fill_color(30, 50, 80)
pdf.rect(45, 55, 210, 30, "F")
pdf.set_font("Helvetica", "B", 14)
pdf.set_text_color(*BLUE)
pdf.set_xy(50, 58)
pdf.cell(40, 6, "$205B")
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(95, 58)
pdf.cell(150, 6, "TAM: Global Games Market (2026)")
pdf.set_font("Helvetica", "", 7.5)
pdf.set_text_color(*GRAY)
pdf.set_xy(95, 66)
pdf.cell(150, 5, "3.6B players, $206.5B projected by 2028, growing at 5% CAGR")

# SAM
pdf.set_fill_color(30, 55, 90)
pdf.rect(65, 90, 170, 28, "F")
pdf.set_font("Helvetica", "B", 13)
pdf.set_text_color(*GREEN)
pdf.set_xy(70, 93)
pdf.cell(40, 6, "$5.5B")
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(115, 93)
pdf.cell(110, 6, "SAM: Indie Game Creation + Dev Tools")
pdf.set_font("Helvetica", "", 7.5)
pdf.set_text_color(*GRAY)
pdf.set_xy(115, 101)
pdf.cell(110, 5, "Indie market $5.5B (2026), dev tools $1.5B, growing 14% CAGR")

# SOM
pdf.set_fill_color(30, 60, 100)
pdf.rect(90, 123, 120, 26, "F")
pdf.set_font("Helvetica", "B", 12)
pdf.set_text_color(*ORANGE)
pdf.set_xy(95, 126)
pdf.cell(40, 6, "$250M")
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(135, 126)
pdf.cell(70, 6, "SOM: AI Game Platforms")
pdf.set_font("Helvetica", "", 7.5)
pdf.set_text_color(*GRAY)
pdf.set_xy(135, 134)
pdf.cell(70, 5, "AI-first game creation, year 3 target")

pdf.slide_number(11)

# ── SLIDE 12: COMPETITIVE LANDSCAPE ──
pdf.slide()
pdf.accent_bar(color=ORANGE)
pdf.title_text("Competitive Landscape", color=WHITE)
pdf.subtitle_text("We sit at the intersection of AI + Game Engine + Publishing", color=ORANGE)

# Table header
headers = ["", "Game Factory", "Unity", "Roblox", "Sett", "CodeWisp"]
col_w = [45, 42, 42, 42, 42, 42]
hx = 25
pdf.set_font("Helvetica", "B", 8)
for i, h in enumerate(headers):
    color = GREEN if i == 1 else GRAY
    pdf.set_text_color(*color)
    pdf.set_xy(hx, 55)
    pdf.cell(col_w[i], 6, h, align="C" if i > 0 else "L")
    hx += col_w[i]

rows = [
    ("Natural language input", "Yes", "No", "No", "Yes", "Yes"),
    ("ECS game engine", "Yes", "Yes", "Custom", "No", "No"),
    ("AI quality eval", "Yes", "No", "No", "No", "No"),
    ("Auto bug fixing", "Yes", "No", "No", "Partial", "No"),
    ("Developer CLI", "Yes", "Yes", "No", "No", "No"),
    ("Publish pipeline", "Yes", "Manual", "Built-in", "Yes", "Yes"),
    ("Web + desktop games", "Yes", "Yes", "Web", "Mobile", "Web"),
    ("Self-improving engine", "Yes", "No", "No", "No", "No"),
    ("Free tier", "Yes", "Limited", "Yes", "No", "Yes"),
]

for ri, row in enumerate(rows):
    y = 63 + ri * 9.5
    if ri % 2 == 0:
        pdf.set_fill_color(20, 30, 50)
        pdf.rect(25, y, 255, 9.5, "F")
    hx = 25
    for ci, val in enumerate(row):
        if ci == 0:
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_text_color(*LIGHT_GRAY)
        elif ci == 1:
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*GREEN)
        else:
            pdf.set_font("Helvetica", "", 8)
            color = GREEN if val == "Yes" else (RED if val == "No" else GRAY)
            pdf.set_text_color(*color)
        pdf.set_xy(hx, y + 1)
        pdf.cell(col_w[ci], 7, val, align="C" if ci > 0 else "L")
        hx += col_w[ci]

pdf.slide_number(12)

# ── SLIDE 13: ROADMAP ──
pdf.slide()
pdf.accent_bar(color=PURPLE)
pdf.title_text("Roadmap", color=WHITE)
pdf.subtitle_text("From 29 games to 10,000 games on the platform", color=PURPLE)

phases = [
    ("NOW", "Foundation", [
        "29 games published",
        "7 SDK modules",
        "CLI + Web UI live",
        "AI eval operational",
    ], GREEN, "Complete"),
    ("Q3 2026", "Scale", [
        "turns.js, path.js, animate.js",
        "Game marketplace launch",
        "Multiplayer support",
        "100+ games target",
    ], BLUE, "Next"),
    ("Q1 2027", "Platform", [
        "Mobile game export",
        "Community SDK modules",
        "Pro tier launch ($19/mo)",
        "1,000+ games target",
    ], PURPLE, "Growth"),
    ("Q3 2027", "Ecosystem", [
        "Enterprise white-label",
        "Education partnerships",
        "Revenue share marketplace",
        "10,000+ games target",
    ], ORANGE, "Expand"),
]

for i, (time, title, items, color, badge) in enumerate(phases):
    x = 25 + i * 67
    pdf.set_fill_color(*CARD_BG)
    pdf.rect(x, 55, 62, 85, "F")
    pdf.set_fill_color(*color)
    pdf.rect(x, 55, 62, 2.5, "F")
    # Badge
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_fill_color(*color)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(x + 3, 59)
    pdf.cell(20, 5, badge, fill=True, align="C")
    # Time
    pdf.set_font("Helvetica", "", 7)
    pdf.set_text_color(*GRAY)
    pdf.set_xy(x + 26, 59)
    pdf.cell(32, 5, time)
    # Title
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(x + 3, 67)
    pdf.cell(56, 6, title)
    # Items
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(*LIGHT_GRAY)
    for j, item in enumerate(items):
        pdf.set_fill_color(*color)
        pdf.rect(x + 5, 79 + j * 12, 2, 2, "F")
        pdf.set_xy(x + 9, 77 + j * 12)
        pdf.cell(50, 5, item)

    # Arrow
    if i < len(phases) - 1:
        ax = x + 63
        pdf.set_draw_color(*GRAY)
        pdf.line(ax, 97, ax + 3, 97)

pdf.slide_number(13)

# ── SLIDE 14: THE ASK ──
pdf.slide()
pdf.accent_bar(color=GOLD)
pdf.title_text("The Ask", color=WHITE)
pdf.subtitle_text("Seed Round: $3M to go from 29 games to 10,000", color=GOLD)

pdf.metric_box(25, 58, 62, 32, "$3M", "Raising")
pdf.metric_box(92, 58, 62, 32, "18 mo", "Runway")
pdf.metric_box(159, 58, 62, 32, "15%", "Equity")
pdf.metric_box(226, 58, 62, 32, "$20M", "Post-Money")

pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(*WHITE)
pdf.set_xy(25, 98)
pdf.cell(250, 7, "Use of Funds")

funds = [
    ("Engineering (50%)", "$1.5M", "Hire 3 engineers. Build multiplayer, mobile export, marketplace.", BLUE),
    ("AI Infrastructure (25%)", "$750K", "Claude API costs, eval pipeline scaling, model fine-tuning.", PURPLE),
    ("Growth (15%)", "$450K", "Developer community, content creators, education partnerships.", GREEN),
    ("Operations (10%)", "$300K", "Legal, finance, infrastructure, hiring.", GRAY),
]
for i, (cat, amount, desc, color) in enumerate(funds):
    y = 108 + i * 12
    pdf.set_fill_color(*color)
    pdf.rect(25, y, 3, 9, "F")
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*color)
    pdf.set_xy(32, y)
    pdf.cell(55, 5, cat)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(90, y)
    pdf.cell(20, 5, amount)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*LIGHT_GRAY)
    pdf.set_xy(115, y)
    pdf.cell(160, 5, desc)

pdf.slide_number(14)

# ── SLIDE 15: CLOSING ──
pdf.slide()
# Full accent bar left side
pdf.set_fill_color(*BLUE)
pdf.rect(0, 0, 10, H, "F")

pdf.set_font("Helvetica", "B", 36)
pdf.set_text_color(*WHITE)
pdf.set_xy(30, 35)
pdf.cell(200, 16, "Game Factory")
pdf.set_font("Helvetica", "", 16)
pdf.set_text_color(*LIGHT_BLUE)
pdf.set_xy(30, 55)
pdf.cell(200, 8, "+ Game Studio")

pdf.set_font("Helvetica", "", 14)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(30, 75)
pdf.cell(250, 7, "Every person is a game creator.")
pdf.set_xy(30, 85)
pdf.cell(250, 7, "Every idea deserves to be playable.")
pdf.set_xy(30, 95)
pdf.cell(250, 7, "Every game should ship in minutes, not months.")

pdf.set_font("Helvetica", "B", 12)
pdf.set_text_color(*GREEN)
pdf.set_xy(30, 115)
pdf.cell(250, 7, "29 games. 6 genres. 2 paths. 1 engine. Zero code required.")

# Contact
pdf.set_fill_color(*CARD_BG)
pdf.rect(185, 35, 90, 50, "F")
pdf.set_fill_color(*BLUE)
pdf.rect(185, 35, 90, 2, "F")
pdf.set_font("Helvetica", "B", 9)
pdf.set_text_color(*WHITE)
pdf.set_xy(190, 40)
pdf.cell(80, 5, "Get in Touch")
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*LIGHT_GRAY)
items = [
    "github.com/agadabanka/game-factory",
    "github.com/agadabanka/game-studio",
    "seed@gamefactory.dev",
    "Demo: Let us build your game live",
]
for i, item in enumerate(items):
    pdf.set_xy(190, 50 + i * 8)
    pdf.cell(80, 5, item)

pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*GRAY)
pdf.set_xy(25, H - 12)
pdf.cell(250, 5, "Confidential  |  March 2026  |  Seed Round")
pdf.slide_number(15)

pdf.output(os.path.join(os.path.dirname(__file__), "deck_part2.pdf"))
print("deck_part2.pdf generated (slides 7-15)")
