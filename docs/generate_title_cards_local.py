#!/usr/bin/env python3
"""
Generate beautiful title card images for games using Pillow.
Fallback for when Gemini API is unavailable.

Usage:
  python3 docs/generate_title_cards_local.py              # All 29 games
  python3 docs/generate_title_cards_local.py chess tetris  # Specific games
"""
import sys
import os
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "title-cards")
WIDTH, HEIGHT = 960, 540  # 16:9

# ── Color palettes per game genre ──
PALETTES = {
    "board":    {"bg": (15, 23, 42), "accent": (59, 130, 246), "text": (255, 255, 255), "glow": (96, 165, 250)},
    "puzzle":   {"bg": (20, 10, 35), "accent": (168, 85, 247), "text": (255, 255, 255), "glow": (192, 132, 252)},
    "arcade":   {"bg": (10, 30, 10), "accent": (34, 197, 94),  "text": (255, 255, 255), "glow": (74, 222, 128)},
    "card":     {"bg": (30, 15, 10), "accent": (239, 68, 68),  "text": (255, 255, 255), "glow": (248, 113, 113)},
    "strategy": {"bg": (25, 25, 5),  "accent": (249, 115, 22), "text": (255, 255, 255), "glow": (251, 146, 60)},
    "casual":   {"bg": (15, 25, 35), "accent": (56, 189, 248), "text": (255, 255, 255), "glow": (125, 211, 252)},
    "word":     {"bg": (25, 20, 10), "accent": (234, 179, 8),  "text": (255, 255, 255), "glow": (250, 204, 21)},
}

GAMES = {
    # name: (display_name, genre, decorations)
    "chess":          ("Chess",          "board",    "chess_pieces"),
    "tetris":         ("Tetris",         "puzzle",   "tetris_blocks"),
    "snake":          ("Snake",          "arcade",   "snake_pattern"),
    "ludo":           ("Ludo",           "board",    "dice_tokens"),
    "tic-tac-toe":    ("Tic Tac Toe",   "casual",   "xo_grid"),
    "simon":          ("Simon",          "casual",   "quad_circles"),
    "lights-out":     ("Lights Out",     "puzzle",   "light_grid"),
    "whack-a-mole":   ("Whack-A-Mole",  "arcade",   "circles_pop"),
    "space-invaders": ("Space Invaders", "arcade",   "invader_rows"),
    "hangman":        ("Hangman",        "word",     "letter_rain"),
    "sliding-puzzle": ("Sliding Puzzle", "puzzle",   "tile_grid"),
    "sudoku":         ("Sudoku",         "puzzle",   "number_grid"),
    "memory":         ("Memory",         "casual",   "card_flip"),
    "battleship":     ("Battleship",     "strategy", "ocean_grid"),
    "game2048":       ("2048",           "puzzle",   "number_tiles"),
    "connect4":       ("Connect Four",   "strategy", "disc_grid"),
    "roguelike":      ("Roguelike",      "strategy", "dungeon_map"),
    "tower-defense":  ("Tower Defense",  "strategy", "tower_path"),
    "flappy":         ("Flappy",         "arcade",   "pipe_bird"),
    "solitaire":      ("Solitaire",      "card",     "card_fan"),
    "match3":         ("Match 3",        "casual",   "gem_grid"),
    "gomoku":         ("Gomoku",         "board",    "stone_board"),
    "reversi":        ("Reversi",        "board",    "disc_flip"),
    "wordle":         ("Wordle",         "word",     "letter_tiles"),
    "blackjack":      ("Blackjack",      "card",     "card_stack"),
    "pong":           ("Pong",           "arcade",   "paddle_ball"),
    "minesweeper":    ("Minesweeper",    "puzzle",   "mine_grid"),
    "checkers":       ("Checkers",       "board",    "checker_board"),
    "breakout":       ("Breakout",       "arcade",   "brick_wall"),
}


def draw_starfield(draw, w, h, count=80, seed=42):
    """Draw scattered stars/particles."""
    rng = random.Random(seed)
    for _ in range(count):
        x = rng.randint(0, w)
        y = rng.randint(0, h)
        r = rng.randint(1, 3)
        alpha = rng.randint(60, 200)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, alpha))


