"""
Shared styles and utilities for the Game Studio book PDF generation.
Each chapter script imports this to get consistent formatting.
"""
from fpdf import FPDF

# Color palette
DARK_BG = (17, 17, 17)         # #111
ACCENT_BLUE = (59, 130, 246)   # blue-500
ACCENT_GREEN = (34, 197, 94)   # green-500
ACCENT_ORANGE = (249, 115, 22) # orange-500
ACCENT_PURPLE = (168, 85, 247) # purple-500
ACCENT_RED = (239, 68, 68)     # red-500
TEXT_PRIMARY = (31, 41, 55)    # gray-800
TEXT_SECONDARY = (107, 114, 128) # gray-500
LIGHT_BG = (249, 250, 251)    # gray-50
CODE_BG = (243, 244, 246)     # gray-100
BORDER_COLOR = (209, 213, 219) # gray-300
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)


class BookPDF(FPDF):
    """Custom PDF class with book styling helpers."""

    def __init__(self, chapter_title=""):
        super().__init__()
        self.chapter_title = chapter_title
        self.set_auto_page_break(auto=True, margin=25)

    def header(self):
        if self.page_no() == 1 and not self.chapter_title:
            return  # Skip header on title page
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*TEXT_SECONDARY)
        self.cell(0, 10, "Game Studio: Architecture, Engine & Games", align="L")
        if self.chapter_title:
            self.cell(0, 10, self.chapter_title, align="R", new_x="LMARGIN", new_y="NEXT")
        else:
            self.ln(10)
        self.set_draw_color(*BORDER_COLOR)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*TEXT_SECONDARY)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def chapter_cover(self, number, title, subtitle=""):
        """Full-page chapter cover."""
        self.add_page()
        self.ln(60)
        # Chapter number
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(*ACCENT_BLUE)
        self.cell(0, 10, f"CHAPTER {number}", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(5)
        # Title
        self.set_font("Helvetica", "B", 32)
        self.set_text_color(*TEXT_PRIMARY)
        self.cell(0, 15, title, align="C", new_x="LMARGIN", new_y="NEXT")
        if subtitle:
            self.ln(5)
            self.set_font("Helvetica", "", 14)
            self.set_text_color(*TEXT_SECONDARY)
            self.cell(0, 10, subtitle, align="C", new_x="LMARGIN", new_y="NEXT")
        # Decorative line
        self.ln(10)
        self.set_draw_color(*ACCENT_BLUE)
        self.set_line_width(0.8)
        self.line(70, self.get_y(), 140, self.get_y())
        self.set_line_width(0.2)

    def section_title(self, title, level=1):
        """Section heading."""
        self.ln(6)
        if level == 1:
            self.set_font("Helvetica", "B", 18)
            self.set_text_color(*TEXT_PRIMARY)
            self.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT")
            self.set_draw_color(*ACCENT_BLUE)
            self.set_line_width(0.5)
            self.line(10, self.get_y(), 80, self.get_y())
            self.set_line_width(0.2)
            self.ln(4)
        elif level == 2:
            self.set_font("Helvetica", "B", 14)
            self.set_text_color(*ACCENT_BLUE)
            self.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
            self.ln(2)
        elif level == 3:
            self.set_font("Helvetica", "B", 11)
            self.set_text_color(*TEXT_PRIMARY)
            self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
            self.ln(1)

    def body_text(self, text):
        """Standard body paragraph."""
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*TEXT_PRIMARY)
        self.multi_cell(0, 5.5, text)
        self.ln(3)

    def bullet_list(self, items):
        """Bulleted list."""
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*TEXT_PRIMARY)
        for item in items:
            self.cell(6, 5.5, "-")
            x_after_bullet = self.get_x()
            y_before = self.get_y()
            self.multi_cell(190 - (x_after_bullet - 10), 5.5, item)
            self.set_x(10)
        self.ln(2)

    def code_block(self, code, title=""):
        """Monospace code block with background."""
        if title:
            self.set_font("Helvetica", "B", 9)
            self.set_text_color(*TEXT_SECONDARY)
            self.cell(0, 6, title, new_x="LMARGIN", new_y="NEXT")

        self.set_fill_color(*CODE_BG)
        self.set_draw_color(*BORDER_COLOR)
        self.set_font("Courier", "", 8)
        self.set_text_color(*TEXT_PRIMARY)

        lines = code.strip().split("\n")
        line_h = 4.2
        block_h = len(lines) * line_h + 6

        # Check if we need a page break
        if self.get_y() + block_h > 270:
            self.add_page()

        start_y = self.get_y()
        self.rect(10, start_y, 190, block_h, "DF")
        self.set_y(start_y + 3)
        for line in lines:
            self.set_x(14)
            # Truncate long lines
            if len(line) > 95:
                line = line[:92] + "..."
            self.cell(0, line_h, line, new_x="LMARGIN", new_y="NEXT")
        self.set_y(start_y + block_h + 3)

    def info_box(self, title, text, color=ACCENT_BLUE):
        """Colored info/tip box."""
        self.set_draw_color(*color)
        self.set_fill_color(color[0], color[1], color[2])
        start_y = self.get_y()
        # Left accent bar
        self.rect(10, start_y, 3, 20, "F")
        # Background
        self.set_fill_color(min(color[0]+200, 255), min(color[1]+200, 255), min(color[2]+200, 255))
        self.rect(13, start_y, 187, 20, "F")
        self.set_xy(16, start_y + 2)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*color)
        self.cell(0, 5, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(16)
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*TEXT_PRIMARY)
        self.multi_cell(180, 4.5, text)
        self.set_y(start_y + 23)

    def table(self, headers, rows, col_widths=None):
        """Simple table with headers."""
        if col_widths is None:
            col_widths = [190 / len(headers)] * len(headers)

        # Header row
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(*ACCENT_BLUE)
        self.set_text_color(*WHITE)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 7, h, border=1, fill=True)
        self.ln()

        # Data rows
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*TEXT_PRIMARY)
        fill = False
        for row in rows:
            if self.get_y() > 265:
                self.add_page()
            if fill:
                self.set_fill_color(*LIGHT_BG)
            else:
                self.set_fill_color(*WHITE)
            max_h = 7
            for i, cell_text in enumerate(row):
                self.cell(col_widths[i], max_h, str(cell_text)[:50], border=1, fill=True)
            self.ln()
            fill = not fill
        self.ln(3)

    def diagram_box(self, title, ascii_art):
        """ASCII art diagram in a bordered box."""
        self.section_title(title, level=2)
        self.set_fill_color(*LIGHT_BG)
        self.set_draw_color(*BORDER_COLOR)
        self.set_font("Courier", "", 7)
        self.set_text_color(*TEXT_PRIMARY)

        lines = ascii_art.strip().split("\n")
        line_h = 3.8
        block_h = len(lines) * line_h + 8

        if self.get_y() + block_h > 270:
            self.add_page()

        start_y = self.get_y()
        self.rect(10, start_y, 190, block_h, "DF")
        self.set_y(start_y + 4)
        for line in lines:
            self.set_x(14)
            if len(line) > 110:
                line = line[:107] + "..."
            self.cell(0, line_h, line, new_x="LMARGIN", new_y="NEXT")
        self.set_y(start_y + block_h + 3)
