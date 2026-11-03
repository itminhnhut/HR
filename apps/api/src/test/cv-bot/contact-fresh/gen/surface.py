"""Thin drawing layer over reportlab: runs like Word, word-by-word like Canva, page flow."""
from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONT_DIR = '/System/Library/Fonts/Supplemental/'
FONT_FILES = {
    'Arial': 'Arial.ttf', 'Arial-B': 'Arial Bold.ttf', 'Times': 'Times New Roman.ttf', 'Times-B': 'Times New Roman Bold.ttf',
    'Tahoma': 'Tahoma.ttf', 'Tahoma-B': 'Tahoma Bold.ttf', 'Verdana': 'Verdana.ttf', 'Verdana-B': 'Verdana Bold.ttf',
    'Uni': 'Arial Unicode.ttf',
}
for font_name, file_name in FONT_FILES.items():
    pdfmetrics.registerFont(TTFont(font_name, FONT_DIR + file_name))

WIDTH, HEIGHT = A4
GREY = HexColor('#555555')


def assert_glyphs(text: str, font: str) -> None:
    face = pdfmetrics.getFont(font).face
    missing = [c for c in text if ord(c) not in face.charToGlyph and not c.isspace()]
    if missing:
        raise ValueError(f'font {font} lacks {missing!r} for {text!r}')


def width_of(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap(text: str, font: str, size: float, width: float) -> list:
    lines, current = [], ''
    for word in text.split(' '):
        trial = f'{current} {word}'.strip()
        if current and width_of(trial, font, size) > width:
            lines.append(current)
            current = word
        else:
            current = trial
    return [*lines, current] if current else lines


class Surface:
    def __init__(self, path: str, rng, title: str = 'CV'):
        self.c = canvas.Canvas(path, pagesize=A4)
        self.c.setTitle(title)
        self.rng = rng

    def text(self, x, y, s, font='Arial', size=10, color=black, mode='line', cs=0.0, align='l'):
        """mode: 'line' one string; 'runs' Word-like chunks; 'words' one object per word, like Canva."""
        assert_glyphs(s, font)
        total = width_of(s, font, size) + cs * max(len(s) - 1, 0)
        x0 = x - total if align == 'r' else x - total / 2 if align == 'c' else x
        self.c.setFillColor(color)
        if mode == 'words':
            self._pieces(x0, y, s.split(' '), font, size, ' ')
        elif mode == 'runs':
            self._pieces(x0, y, self._runs(s), font, size, '')
        else:
            self._one(x0, y, s, font, size, cs)

    def _one(self, x, y, s, font, size, cs):
        t = self.c.beginText(x, y)
        t.setFont(font, size)
        t.setCharSpace(cs)
        t.textOut(s)
        self.c.drawText(t)

    def _pieces(self, x, y, pieces, font, size, joiner):
        at = x
        for piece in pieces:
            self._one(at, y, piece, font, size, 0)
            at += width_of(piece + joiner, font, size)

    def _runs(self, s):
        words = s.split(' ')
        runs, current = [], ''
        for i, word in enumerate(words):
            current += word + (' ' if i < len(words) - 1 else '')
            if self.rng.random() < 0.35:
                runs.append(current)
                current = ''
        return [*runs, current] if current else runs

    def rect(self, x, y, w, h, color):
        self.c.setFillColor(color)
        self.c.setStrokeColor(color)
        self.c.rect(x, y, w, h, fill=1, stroke=0)

    def rule(self, x0, x1, y, color=GREY):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(0.6)
        self.c.line(x0, y, x1, y)

    def new_page(self):
        self.c.showPage()

    def save(self):
        self.c.save()


class Flow:
    """A single column that wraps text and moves to a new page."""

    def __init__(self, surface, x, width, y=HEIGHT - 50, bottom=46, mode='line', top=HEIGHT - 50):
        self.s, self.x, self.width, self.y, self.bottom, self.mode, self.top = surface, x, width, y, bottom, mode, top

    def space(self, h):
        self.y -= h

    def line(self, text, font='Arial', size=10, lead=None, color=black, align='l', cs=0.0, mode=None):
        lead = lead or size * 1.4
        if self.y - lead < self.bottom:
            self.s.new_page()
            self.y = self.top
        x = self.x + self.width / 2 if align == 'c' else self.x + self.width if align == 'r' else self.x
        self.s.text(x, self.y - size, text, font, size, color, mode or self.mode, cs, align)
        self.y -= lead

    def para(self, text, font='Arial', size=10, lead=None, color=black, align='l'):
        for line in wrap(text, font, size, self.width):
            self.line(line, font, size, lead, color, align)

    def heading(self, text, font='Arial-B', size=11, color=black, upper=False):
        self.space(7)
        self.line(text.upper() if upper else text, font, size, color=color)
        self.s.rule(self.x, self.x + self.width, self.y + 1)
        self.space(3)

    def sections(self, sections, body='Arial', bold='Arial-B', size=10, color=black, upper=False):
        for heading, lines in sections:
            self.heading(heading, bold, size + 1, color, upper)
            for line in lines:
                self.para(line, body, size)