def draw_grid_lines(draw, w, h, spacing, color, alpha=30):
    """Draw subtle grid pattern."""
    c = (*color, alpha)
    for x in range(0, w, spacing):
        draw.line([(x, 0), (x, h)], fill=c, width=1)
    for y in range(0, h, spacing):
        draw.line([(0, y), (w, y)], fill=c, width=1)


def draw_decorative_shapes(draw, game_key, w, h, palette, seed=42):
    """Draw game-specific decorative elements."""
    rng = random.Random(seed)
    accent = palette["accent"]
    glow = palette["glow"]

    deco = GAMES[game_key][2]

    if deco == "chess_pieces":
        # Chess piece silhouettes (crowns, crosses)
        for _ in range(12):
            x, y = rng.randint(50, w - 50), rng.randint(50, h - 50)
            s = rng.randint(20, 50)
            a = rng.randint(15, 50)
            draw.rectangle([x, y, x + s, y + s * 2], outline=(*accent, a), width=2)
            draw.ellipse([x - 5, y - s // 2, x + s + 5, y + 5], outline=(*accent, a), width=2)

    elif deco == "tetris_blocks":
        shapes = [
            [(0,0),(1,0),(2,0),(3,0)],  # I
            [(0,0),(1,0),(0,1),(1,1)],  # O
            [(0,0),(1,0),(2,0),(1,1)],  # T
            [(0,0),(1,0),(1,1),(2,1)],  # S
        ]
        colors = [(239,68,68), (59,130,246), (34,197,94), (249,115,22), (168,85,247)]
        cs = 25
        for _ in range(15):
            shape = rng.choice(shapes)
            ox = rng.randint(0, w - 120)
            oy = rng.randint(0, h - 80)
            col = rng.choice(colors)
            a = rng.randint(30, 80)
            for bx, by in shape:
                draw.rectangle(
                    [ox + bx * cs, oy + by * cs, ox + (bx + 1) * cs - 2, oy + (by + 1) * cs - 2],
                    fill=(*col, a), outline=(*col, min(a + 30, 120)), width=1
                )

    elif deco == "snake_pattern":
        # Winding snake segments
        segs = 20
        sx, sy = rng.randint(100, 300), rng.randint(100, 400)
        for i in range(segs):
            dx = rng.choice([-1, 0, 1]) * 30
            dy = rng.choice([-1, 0, 1]) * 30
            nx, ny = sx + dx, sy + dy
            a = max(20, 80 - i * 3)
            draw.rectangle([sx - 12, sy - 12, sx + 12, sy + 12], fill=(*accent, a))
            sx, sy = nx, ny
        # Second snake
        sx, sy = rng.randint(500, 800), rng.randint(50, 300)
        for i in range(15):
            dx = rng.choice([-1, 0, 1]) * 30
            dy = rng.choice([-1, 0, 1]) * 30
            a = max(15, 60 - i * 3)
            draw.rectangle([sx - 10, sy - 10, sx + 10, sy + 10], fill=(*glow, a))
            sx, sy = sx + dx, sy + dy

    elif deco == "invader_rows":
        # Pixel invader shapes
        invader = [
            [0,0,1,0,0,0,0,1,0,0],
            [0,0,0,1,0,0,1,0,0,0],
            [0,0,1,1,1,1,1,1,0,0],
            [0,1,1,0,1,1,0,1,1,0],
            [1,1,1,1,1,1,1,1,1,1],
            [1,0,1,1,1,1,1,1,0,1],
            [1,0,1,0,0,0,0,1,0,1],
            [0,0,0,1,1,1,1,0,0,0],
        ]
        ps = 5
        for row in range(3):
            for col in range(6):
                ox = 80 + col * 140
                oy = 40 + row * 100
                a = rng.randint(30, 70)
                col_c = rng.choice([(34,197,94), (59,130,246), (239,68,68)])
                for iy, irow in enumerate(invader):
                    for ix, val in enumerate(irow):
                        if val:
                            draw.rectangle(
                                [ox + ix * ps, oy + iy * ps, ox + (ix+1)*ps, oy + (iy+1)*ps],
                                fill=(*col_c, a)
                            )

    elif deco in ("disc_grid", "xo_grid", "light_grid", "mine_grid", "number_grid", "tile_grid", "checker_board", "ocean_grid"):
        # Generic grid pattern with accented cells
        gs = 40
        cols, rows = w // gs, h // gs
        for r in range(rows):
            for c in range(cols):
                if rng.random() < 0.15:
                    a = rng.randint(15, 50)
                    draw.rectangle(
                        [c * gs + 1, r * gs + 1, (c+1) * gs - 1, (r+1) * gs - 1],
                        fill=(*accent, a)
                    )

    elif deco == "brick_wall":
        # Colorful brick rows
        bw, bh = 60, 20
        colors = [(239,68,68), (249,115,22), (234,179,8), (34,197,94), (59,130,246), (168,85,247)]
        for row in range(8):
            offset = (row % 2) * bw // 2
            for col in range(18):
                x = col * bw + offset
                y = 30 + row * (bh + 3)
                a = rng.randint(20, 60)
                c = colors[row % len(colors)]
                draw.rectangle([x, y, x + bw - 3, y + bh], fill=(*c, a), outline=(*c, min(a+20, 80)))

    elif deco == "pipe_bird":
        # Pipes and a bird
        for i in range(5):
            x = 100 + i * 180
            gap_y = rng.randint(150, 350)
            a = rng.randint(25, 55)
            draw.rectangle([x, 0, x + 60, gap_y - 60], fill=(34, 197, 94, a))
            draw.rectangle([x, gap_y + 60, x + 60, h], fill=(34, 197, 94, a))
        # Bird
        draw.ellipse([420, 240, 470, 280], fill=(234, 179, 8, 60))

    elif deco in ("card_fan", "card_flip", "card_stack"):
        # Scattered playing cards
        for _ in range(12):
            cx, cy = rng.randint(50, w-50), rng.randint(50, h-50)
            cw, ch = 45, 65
            a = rng.randint(15, 45)
            draw.rectangle([cx, cy, cx+cw, cy+ch], fill=(255,255,255,a), outline=(*accent, a+10))

    elif deco in ("gem_grid", "quad_circles", "circles_pop", "dice_tokens"):
        # Scattered circles
        for _ in range(25):
            cx, cy = rng.randint(30, w-30), rng.randint(30, h-30)
            r = rng.randint(10, 35)
            a = rng.randint(20, 60)
            c = rng.choice([accent, glow, (239,68,68), (234,179,8)])
            draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*c, a))

    elif deco in ("letter_rain", "letter_tiles"):
        # Scattered letter-like squares
        for _ in range(30):
            x, y = rng.randint(20, w-50), rng.randint(20, h-50)
            s = rng.randint(25, 40)
            a = rng.randint(20, 55)
            c = rng.choice([accent, glow, (34,197,94), (239,68,68)])
            draw.rectangle([x, y, x+s, y+s], fill=(*c, a))

    elif deco in ("number_tiles", "dungeon_map", "tower_path", "stone_board", "disc_flip", "paddle_ball"):
        # Generic atmospheric shapes
        for _ in range(20):
            x, y = rng.randint(0, w), rng.randint(0, h)
            s = rng.randint(15, 60)
            a = rng.randint(15, 45)
            if rng.random() < 0.5:
                draw.rectangle([x, y, x+s, y+s], fill=(*accent, a))
            else:
                draw.ellipse([x, y, x+s, y+s], fill=(*glow, a))


