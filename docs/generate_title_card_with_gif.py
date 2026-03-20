#!/usr/bin/env python3
"""
Generate enhanced title cards with Nano Banana (Gemini) backgrounds + gameplay GIF overlay.

Pipeline:
  1. Analyze gameplay GIF via Gemini text model -> get style suggestions
  2. Generate background art via Nano Banana (Gemini image gen) -> get background
  3. Composite: background + gameplay GIF frame + styled title text + overlays

Falls back to enhanced PIL-based generation when Gemini API is unavailable.

Usage:
  python3 docs/generate_title_card_with_gif.py tetris
  python3 docs/generate_title_card_with_gif.py tetris --gif path/to/gameplay.gif
  GEMINI_API_KEY=key python3 docs/generate_title_card_with_gif.py tetris --gif demos/gameplay.gif
"""
import sys
import os
import json
import math
import random
import base64
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "title-cards")
WIDTH, HEIGHT = 960, 540  # 16:9

GEMINI_TEXT_MODEL = "gemini-2.0-flash"
GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation"

GAME_THEMES = {
    "chess":          {"genre": "board",    "display": "Chess",          "elements": "chess pieces, checkered board, kings and queens"},
    "tetris":         {"genre": "puzzle",   "display": "Tetris",         "elements": "falling colorful blocks, tetrominoes, grid"},
    "snake":          {"genre": "arcade",   "display": "Snake",          "elements": "coiled snake, apple, grid maze, green on dark"},
    "ludo":           {"genre": "board",    "display": "Ludo",           "elements": "colored tokens, dice, cross-shaped board"},
    "tic-tac-toe":    {"genre": "casual",   "display": "Tic Tac Toe",   "elements": "X and O marks, grid lines"},
    "pong":           {"genre": "arcade",   "display": "Pong",           "elements": "paddles, bouncing ball, score display"},
    "breakout":       {"genre": "arcade",   "display": "Breakout",       "elements": "paddle, ball, colorful bricks"},
    "space-invaders": {"genre": "arcade",   "display": "Space Invaders", "elements": "pixel aliens, laser cannon, starfield"},
    "minesweeper":    {"genre": "puzzle",   "display": "Minesweeper",    "elements": "grid, flags, mines, numbers"},
    "wordle":         {"genre": "word",     "display": "Wordle",         "elements": "letter tiles, green/yellow/gray"},
}

# Colors extracted from actual gameplay analysis
GAMEPLAY_PALETTES = {
    "tetris": {
        "bg": (17, 17, 30),         # Dark navy from gameplay
        "primary": (255, 140, 0),    # Orange tetrominoes
        "secondary": (0, 255, 0),    # Green tetrominoes
        "accent1": (255, 0, 0),      # Red
        "accent2": (0, 0, 255),      # Blue
        "accent3": (255, 215, 0),    # Yellow
        "accent4": (0, 255, 255),    # Cyan
        "text": (255, 255, 255),
        "glow": (168, 85, 247),      # Purple glow
    },
}

DEFAULT_PALETTE = {
    "bg": (15, 15, 30),
    "primary": (59, 130, 246),
    "secondary": (168, 85, 247),
    "accent1": (239, 68, 68),
    "accent2": (34, 197, 94),
    "accent3": (249, 115, 22),
    "accent4": (56, 189, 248),
    "text": (255, 255, 255),
    "glow": (147, 130, 252),
}


# ─── Gemini API helpers ───

