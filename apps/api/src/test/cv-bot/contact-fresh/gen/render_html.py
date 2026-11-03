"""TopCV-like and VietnamWorks-like CVs: HTML printed by headless Chrome, the way web CV builders export."""
from html import escape

from content import ICONS, row_text

BASE = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Arial, Tahoma, sans-serif; font-size: 12.5px; color: #222; line-height: 1.45; }
h2 { font-size: 14px; margin: 14px 0 4px; }
p { margin: 2px 0; }
"""


def e(text: str) -> str:
    return escape(text)


def sections_html(sections, cls='') -> str:
    parts = []
    for heading, lines in sections:
        body = ''.join(f'<p>{e(line)}</p>' for line in lines)
        parts.append(f'<section class="{cls}"><h2>{e(heading)}</h2>{body}</section>')
    return ''.join(parts)


def rows_html(rows, mode='label') -> str:
    return ''.join(f'<p>{"<br>".join(e(x) for x in row_text(r, mode))}</p>' for r in rows)


def top_html(doc) -> str:
    return ''.join(f'<p class="top">{e(x)}</p>' for x in doc['top'])


def page(css: str, body: str) -> str:
    return f'<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><style>{BASE}{css}</style></head><body>{body}</body></html>'


def all_sections(doc):
    return [*doc['pre'], *doc['sections'], *doc['post']]


def topcv_side(doc) -> str:
    css = """.wrap{display:flex;min-height:297mm}.side{width:34%;background:#1f4e5f;color:#fff;padding:26px 18px}
    .main{width:66%;padding:26px 24px}.avatar{width:90px;height:90px;border-radius:50%;background:#cfd8dc;margin:0 auto 14px}
    h1{font-size:21px;margin:0 0 4px;line-height:1.2}.role{font-size:13px;margin-bottom:12px;opacity:.9}.side h2{border-bottom:1px solid #fff5}
    .main h2{color:#1f4e5f;border-bottom:2px solid #1f4e5f}"""
    skills, rest = [], []
    for section in all_sections(doc):
        (skills if section[0] in ('Kỹ năng', 'Skills', 'Sở thích', 'Interests') else rest).append(section)
    name = ''.join(f'<h1>{e(x)}</h1>' for x in doc['name'])
    mode = 'icon' if doc['rng'].random() < 0.6 else 'label'
    side = f'<div class="avatar"></div>{name}<div class="role">{e(doc["title"])}</div>{rows_html(doc["contact"], mode)}{sections_html(skills)}'
    footer = '<p style="font-size:10px;color:#888;margin-top:18px">Hồ sơ được tạo từ mẫu CV trực tuyến</p>'
    return page(css, f'{top_html(doc)}<div class="wrap"><aside class="side">{side}</aside><main class="main">{sections_html(rest)}{footer}</main></div>')


def topcv_head(doc) -> str:
    css = """header{background:#00803c;color:#fff;padding:22px 34px;display:flex;justify-content:space-between;gap:18px}
    h1{font-size:25px;margin:0;line-height:1.2}.role{font-size:14px}.contact{font-size:12px;max-width:52%}
    main{padding:12px 34px}main h2{color:#00803c;text-transform:uppercase}"""
    name = ''.join(f'<h1>{e(x)}</h1>' for x in doc['name'])
    head = f'<header><div>{name}<div class="role">{e(doc["title"])}</div></div><div class="contact">{rows_html(doc["contact"])}</div></header>'
    return page(css, f'{top_html(doc)}{head}<main>{sections_html(all_sections(doc))}</main>')


def topcv_min(doc) -> str:
    css = """main{padding:34px 50px}h1{font-size:26px;text-align:center;margin:0}.role{text-align:center;color:#555}
    .contact{text-align:center;margin:10px 0 6px;font-size:12px}.contact span+span:before{content:" | ";color:#999}
    h2{border-bottom:1px solid #bbb}.foot{font-size:10px;color:#999;text-align:center;margin-top:24px}"""
    name = ''.join(f'<h1>{e(x)}</h1>' for x in doc['name'])
    spans = ''.join(f'<span>{e(" ".join(row_text(r, "icon")))}</span>' for r in doc['contact'])
    foot = '<p class="foot">Mẫu CV miễn phí - tạo trực tuyến trên nền tảng tuyển dụng</p>'
    return page(css, f'<main>{top_html(doc)}{name}<div class="role">{e(doc["title"])}</div><div class="contact">{spans}</div>{sections_html(all_sections(doc))}{foot}</main>')


def vnw_profile(doc) -> str:
    css = """main{padding:30px 44px}.brand{color:#ff7d55;font-weight:bold;font-size:13px}.label{color:#666;display:inline-block;width:130px}
    h1{font-size:22px;margin:8px 0 0}.role{color:#005aff;font-size:14px;margin-bottom:8px}h2{color:#005aff;border-bottom:1px solid #d0dcff}
    .foot{font-size:10px;color:#888;border-top:1px solid #ccc;margin-top:20px;padding-top:6px}"""
    rng = doc['rng']
    code, day = rng.randint(1000000, 9999999), f'{rng.randint(1, 28):02d}/{rng.randint(1, 10):02d}/2026'
    rows = ''.join(f'<p><span class="label">{e(r.label)}</span> {"<br>".join(e(x) for x in r.value.split(chr(10)))}</p>' for r in doc['contact'])
    name = ''.join(f'<h1>{e(x)}</h1>' for x in doc['name'])
    foot = f'<p class="foot">Mã hồ sơ: {code} - Cập nhật lần cuối: {day} - Hồ sơ trích xuất từ cổng tuyển dụng trực tuyến</p>'
    return page(css, f'<main><p class="brand">HỒ SƠ ỨNG VIÊN</p>{top_html(doc)}{name}<div class="role">{e(doc["title"])}</div><h2>Thông tin liên hệ</h2>{rows}{sections_html(all_sections(doc))}{foot}</main>')


def vnw_en(doc) -> str:
    css = """main{padding:32px 46px}h1{font-size:15px;margin:0;font-weight:normal}.role{color:#005aff;font-size:17px;font-weight:bold;margin:6px 0}
    h2{color:#333;background:#eef2ff;padding:3px 8px}.foot{font-size:10px;color:#888;margin-top:18px}"""
    name = ''.join(f'<h1>Full name: <b>{e(x)}</b></h1>' for x in doc['name'])
    foot = '<p class="foot">Profile exported from an online job portal</p>'
    return page(css, f'<main>{top_html(doc)}<div class="role">{e(doc["title"])}</div>{name}{rows_html(doc["contact"])}{sections_html(all_sections(doc))}{foot}</main>')


HTML_TEMPLATES = dict(topcv_side=topcv_side, topcv_head=topcv_head, topcv_min=topcv_min,
                      vnw_profile=vnw_profile, vnw_en=vnw_en)
__all__ = ['HTML_TEMPLATES', 'ICONS']
