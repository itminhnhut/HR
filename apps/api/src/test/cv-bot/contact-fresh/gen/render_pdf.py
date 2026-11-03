"""Word-like, Canva-like and two-column CVs, drawn directly (not via Chrome), each with its own text order."""
import io

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader

from content import row_text
from surface import FONT_DIR, HEIGHT, WIDTH, Flow, Surface, width_of, wrap

NAVY = HexColor('#22344f')
ROSE = HexColor('#c2506a')
SAND = HexColor('#f3e9dc')
TEAL = HexColor('#14706e')
GREY = HexColor('#555555')


def all_sections(doc):
    return [*doc['pre'], *doc['sections'], *doc['post']]


def contact_block(flow, doc, font, size, heading=None, bold=None):
    if heading:
        flow.heading(heading, bold or font, size + 1)
    for row in doc['contact']:
        for line in row_text(row):
            flow.para(line, font, size)


def tops(flow, doc, font, size):
    for line in doc['top']:
        flow.para(line, font, size)


def info_title(doc):
    return 'Personal information' if doc['en'] else 'Thông tin cá nhân'


def word_cv(doc, s):
    f = Flow(s, 62, WIDTH - 124, mode='runs')
    tops(f, doc, 'Times', 11)
    f.line('CURRICULUM VITAE', 'Times-B', 16, align='c', mode='line')
    f.space(6)
    f.line(doc['title'], 'Times', 12, align='c')
    if not doc['contact_end']:
        f.heading(info_title(doc), 'Times-B', 12)
    for line in doc['name']:
        f.line(f'{"Full name" if doc["en"] else "Họ và tên"}: {line}', 'Times-B', 11.5)
    if not doc['contact_end']:
        contact_block(f, doc, 'Times', 11)
    f.sections(all_sections(doc), 'Times', 'Times-B', 11)
    if doc['contact_end']:
        contact_block(f, doc, 'Times', 11, 'Thông tin liên hệ', 'Times-B')


def word_lyl(doc, s):
    f = Flow(s, 66, WIDTH - 132, mode='runs')
    f.line('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Times-B', 12, align='c', mode='line')
    f.line('Độc lập - Tự do - Hạnh phúc', 'Times-B', 12, align='c', mode='line')
    f.space(10)
    f.line('SƠ YẾU LÝ LỊCH', 'Times-B', 16, align='c', mode='line')
    f.space(8)
    tops(f, doc, 'Times', 11)
    for line in doc['name']:
        table_row(f, 'Họ và tên', line, 'Times-B')
    if not doc['contact_end']:
        for row in doc['contact']:
            table_row(f, row.label, row.value.replace('\n', ' '), 'Times')
    f.sections(all_sections(doc), 'Times', 'Times-B', 11)
    if doc['contact_end']:
        f.heading('Thông tin liên hệ', 'Times-B', 12)
        for row in doc['contact']:
            table_row(f, row.label, row.value.replace('\n', ' '), 'Times')
    if doc['name']:
        f.space(14)
        f.line('Người khai', 'Times-B', 11.5, align='r')
        f.line('(Ký, ghi rõ họ tên)', 'Times', 10, align='r')
        f.space(26)
        f.line(doc['full_name_for_form'] or doc['name'][0], 'Times-B', 11.5, align='r')


def table_row(flow, label, value, font):
    y_before = flow.y
    flow.line(f'{label}:', 'Times', 11, lead=0.01)
    flow.y = y_before
    inner = Flow(flow.s, flow.x + 136, flow.width - 136, y=flow.y, mode='runs', top=flow.top)
    inner.para(value, font, 11)
    flow.y = inner.y