def gemini_request(api_key, model, contents, generation_config=None):
    """Make a request to the Gemini API. Returns parsed JSON or raises."""
    import requests
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {"contents": contents}
    if generation_config:
        payload["generationConfig"] = generation_config
    resp = requests.post(
        url,
        params={"key": api_key},
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    if not resp.ok:
        raise RuntimeError(f"Gemini API {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def analyze_gif_with_gemini(gif_path, api_key):
    """Send gameplay GIF to Gemini for style analysis and suggestions."""
    with open(gif_path, "rb") as f:
        gif_b64 = base64.b64encode(f.read()).decode()

    prompt = (
        "You are a professional game art director. Analyze this gameplay GIF. "
        "Based on the visual style, colors, and mood, suggest the BEST title card design. "
        "Return a JSON object (no markdown fences) with these keys:\n"
        '  "background_prompt": A detailed image generation prompt for the background art. '
        "The background should frame a centered gameplay GIF. NO text/letters/words in the image. "
        "Describe colors, patterns, atmosphere, lighting.\n"
        '  "font_style": Description of ideal font treatment (weight, effects, color)\n'
        '  "color_palette": Array of 6 hex color strings that harmonize with gameplay\n'
        '  "composition": Brief description of layout and framing\n'
        '  "mood": One-word mood descriptor'
    )

    contents = [{"parts": [
        {"inlineData": {"mimeType": "image/gif", "data": gif_b64}},
        {"text": prompt},
    ]}]

    data = gemini_request(api_key, GEMINI_TEXT_MODEL, contents, {"temperature": 0.7})
    text = ""
    for c in data.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            if "text" in p:
                text += p["text"]
    # Parse JSON from response
    text = text.strip().strip("`").strip()
    if text.startswith("json"):
        text = text[4:].strip()
    return json.loads(text)


def generate_background_with_nano_banana(api_key, prompt, game_name):
    """Use Gemini image generation (Nano Banana) to create background art."""
    full_prompt = (
        f"Generate a 16:9 landscape background image for a game title card. "
        f"Leave the CENTER of the image relatively dark/empty (that's where the gameplay "
        f"preview will be placed). {prompt} "
        f"Do NOT include any text, letters, words, or typography. "
        f"Make it visually stunning with rich colors and atmosphere."
    )

    contents = [{"parts": [{"text": full_prompt}]}]
    config = {"responseModalities": ["TEXT", "IMAGE"]}

    data = gemini_request(api_key, GEMINI_IMAGE_MODEL, contents, config)

    for c in data.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            if "inlineData" in p:
                img_bytes = base64.b64decode(p["inlineData"]["data"])
                return Image.open(BytesIO(img_bytes))

    raise RuntimeError("No image returned from Nano Banana")


# ─── Local PIL fallback ───

def find_font(size, bold=True):
    """Find a suitable system font."""
    if bold:
        paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        ]
    else:
        paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def find_mono_font(size):
    """Find a monospace font for that arcade feel."""
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeMonoBold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return find_font(size, bold=True)


def draw_tetris_background(draw, w, h, palette, rng):
    """Draw Tetris-specific background with falling tetrominoes."""
    shapes = [
        [(0,0),(1,0),(2,0),(3,0)],  # I
        [(0,0),(1,0),(0,1),(1,1)],  # O
        [(0,0),(1,0),(2,0),(1,1)],  # T
        [(0,0),(1,0),(1,1),(2,1)],  # S
        [(1,0),(2,0),(0,1),(1,1)],  # Z
        [(0,0),(0,1),(1,1),(2,1)],  # L
        [(2,0),(0,1),(1,1),(2,1)],  # J
    ]
    colors = [
        palette["primary"], palette["secondary"], palette["accent1"],
        palette["accent2"], palette["accent3"], palette["accent4"],
    ]
    cs = 22  # cell size

    # Draw falling tetrominoes scattered across background
    for _ in range(25):
        shape = rng.choice(shapes)
        ox = rng.randint(-20, w - 60)
        oy = rng.randint(-20, h - 40)
        col = rng.choice(colors)
        alpha = rng.randint(30, 80)

        # Reduce opacity near the GIF area (right-center)
        cx, cy = ox + 44, oy + 22
        if cx > w//2 and abs(cy - h//2) < 180:
            alpha = max(10, alpha - 35)

        for bx, by in shape:
            x1 = ox + bx * cs
            y1 = oy + by * cs
            x2 = x1 + cs - 2
            y2 = y1 + cs - 2
            draw.rectangle([x1, y1, x2, y2], fill=(*col, alpha))
            # Inner highlight
            draw.rectangle([x1+2, y1+2, x2-2, y2-2], fill=(*col, alpha + 10))


def draw_generic_background(draw, w, h, palette, rng):
    """Draw generic game-themed background."""
    accent = palette["primary"]
    glow = palette["glow"]
    for _ in range(30):
        x, y = rng.randint(0, w), rng.randint(0, h)
        s = rng.randint(10, 50)
        alpha = rng.randint(10, 40)
        cx, cy = x + s//2, y + s//2
        if abs(cx - w//2) < 200 and abs(cy - h//2) < 140:
            alpha = max(3, alpha - 20)
        c = rng.choice([accent, glow, palette["accent1"], palette["accent2"]])
        if rng.random() < 0.5:
            draw.rectangle([x, y, x+s, y+s], fill=(*c, alpha))
        else:
            draw.ellipse([x, y, x+s, y+s], fill=(*c, alpha))


def generate_background_local(game_key, palette):
    """Generate background using PIL (fallback when Gemini unavailable)."""
    rng = random.Random(hash(game_key) & 0xFFFF)
    img = Image.new("RGBA", (WIDTH, HEIGHT), (*palette["bg"], 255))
    draw = ImageDraw.Draw(img, "RGBA")

    # 1. Subtle grid lines
    grid_color = palette["primary"]
    for x in range(0, WIDTH, 40):
        draw.line([(x, 0), (x, HEIGHT)], fill=(*grid_color, 12), width=1)
    for y in range(0, HEIGHT, 40):
        draw.line([(0, y), (WIDTH, y)], fill=(*grid_color, 12), width=1)

    # 2. Starfield
    for _ in range(80):
        x = rng.randint(0, WIDTH)
        y = rng.randint(0, HEIGHT)
        r = rng.randint(1, 3)
        a = rng.randint(40, 180)
        draw.ellipse([x-r, y-r, x+r, y+r], fill=(255, 255, 255, a))

    # 3. Game-specific decorations
    if game_key == "tetris":
        draw_tetris_background(draw, WIDTH, HEIGHT, palette, rng)
    else:
        draw_generic_background(draw, WIDTH, HEIGHT, palette, rng)

    # 4. Light edge vignette (darken edges slightly, keep most of image visible)
    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vignette, "RGBA")
    cx, cy = WIDTH // 2, HEIGHT // 2
    max_dist = math.sqrt(cx**2 + cy**2)
    for y in range(0, HEIGHT, 2):
        for x in range(0, WIDTH, 4):  # Step by 4 for performance
            dist = math.sqrt((x - cx)**2 + (y - cy)**2)
            ratio = dist / max_dist
            # Only darken the outer 30% of the image
            alpha = int(max(0, (ratio - 0.7) * 400)) if ratio > 0.7 else 0
            if alpha > 0:
                vdraw.rectangle([x, y, x+4, y+2], fill=(0, 0, 0, min(alpha, 140)))
    img = Image.alpha_composite(img, vignette)

    # 5. Glow spots at corners
    glow_layer = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow_layer, "RGBA")
    glow_positions = [(80, 80), (WIDTH-80, 80), (80, HEIGHT-80), (WIDTH-80, HEIGHT-80)]
    glow_colors = [palette["primary"], palette["accent1"], palette["accent2"], palette["glow"]]
    for (gx, gy), gc in zip(glow_positions, glow_colors):
        for r in range(60, 0, -2):
            a = int(8 * (60 - r) / 60)
            gdraw.ellipse([gx-r, gy-r, gx+r, gy+r], fill=(*gc, a))
    img = Image.alpha_composite(img, glow_layer)

    return img


