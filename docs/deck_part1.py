#!/usr/bin/env python3
"""
VC Pitch Deck: Game Factory + Game Studio
Slides 1-6: Cover, Problem, Opportunity, Solution, How It Works, Product
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fpdf import FPDF

W, H = 297, 167  # Landscape 16:9-ish (mm)

# Colors
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

    def body(self, text, x=25, y=55, w=250, size=11, color=LIGHT_GRAY):
        self.set_font("Helvetica", "", size)
        self.set_text_color(*color)
        self.set_xy(x, y)
        self.multi_cell(w, 6, text)

    def accent_bar(self, y=22, w=60, color=BLUE):
        self.set_fill_color(*color)
        self.rect(25, y, w, 2.5, "F")

    def metric_box(self, x, y, w, h, value, label, color=BLUE):
        self.set_fill_color(*CARD_BG)
        self.rect(x, y, w, h, "F")
        self.set_fill_color(*color)
        self.rect(x, y, w, 2.5, "F")
        self.set_font("Helvetica", "B", 20)
        self.set_text_color(*WHITE)
        self.set_xy(x + 3, y + 8)
        self.cell(w - 6, 10, value, align="C")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*GRAY)
        self.set_xy(x + 3, y + 22)
        self.cell(w - 6, 5, label, align="C")

    def bullet(self, text, x=25, size=10, color=LIGHT_GRAY, bullet_color=BLUE):
        y = self.get_y()
        self.set_fill_color(*bullet_color)
        self.rect(x, y + 2, 3, 3, "F")
        self.set_font("Helvetica", "", size)
        self.set_text_color(*color)
        self.set_xy(x + 7, y)
        self.multi_cell(W - x - 40, 5.5, text)
        self.set_y(self.get_y() + 1.5)


pdf = Deck()

# ── SLIDE 1: TITLE ──
pdf.slide()
# Large accent rectangle
pdf.set_fill_color(*BLUE)
pdf.rect(0, 0, 10, H, "F")
pdf.set_font("Helvetica", "B", 42)
pdf.set_text_color(*WHITE)
pdf.set_xy(30, 30)
pdf.cell(200, 18, "Game Factory")
pdf.set_font("Helvetica", "", 18)
pdf.set_text_color(*LIGHT_BLUE)
pdf.set_xy(30, 52)
pdf.cell(200, 10, "+ Game Studio")
pdf.set_xy(30, 68)
pdf.set_font("Helvetica", "", 13)
pdf.set_text_color(*LIGHT_GRAY)
pdf.cell(250, 7, "AI-Powered Game Creation for Everyone")
pdf.set_xy(30, 80)
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(*GRAY)
pdf.cell(250, 6, "From natural language to published game in minutes, not months.")
# Right side: key stats
pdf.metric_box(200, 30, 75, 32, "29", "Games Published")
pdf.metric_box(200, 68, 75, 32, "<5 min", "Idea to Playable")
pdf.metric_box(200, 106, 75, 32, "$0", "Cost to Create")
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*GRAY)
pdf.set_xy(30, H - 15)
pdf.cell(200, 5, "Seed Round  |  March 2026  |  Confidential")
pdf.slide_number(1)

# ── SLIDE 2: THE PROBLEM ──
pdf.slide()
pdf.accent_bar(color=RED)
pdf.title_text("The Problem", color=WHITE)
pdf.subtitle_text("Game creation is broken for 99% of people", color=RED)

pdf.set_y(58)
pdf.bullet("Building a game today requires 3-7 years and $50M-$500M for AAA, or 6-18 months for indie", bullet_color=RED)
pdf.bullet("3.6 billion people play games, but fewer than 0.01% can create them", bullet_color=RED)
pdf.bullet("Existing tools (Unity, Unreal) have a 6-12 month learning curve before first playable output", bullet_color=RED)
pdf.bullet("20,017 games released on Steam in 2025 -- but 90% of revenue goes to the top 1%", bullet_color=RED)
pdf.bullet("No-code game tools produce toys, not real games -- they lack quality, depth, and publishability", bullet_color=RED)

pdf.set_font("Helvetica", "I", 12)
pdf.set_text_color(*GRAY)
pdf.set_xy(25, 120)
pdf.multi_cell(250, 6, '"The best game ideas die in the heads of people who can\'t code.\nThe best game code dies in repos nobody plays."')
pdf.slide_number(2)

# ── SLIDE 3: THE OPPORTUNITY ──
pdf.slide()
pdf.accent_bar(color=GREEN)
pdf.title_text("The Opportunity", color=WHITE)
pdf.subtitle_text("A $205B market ready for AI disruption", color=GREEN)

pdf.metric_box(25, 55, 58, 35, "$205B", "Games Market\n2026")
pdf.metric_box(88, 55, 58, 35, "$5.5B", "Indie Games\n2026")
pdf.metric_box(151, 55, 58, 35, "$1.8B", "AI Gaming VC\nDeployed")
pdf.metric_box(214, 55, 58, 35, "3.6B", "Global\nPlayers")

pdf.set_y(98)
pdf.bullet("AI game creation tools funding surged to $230M in Q3 2025 alone -- investors want this category", bullet_color=GREEN)
pdf.bullet("Indie games now capture 48% of Steam revenue, up from 24% in 2018 -- indie is winning", bullet_color=GREEN)
pdf.bullet("Sett raised $27M for AI game agents. CodeWisp (YC) and Playabl.ai prove VC appetite.", bullet_color=GREEN)
pdf.bullet("Mobile gaming is 51% of indie revenue and growing at 16.5% CAGR -- massive TAM", bullet_color=GREEN)
pdf.bullet("Cost of building games is dropping fast due to AI -- first movers capture the platform layer", bullet_color=GREEN)
pdf.slide_number(3)

# ── SLIDE 4: THE SOLUTION ──
pdf.slide()
pdf.accent_bar(color=BLUE)
pdf.title_text("Our Solution", color=WHITE)
pdf.subtitle_text("Two paths. One engine. Every game.", color=BLUE)

# Path 1 box
pdf.set_fill_color(*CARD_BG)
pdf.rect(25, 55, 120, 65, "F")
pdf.set_fill_color(*BLUE)
pdf.rect(25, 55, 120, 2.5, "F")
pdf.set_font("Helvetica", "B", 12)
pdf.set_text_color(*WHITE)
pdf.set_xy(30, 60)
pdf.cell(110, 7, "Path 1: Game Factory (Web UI)")
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(30, 70)
pdf.multi_cell(110, 5, 'User says "Make me a chess game"\n-> Claude generates game spec\n-> AI eval scores quality (0-100)\n-> Auto-fix bugs, publish to GitHub\n-> Playable game in < 5 minutes')

# Path 2 box
pdf.set_fill_color(*CARD_BG)
pdf.rect(155, 55, 120, 65, "F")
pdf.set_fill_color(*PURPLE)
pdf.rect(155, 55, 120, 2.5, "F")
pdf.set_font("Helvetica", "B", 12)
pdf.set_text_color(*WHITE)
pdf.set_xy(160, 60)
pdf.cell(110, 7, "Path 2: Game Studio (CLI)")
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*LIGHT_GRAY)
pdf.set_xy(160, 70)
pdf.multi_cell(110, 5, 'Developer uses CLI + Claude Code\n-> Write game.js with @engine SDK\n-> Build, eval, fix, publish workflow\n-> Battle-tests improve the engine\n-> Pro-grade games, full control')

# Shared layer
pdf.set_fill_color(20, 30, 50)
pdf.rect(25, 128, 250, 22, "F")
pdf.set_fill_color(*GREEN)
pdf.rect(25, 128, 250, 2, "F")
pdf.set_font("Helvetica", "B", 10)
pdf.set_text_color(*GREEN)
pdf.set_xy(30, 132)
pdf.cell(240, 6, "Shared: @engine SDK  |  Claude AI Eval  |  GitHub Publishing  |  Feedback Loop", align="C")
pdf.set_font("Helvetica", "", 8)
pdf.set_text_color(*GRAY)
pdf.set_xy(30, 140)
pdf.cell(240, 6, "Improvements from Path 2 automatically improve Path 1 quality. Every game makes the system smarter.", align="C")
pdf.slide_number(4)

# ── SLIDE 5: HOW IT WORKS ──
pdf.slide()
pdf.accent_bar(color=BLUE)
pdf.title_text("How It Works", color=WHITE)
pdf.subtitle_text("Describe -> Generate -> Evaluate -> Ship", color=LIGHT_BLUE)

# Flow diagram
steps = [
    ("Describe", 'User types:\n"Make a Tetris\ngame"', BLUE),
    ("Generate", "Claude AI\ncreates game\nusing @engine", PURPLE),
    ("Evaluate", "AI scores\nquality 0-100\nfinds bugs", ORANGE),
    ("Auto-Fix", "Claude fixes\nbugs, re-evals\nuntil score>80", GREEN),
    ("Publish", "Game pushed\nto GitHub\ninstantly live", RED),
]
sx = 20
for i, (title, desc, color) in enumerate(steps):
    x = sx + i * 56
    pdf.set_fill_color(*CARD_BG)
    pdf.rect(x, 58, 50, 55, "F")
    pdf.set_fill_color(*color)
    pdf.rect(x, 58, 50, 2.5, "F")
    # Number circle
    pdf.set_fill_color(*color)
    cx, cy = x + 25, 68
    pdf.ellipse(cx - 8, cy - 5, cx + 8, cy + 5, "F")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(cx - 8, cy - 4)
    pdf.cell(16, 8, str(i + 1), align="C")
    # Title
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(x + 2, 76)
    pdf.cell(46, 5, title, align="C")
    # Desc
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(*GRAY)
    pdf.set_xy(x + 3, 83)
    pdf.multi_cell(44, 4, desc, align="C")
    # Arrow
    if i < len(steps) - 1:
        ax = x + 52
        pdf.set_fill_color(*GRAY)
        pdf.set_draw_color(*GRAY)
        pdf.line(ax, 85, ax + 4, 85)

# Bottom tagline
pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(*GREEN)
pdf.set_xy(25, 122)
pdf.cell(250, 7, "Average time from idea to published game: < 5 minutes", align="C")
pdf.set_font("Helvetica", "", 9)
pdf.set_text_color(*GRAY)
pdf.set_xy(25, 132)
pdf.cell(250, 6, "No coding required. No downloads. No setup. Just describe and play.", align="C")
pdf.slide_number(5)

# ── SLIDE 6: THE PRODUCT ──
pdf.slide()
pdf.accent_bar(color=BLUE)
pdf.title_text("The Product", color=WHITE)
pdf.subtitle_text("ECS Game Engine + AI Quality Layer + Developer CLI", color=LIGHT_BLUE)

# Three product pillars
pillars = [
    ("Game Factory", "Web UI + Server", [
        "Natural language game creation",
        "Claude-powered spec generation",
        "AI eval with 0-100 scoring",
        "Auto-fix and auto-publish",
        "7 @engine SDK modules",
    ], BLUE),
    ("Game Studio", "CLI + Dev Tools", [
        "game-studio init/build/eval/publish",
        "Local esbuild-wasm bundling",
        "Title card generation (Gemini AI)",
        "GitHub issue auto-fixing",
        "Eval history tracking",
    ], PURPLE),
    ("@engine SDK", "ECS Runtime", [
        "core.js - Game loop & ECS world",
        "grid.js - Puzzle/arcade mechanics",
        "render.js - Canvas drawing layer",
        "board.js - Board game logic",
        "ai.js - AI opponent strategies",
    ], GREEN),
]

for i, (title, sub, items, color) in enumerate(pillars):
    x = 25 + i * 87
    pdf.set_fill_color(*CARD_BG)
    pdf.rect(x, 55, 82, 90, "F")
    pdf.set_fill_color(*color)
    pdf.rect(x, 55, 82, 2.5, "F")
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(x + 4, 60)
    pdf.cell(74, 6, title)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*color)
    pdf.set_xy(x + 4, 67)
    pdf.cell(74, 5, sub)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*LIGHT_GRAY)
    for j, item in enumerate(items):
        pdf.set_xy(x + 6, 76 + j * 11)
        pdf.set_fill_color(*color)
        pdf.rect(x + 4, 78 + j * 11, 2, 2, "F")
        pdf.cell(72, 5, item)

pdf.slide_number(6)

pdf.output(os.path.join(os.path.dirname(__file__), "deck_part1.pdf"))
print("deck_part1.pdf generated (slides 1-6)")