def word_classic(doc, s):
    f = Flow(s, 54, WIDTH - 108, mode='words')
    tops(f, doc, 'Arial', 10)
    for line in doc['name']:
        f.para(line, 'Arial-B', 19, lead=24)
    f.line(doc['title'], 'Arial', 11, color=GREY)
    if not doc['contact_end']:
        joined = ' • '.join(' '.join(row_text(r)) for r in doc['contact'])
        f.para(joined, 'Arial', 9.5)
    f.sections(all_sections(doc), 'Arial', 'Arial-B', 10, upper=True)
    if doc['contact_end']:
        contact_block(f, doc, 'Arial', 10, 'Thông tin liên hệ', 'Arial-B')


def word_table(doc, s):
    f = Flow(s, 58, WIDTH - 116, mode='runs')
    tops(f, doc, 'Tahoma', 10)
    for line in doc['name']:
        f.line(line, 'Tahoma-B', 18, align='c', mode='line')
    f.line(doc['title'], 'Tahoma', 11, align='c')
    f.space(6)
    rows = [' '.join(row_text(r)) for r in doc['contact']]
    half = f.width / 2
    for left, right in zip(rows[::2], [*rows[1::2], '']):
        pair_row(f, left, right, half)
    f.sections(all_sections(doc), 'Tahoma', 'Tahoma-B', 9.5)


def pair_row(flow, left, right, half):
    y = flow.y
    a = Flow(flow.s, flow.x, half - 10, y=y, mode='runs', top=flow.top)
    a.para(left, 'Tahoma', 9.5)
    b = Flow(flow.s, flow.x + half, half, y=y, mode='runs', top=flow.top)
    if right:
        b.para(right, 'Tahoma', 9.5)
    flow.y = min(a.y, b.y)