def find_font(size):
    """Try to find a suitable font."""
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def find_font_regular(size):
    """Try to find a regular weight font."""
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def generate_title_card(game_key):
    """Generate a single title card image."""
    display_name, genre, _ = GAMES[game_key]
    palette = PALETTES.get(genre, PALETTES["arcade"])

    # Create RGBA image
    img = Image.new("RGBA", (WIDTH, HEIGHT), (*palette["bg"], 255))
    draw = ImageDraw.Draw(img, "RGBA")

    # 1. Background grid
    draw_grid_lines(draw, WIDTH, HEIGHT, 40, palette["accent"], alpha=18)

    # 2. Starfield / particles
    draw_starfield(draw, WIDTH, HEIGHT, count=60, seed=hash(game_key) & 0xFFFF)

    # 3. Game-specific decorative elements
    draw_decorative_shapes(draw, game_key, WIDTH, HEIGHT, palette, seed=hash(game_key) & 0xFFFF)

    # 4. Gradient overlay (darken center for text readability)
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay, "RGBA")
    # Horizontal gradient bands - darker in center
    for y in range(HEIGHT):
        dist = abs(y - HEIGHT // 2) / (HEIGHT // 2)
        alpha = int(180 * (1 - dist * 0.7))
        odraw.line([(0, y), (WIDTH, y)], fill=(0, 0, 0, alpha))
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img, "RGBA")

    # 5. Accent line above title
    line_y = HEIGHT // 2 - 60
    lw = min(len(display_name) * 30 + 80, 500)
    lx = (WIDTH - lw) // 2
    draw.rectangle([lx, line_y, lx + lw, line_y + 3], fill=(*palette["accent"], 200))

    # 6. Game title text
    title_font = find_font(64)
    bbox = draw.textbbox((0, 0), display_name, font=title_font)
    tw = bbox[2] - bbox[0]
    tx = (WIDTH - tw) // 2
    ty = HEIGHT // 2 - 45

    # Text shadow
    draw.text((tx + 3, ty + 3), display_name, font=title_font, fill=(0, 0, 0, 180))
    # Glow effect
    draw.text((tx - 1, ty - 1), display_name, font=title_font, fill=(*palette["glow"], 60))
    draw.text((tx + 1, ty + 1), display_name, font=title_font, fill=(*palette["glow"], 60))
    # Main text
    draw.text((tx, ty), display_name, font=title_font, fill=(*palette["text"], 255))

    # 7. Genre subtitle
    sub_font = find_font_regular(18)
    genre_display = genre.upper() + " GAME"
    bbox = draw.textbbox((0, 0), genre_display, font=sub_font)
    sw = bbox[2] - bbox[0]
    draw.text(((WIDTH - sw) // 2, ty + 75), genre_display, font=sub_font,
              fill=(*palette["accent"], 180))

    # 8. Accent line below subtitle
    line_y2 = ty + 100
    draw.rectangle([lx, line_y2, lx + lw, line_y2 + 2], fill=(*palette["accent"], 140))

    # 9. "Click to Play" hint
    hint_font = find_font_regular(14)
    hint = "CLICK OR PRESS ANY KEY TO PLAY"
    bbox = draw.textbbox((0, 0), hint, font=hint_font)
    hw = bbox[2] - bbox[0]
    draw.text(((WIDTH - hw) // 2, HEIGHT - 50), hint, font=hint_font,
              fill=(200, 200, 200, 160))

    # 10. "Built with Game Studio" badge
    badge_font = find_font_regular(11)
    badge = "Built with Game Studio"
    bbox = draw.textbbox((0, 0), badge, font=badge_font)
    bw = bbox[2] - bbox[0]
    draw.text((WIDTH - bw - 15, HEIGHT - 25), badge, font=badge_font,
              fill=(120, 120, 120, 120))

    # Convert to RGB for PNG save
    bg = Image.new("RGB", (WIDTH, HEIGHT), palette["bg"])
    bg.paste(img, mask=img.split()[3])
    return bg


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    args = sys.argv[1:]
    games = args if args else list(GAMES.keys())

    print(f"Generating {len(games)} title cards...\n")
    ok, fail = 0, 0

    for game in games:
        if game not in GAMES:
            print(f"  [skip] {game} - unknown game")
            fail += 1
            continue

        out_path = os.path.join(OUT_DIR, f"{game}.png")
        try:
            img = generate_title_card(game)
            img.save(out_path, "PNG", optimize=True)
            size_kb = os.path.getsize(out_path) / 1024
            print(f"  [ok]   {game:20s} -> {size_kb:5.0f} KB")
            ok += 1
        except Exception as e:
            print(f"  [fail] {game}: {e}")
            fail += 1

    print(f"\nDone: {ok} generated, {fail} failed")
    print(f"Output: {OUT_DIR}/")


if __name__ == "__main__":
    main()