def extract_gif_frame(gif_path, frame_index=0):
    """Extract a representative frame from the gameplay GIF."""
    gif = Image.open(gif_path)
    try:
        gif.seek(frame_index)
    except EOFError:
        gif.seek(0)
    return gif.convert("RGBA")


def composite_title_card(background, gif_frame, game_key, palette, gemini_suggestions=None):
    """Composite the final title card: background + GIF frame + title text + overlays."""
    img = background.copy().convert("RGBA")
    if img.size != (WIDTH, HEIGHT):
        img = img.resize((WIDTH, HEIGHT), Image.LANCZOS)

    draw = ImageDraw.Draw(img, "RGBA")

    # ── GIF frame placement ──
    # Scale GIF to fit center area (max 320px wide, maintain aspect ratio)
    gw, gh = gif_frame.size
    max_gif_w, max_gif_h = 280, 340
    scale = min(max_gif_w / gw, max_gif_h / gh)
    new_gw, new_gh = int(gw * scale), int(gh * scale)
    gif_resized = gif_frame.resize((new_gw, new_gh), Image.LANCZOS)

    # Position: right-center area (like an arcade cabinet screen)
    gif_x = WIDTH // 2 + 80
    gif_y = (HEIGHT - new_gh) // 2

    # Draw a subtle frame/border around the GIF
    border = 4
    frame_glow = palette.get("glow", palette["primary"])

    # Outer glow
    for i in range(8, 0, -1):
        a = int(15 * i / 8)
        draw.rectangle(
            [gif_x - border - i, gif_y - border - i,
             gif_x + new_gw + border + i, gif_y + new_gh + border + i],
            outline=(*frame_glow, a)
        )

    # Frame border
    draw.rectangle(
        [gif_x - border, gif_y - border,
         gif_x + new_gw + border, gif_y + new_gh + border],
        outline=(*palette["primary"], 180), width=2
    )

    # Paste GIF frame
    img.paste(gif_resized, (gif_x, gif_y), gif_resized)

    # ── Title text (left side) ──
    display_name = GAME_THEMES.get(game_key, {}).get("display", game_key.title())

    # Use monospace font for arcade feel
    title_font = find_mono_font(56)
    sub_font = find_font(16, bold=False)
    hint_font = find_mono_font(12)

    # Title position: left-center
    title_x = 60
    title_y = HEIGHT // 2 - 50

    # Text glow/shadow layers
    glow_color = palette.get("glow", palette["primary"])
    for offset in range(6, 0, -1):
        a = int(25 * offset / 6)
        draw.text((title_x - offset, title_y), display_name, font=title_font,
                  fill=(*glow_color, a))
        draw.text((title_x + offset, title_y), display_name, font=title_font,
                  fill=(*glow_color, a))
        draw.text((title_x, title_y - offset), display_name, font=title_font,
                  fill=(*glow_color, a))
        draw.text((title_x, title_y + offset), display_name, font=title_font,
                  fill=(*glow_color, a))

    # Shadow
    draw.text((title_x + 3, title_y + 3), display_name, font=title_font,
              fill=(0, 0, 0, 200))

    # Main title
    draw.text((title_x, title_y), display_name, font=title_font,
              fill=(*palette["text"], 255))

    # ── Accent line under title ──
    bbox = draw.textbbox((title_x, title_y), display_name, font=title_font)
    title_w = bbox[2] - bbox[0]
    line_y = title_y + 65
    draw.rectangle([title_x, line_y, title_x + title_w, line_y + 3],
                   fill=(*palette["primary"], 200))

    # ── Genre subtitle ──
    genre = GAME_THEMES.get(game_key, {}).get("genre", "game").upper() + " GAME"
    draw.text((title_x, line_y + 12), genre, font=sub_font,
              fill=(*palette["primary"], 180))

    # ── Scanline effect over the GIF area (CRT feel) ──
    for y in range(gif_y, gif_y + new_gh, 3):
        draw.line([(gif_x, y), (gif_x + new_gw, y)], fill=(0, 0, 0, 25), width=1)

    # ── "PRESS START" hint ──
    hint = "CLICK OR PRESS ANY KEY TO PLAY"
    bbox = draw.textbbox((0, 0), hint, font=hint_font)
    hw = bbox[2] - bbox[0]
    draw.text(((WIDTH - hw) // 2, HEIGHT - 40), hint, font=hint_font,
              fill=(200, 200, 200, 160))

    # ── "Built with Game Studio" badge ──
    badge_font = find_font(10, bold=False)
    badge = "Built with Game Studio"
    bbox = draw.textbbox((0, 0), badge, font=badge_font)
    bw = bbox[2] - bbox[0]
    draw.text((WIDTH - bw - 15, HEIGHT - 22), badge, font=badge_font,
              fill=(100, 100, 100, 120))

    # ── "GAMEPLAY" label above GIF ──
    label_font = find_mono_font(10)
    label = "▶ GAMEPLAY"
    draw.text((gif_x, gif_y - 18), label, font=label_font,
              fill=(*palette["primary"], 160))

    # Convert to RGB
    bg = Image.new("RGB", (WIDTH, HEIGHT), palette["bg"])
    bg.paste(img, mask=img.split()[3])
    return bg


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)

    game_key = args[0]
    gif_path = None
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    # Parse --gif flag
    for i, a in enumerate(args):
        if a == "--gif" and i + 1 < len(args):
            gif_path = args[i + 1]

    if not gif_path:
        # Try default location
        candidates = [
            os.path.join(SCRIPT_DIR, f"{game_key}-gameplay.gif"),
            os.path.join(SCRIPT_DIR, "title-cards", f"{game_key}-gameplay.gif"),
        ]
        for c in candidates:
            if os.path.exists(c):
                gif_path = c
                break

    if not gif_path or not os.path.exists(gif_path):
        print(f"Error: No gameplay GIF found for {game_key}")
        print(f"  Provide one with: --gif path/to/gameplay.gif")
        sys.exit(1)

    palette = GAMEPLAY_PALETTES.get(game_key, DEFAULT_PALETTE)
    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"Generating enhanced title card for '{game_key}'")
    print(f"  GIF: {gif_path}")
    print(f"  Output: {OUT_DIR}/{game_key}.png")

    gemini_suggestions = None
    background = None

    # ── Step 1: Try Gemini analysis ──
    if api_key:
        print("\n  [Step 1] Analyzing gameplay GIF with Gemini...")
        try:
            gemini_suggestions = analyze_gif_with_gemini(gif_path, api_key)
            print(f"    Mood: {gemini_suggestions.get('mood', 'N/A')}")
            print(f"    Font: {gemini_suggestions.get('font_style', 'N/A')[:60]}")
            print(f"    Colors: {gemini_suggestions.get('color_palette', [])}")
        except Exception as e:
            print(f"    Gemini analysis failed: {e}")
            print("    Falling back to local analysis...")
    else:
        print("\n  [Step 1] No GEMINI_API_KEY set, using local style analysis")
        # Hardcoded analysis based on visual inspection of gameplay
        if game_key == "tetris":
            gemini_suggestions = {
                "background_prompt": (
                    "Dark cosmic space background with scattered colorful geometric blocks "
                    "floating and falling. Deep navy to black gradient. Subtle neon grid lines. "
                    "Glowing tetromino shapes in orange, cyan, green, red, blue, yellow at the edges. "
                    "Center area kept dark and empty for gameplay overlay. "
                    "Atmospheric lighting with purple and blue nebula-like wisps. "
                    "Arcade cabinet aesthetic with CRT scan line texture."
                ),
                "font_style": "Bold monospace, white with purple neon glow, slight 3D drop shadow",
                "color_palette": ["#FF8C00", "#00FF00", "#FF0000", "#0000FF", "#FFD700", "#A855F7"],
                "composition": "Title left, gameplay GIF right-center, floating blocks scattered",
                "mood": "electric",
            }

    # ── Step 2: Try Nano Banana background generation ──
    if api_key and gemini_suggestions and gemini_suggestions.get("background_prompt"):
        print("\n  [Step 2] Generating background with Nano Banana (Gemini image gen)...")
        try:
            background = generate_background_with_nano_banana(
                api_key, gemini_suggestions["background_prompt"], game_key
            )
            background = background.convert("RGBA")
            print(f"    Background generated: {background.size}")
        except Exception as e:
            print(f"    Nano Banana failed: {e}")
            print("    Falling back to local background generation...")

    if background is None:
        print("\n  [Step 2] Generating background locally with PIL...")
        background = generate_background_local(game_key, palette)
        print(f"    Background generated: {background.size}")

    # ── Step 3: Extract GIF frame ──
    print("\n  [Step 3] Extracting gameplay GIF frame...")
    # Pick a frame ~30% through for interesting gameplay state
    gif = Image.open(gif_path)
    n_frames = 0
    try:
        while True:
            n_frames += 1
            gif.seek(gif.tell() + 1)
    except EOFError:
        pass
    target_frame = max(0, int(n_frames * 0.3))
    gif_frame = extract_gif_frame(gif_path, target_frame)
    print(f"    Extracted frame {target_frame}/{n_frames} ({gif_frame.size})")

    # ── Step 4: Composite everything ──
    print("\n  [Step 4] Compositing final title card...")
    result = composite_title_card(background, gif_frame, game_key, palette, gemini_suggestions)

    out_path = os.path.join(OUT_DIR, f"{game_key}.png")
    result.save(out_path, "PNG", optimize=True)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"\n  Done! Saved: {out_path} ({size_kb:.0f} KB)")

    return out_path


if __name__ == "__main__":
    main()