def image_name(s, text, x, y):
    """A display name turned into a picture, so the PDF text does not contain it."""
    font = ImageFont.truetype(FONT_DIR + 'Arial Bold.ttf', 56)
    pad = 10
    box = ImageDraw.Draw(Image.new('RGB', (10, 10))).textbbox((0, 0), text, font=font)
    image = Image.new('RGB', (box[2] + pad * 2, box[3] + pad * 2), (34, 52, 79))
    ImageDraw.Draw(image).text((pad, pad), text, font=font, fill=(255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    buffer.seek(0)
    width = 170
    s.c.drawImage(ImageReader(buffer), x, y, width=width, height=width * image.height / image.width)


def canva_side(doc, s):
    panel = 196
    s.rect(0, 0, panel, HEIGHT, NAVY)
    side = Flow(s, 16, panel - 32, mode='words', top=HEIGHT - 40, y=HEIGHT - 40)
    main = Flow(s, panel + 22, WIDTH - panel - 46, mode='words', top=HEIGHT - 40, y=HEIGHT - 40)
    side_pre = doc['pre']
    side_rows = doc['contact']

    def sidebar_refs():
        for heading, lines in side_pre:
            ref = Flow(s, 16, panel - 32, y=170, mode='words')
            ref.line(heading, 'Arial-B', 10, color=white)
            for line in lines:
                ref.para(line, 'Arial', 8.5, color=white)

    if doc['refs_first']:
        sidebar_refs()
    main.sections([*doc['sections'], *doc['post']], 'Arial', 'Arial-B', 9.5, color=NAVY, upper=True)
    if doc['image_name']:
        image_name(s, doc['image_name'], 14, HEIGHT - 62)
        side.y = HEIGHT - 76
    for line in doc['name']:
        for part in wrap(line, 'Arial-B', 19, panel - 32):
            side.line(part, 'Arial-B', 19, lead=24, color=white, mode='line')
    side.line(doc['title'], 'Arial', 10, color=white)
    side.space(10)
    side.line('LIÊN HỆ' if not doc['en'] else 'CONTACT', 'Arial-B', 10, color=white, cs=1.6, mode='line')
    side.space(3)
    for row in side_rows:
        for line in row_text(row, 'bare'):
            side.para(line, 'Arial', 8.5, color=white)
    if not doc['refs_first']:
        sidebar_refs()


def row_grid(f, s, doc, y):
    """Contact chips on rows, centred; each chip is its own text object, icon first."""
    x, gap, chips = 44, 14, []
    for row in doc['contact']:
        chips.extend(row_text(row, 'bare'))
    line = []
    used = 0
    rows = []
    for chip in chips:
        width = width_of(chip, 'Verdana', 8) + 12
        if used + width + gap > WIDTH - 2 * x and line:
            rows.append(line)
            line, used = [], 0
        line.append((chip, width))
        used += width + gap
    rows.append(line)
    for items in rows:
        total = sum(w for _, w in items) + gap * (len(items) - 1)
        at = (WIDTH - total) / 2
        for chip, width in items:
            s.text(at, y, '•', 'Uni', 8, ROSE)
            s.text(at + 10, y, chip, 'Verdana', 8, mode='words')
            at += width + gap
        y -= 14
    return y


def canva_center(doc, s):
    y = HEIGHT - 58
    s.rect(0, HEIGHT - 8, WIDTH, 8, ROSE)
    for line in doc['top']:
        s.text(WIDTH / 2, y, line, 'Verdana', 9, align='c')
        y -= 14
    for line in doc['name']:
        cs = 2.2 if ' ' in line and '   ' not in line else 0
        s.text(WIDTH / 2, y, line, 'Verdana-B', 22, ROSE, cs=cs, align='c')
        y -= 28
    s.text(WIDTH / 2, y, doc['title'], 'Verdana', 11, GREY, cs=0.8, align='c')
    y = row_grid(None, s, doc, y - 20) - 8
    s.rule(44, WIDTH - 44, y + 4, ROSE)
    secs = all_sections(doc)
    narrow = [x for x in secs if x[0] in ('Học vấn', 'Education', 'Kỹ năng', 'Skills', 'Sở thích', 'Interests', 'Hoạt động')]
    wide = [x for x in secs if x not in narrow]
    Flow(s, 44, 180, y=y, mode='words', top=HEIGHT - 50).sections(narrow, 'Verdana', 'Verdana-B', 8, color=ROSE)
    Flow(s, 244, WIDTH - 288, y=y, mode='words', top=HEIGHT - 50).sections(wide, 'Verdana', 'Verdana-B', 8, color=ROSE)


def canva_band(doc, s):
    s.rect(0, 0, WIDTH, 78, SAND)
    f = Flow(s, 52, WIDTH - 104, y=HEIGHT - 44, mode='words', bottom=90, top=HEIGHT - 44)
    tops(f, doc, 'Tahoma', 9)
    if doc['title_first']:
        f.line(doc['title'].upper(), 'Tahoma-B', 24, lead=32, color=TEAL, mode='line')
        for line in doc['name']:
            f.line(line, 'Tahoma', 12, mode='line')
    else:
        for line in doc['name']:
            f.line(line, 'Tahoma-B', 24, lead=30, color=TEAL, mode='line')
        f.line(doc['title'], 'Tahoma', 12, color=GREY)
    f.sections(all_sections(doc), 'Tahoma', 'Tahoma-B', 9.5, color=TEAL)
    s.new_page() if f.y < 90 else None
    y = 62
    x_left, x_right = 52, WIDTH / 2 + 10
    chips = [line for row in doc['contact'] for line in row_text(row, 'bare')]
    for i, chip in enumerate(chips[:6]):
        s.text(x_left if i % 2 == 0 else x_right, y - 14 * (i // 2), chip, 'Tahoma', 8.5, mode='words')


def column_lines(sections, rows, font, bold, size, width):
    """(text, font, size) lines for a column, wrapped; used for interleaved drawing."""
    out = []
    for row in rows:
        for line in row_text(row):
            out.extend((part, font, size) for part in wrap(line, font, size, width))
    for heading, lines in sections:
        out.append((heading.upper(), bold, size + 0.5))
        for line in lines:
            out.extend((part, font, size) for part in wrap(line, font, size, width))
    return out


def split_sections(doc):
    secs = all_sections(doc)
    narrow_names = ('Học vấn', 'Education', 'Kỹ năng', 'Skills', 'Sở thích', 'Interests', 'Hoạt động')
    narrow = [x for x in secs if x[0] in narrow_names]
    return narrow, [x for x in secs if x not in narrow]


def two_col_y(doc, s):
    """Text stream ordered by height across both columns, so columns interleave line by line."""
    y = HEIGHT - 50
    for line in doc['name']:
        s.text(WIDTH / 2, y, line, 'Arial-B', 20, NAVY, align='c')
        y -= 24
    s.text(WIDTH / 2, y, doc['title'], 'Arial', 11, GREY, align='c')
    y -= 22
    narrow, wide = split_sections(doc)
    left = column_lines(narrow, doc['contact'], 'Arial', 'Arial-B', 8.5, 196)
    right = column_lines(wide, [], 'Arial', 'Arial-B', 8.5, 296)
    lead = 12.5
    drawn = [(y - i * lead, 44, t) for i, t in enumerate(left)] + [(y - i * lead, 256, t) for i, t in enumerate(right)]
    for at, x, (text, font, size) in sorted(drawn, key=lambda d: (-d[0], d[1])):
        s.text(x, at, text, font, size)


def two_col_mainfirst(doc, s):
    """Main column first in the stream, the contact sidebar (and sometimes the name) only afterwards."""
    panel = 168
    s.rect(WIDTH - panel, 0, panel, HEIGHT, SAND)
    main = Flow(s, 42, WIDTH - panel - 70, y=HEIGHT - 44, top=HEIGHT - 44)
    if not doc['name_low']:
        for line in doc['name']:
            main.line(line, 'Arial-B', 22, lead=28, color=TEAL, mode='line')
    main.line(doc['title'], 'Arial', 12, color=GREY)
    main.sections(all_sections(doc), 'Arial', 'Arial-B', 9.5, color=TEAL)
    side = Flow(s, WIDTH - panel + 12, panel - 22, y=HEIGHT - 44, top=HEIGHT - 44)
    side.line('Liên hệ' if not doc['en'] else 'Contact', 'Arial-B', 11, color=TEAL)
    for row in doc['contact']:
        for line in row_text(row, 'bare'):
            side.para(line, 'Arial', 8.5)
    if doc['name_low']:
        side.space(16)
        for line in doc['name']:
            side.para(line, 'Arial-B', 12)


def two_col_cell(doc, s):
    """A form-like table written column by column, so each label sits far from its value in the text."""
    y = HEIGHT - 48
    for line in doc['name']:
        s.text(44, y, line, 'Arial-B', 20, TEAL)
        y -= 25
    s.text(44, y, doc['title'], 'Arial', 11, GREY)
    y -= 22
    lead = 15
    rows = [(r.label, r.value.replace('\n', ' ')) for r in doc['contact']]
    for i, (label, _) in enumerate(rows):
        s.text(44, y - i * lead, label, 'Arial-B', 9)
    for i, (_, value) in enumerate(rows):
        for j, part in enumerate(wrap(value, 'Arial', 9, 420)[:1]):
            s.text(150, y - i * lead - j * lead, part, 'Arial', 9)
    below = y - len(rows) * lead - 6
    Flow(s, 44, WIDTH - 88, y=below, top=HEIGHT - 48).sections(all_sections(doc), 'Arial', 'Arial-B', 9.5, color=TEAL)


PDF_TEMPLATES = dict(word_cv=word_cv, word_lyl=word_lyl, word_classic=word_classic, word_table=word_table,
                     canva_side=canva_side, canva_center=canva_center, canva_band=canva_band, two_col_y=two_col_y,
                     two_col_mainfirst=two_col_mainfirst, two_col_cell=two_col_cell)


def render_pdf(doc, template, path):
    surface = Surface(path, doc['rng'])
    PDF_TEMPLATES[template](doc, surface)
    surface.save()
