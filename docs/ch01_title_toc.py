#!/usr/bin/env python3
"""Chapter 1: Title Page and Table of Contents"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from book_styles import BookPDF, ACCENT_BLUE, TEXT_PRIMARY, TEXT_SECONDARY, WHITE, DARK_BG, BORDER_COLOR

pdf = BookPDF()

# ── TITLE PAGE ──────────────────────────────────────────
pdf.add_page()

# Dark header band
pdf.set_fill_color(*DARK_BG)
pdf.rect(0, 0, 210, 100, "F")

# Title
pdf.set_y(25)
pdf.set_font("Helvetica", "B", 36)
pdf.set_text_color(*WHITE)
pdf.cell(0, 15, "Game Studio", align="C", new_x="LMARGIN", new_y="NEXT")

pdf.set_font("Helvetica", "", 16)
pdf.set_text_color(ACCENT_BLUE[0], ACCENT_BLUE[1], ACCENT_BLUE[2])
pdf.cell(0, 10, "Architecture, Engine & Games", align="C", new_x="LMARGIN", new_y="NEXT")

pdf.ln(5)
pdf.set_font("Helvetica", "", 11)
pdf.set_text_color(180, 180, 180)
pdf.cell(0, 7, "A comprehensive guide to the ECS Game Creation System", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 7, "From CLI to Canvas: 29 Games and Counting", align="C", new_x="LMARGIN", new_y="NEXT")

# Decorative line
pdf.ln(5)
pdf.set_draw_color(*ACCENT_BLUE)
pdf.set_line_width(1)
pdf.line(60, pdf.get_y(), 150, pdf.get_y())
pdf.set_line_width(0.2)

# Illustration: Mini architecture diagram on title page
pdf.set_y(108)
pdf.set_fill_color(249, 250, 251)
pdf.set_draw_color(*BORDER_COLOR)
pdf.rect(25, 108, 160, 80, "DF")

pdf.set_font("Courier", "", 7)
pdf.set_text_color(*TEXT_PRIMARY)
diagram = """
       Developer                  Game Factory Server
    +---------------+           +----------------------+
    |  game-studio  |-- pull -->|  /api/sdk            |
    |  CLI          |           |  @engine modules     |
    |               |-- build ->|  /api/compile        |
    |  game.js      |           |  esbuild bundler     |
    |  @engine/*    |-- eval -->|  /api/eval           |
    |               |           |  Claude QA scoring   |
    +-------+-------+           +----------+-----------+
            |                              |
            | publish                      | learnings
            v                              v
    +---------------+           +----------------------+
    |  GitHub Repo  |           |  @engine SDK         |
    |  (your game)  |<----------| (battle-hardened)    |
    +---------------+           +----------------------+
"""
for line in diagram.strip().split("\n"):
    pdf.set_x(30)
    pdf.cell(0, 3.8, line, new_x="LMARGIN", new_y="NEXT")

# Bottom info
pdf.set_y(200)
pdf.set_font("Helvetica", "", 10)
pdf.set_text_color(*TEXT_SECONDARY)
pdf.cell(0, 7, "Game Factory + Game Studio Ecosystem", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 7, "ECS-Based Game Engine  |  29 Published Games  |  CLI Workflow", align="C", new_x="LMARGIN", new_y="NEXT")

pdf.ln(15)
pdf.set_font("Helvetica", "I", 9)
pdf.set_text_color(*TEXT_SECONDARY)
pdf.cell(0, 7, "Generated March 2026", align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 7, "github.com/agadabanka/game-studio", align="C", new_x="LMARGIN", new_y="NEXT")

# ── TABLE OF CONTENTS ──────────────────────────────────
pdf.add_page()
pdf.set_font("Helvetica", "B", 24)
pdf.set_text_color(*TEXT_PRIMARY)
pdf.cell(0, 15, "Table of Contents", new_x="LMARGIN", new_y="NEXT")
pdf.ln(5)
pdf.set_draw_color(*ACCENT_BLUE)
pdf.set_line_width(0.5)
pdf.line(10, pdf.get_y(), 80, pdf.get_y())
pdf.set_line_width(0.2)
pdf.ln(8)

toc = [
    ("1", "System Overview", "The Two-Path Game Creation System"),
    ("2", "Game Studio CLI", "Commands, Workflow & Configuration"),
    ("3", "Game Factory Server", "APIs, Compilation & Evaluation"),
    ("4", "The Engine SDK", "ECS Architecture & Module Reference"),
    ("5", "The DSL", "Embedded TypeScript Game Specifications"),
    ("6", "The 29 Games", "Catalog of Published Games"),
    ("7", "Architecture Diagrams", "System, Data Flow & Dependencies"),
    ("8", "API Reference", "Complete Engine API Documentation"),
    ("9", "Learnings & Evolution", "Gaps Found, Fixes Applied, Roadmap"),
    ("10", "Future Directions", "Proposed Modules & Enhancements"),
]

for ch_num, title, subtitle in toc:
    y = pdf.get_y()
    # Chapter number bubble
    pdf.set_fill_color(*ACCENT_BLUE)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(*WHITE)
    pdf.set_xy(12, y)
    pdf.cell(10, 8, ch_num, fill=True, align="C")
    # Title
    pdf.set_xy(26, y)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(*TEXT_PRIMARY)
    pdf.cell(100, 8, title)
    # Subtitle
    pdf.set_xy(26, y + 8)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*TEXT_SECONDARY)
    pdf.cell(100, 6, subtitle)
    pdf.set_y(y + 18)

pdf.output(os.path.join(os.path.dirname(__file__), "ch01.pdf"))
print("ch01.pdf generated")
