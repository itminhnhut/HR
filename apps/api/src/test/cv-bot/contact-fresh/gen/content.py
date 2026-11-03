"""Turns a Record into a template-neutral document: rows, sections, name lines."""
import random
import unicodedata
from dataclasses import dataclass

from pool import ACTIVITIES, ADDRESSES, ADDRESSES_EN, CERTS, COMPANIES, COMPANIES_EN, HOBBIES, PROFILES, SCHOOLS

NFD_IDS = {'o094', 'o106', 'o112'}

PHONE_FORMATS = {
    '433': lambda d: f'{d[:4]} {d[4:7]} {d[7:]}',
    '334': lambda d: f'{d[:3]} {d[3:6]} {d[6:]}',
    'plain': lambda d: d,
    'dot': lambda d: f'{d[:4]}.{d[4:7]}.{d[7:]}',
    '3dot': lambda d: f'{d[:3]}.{d[3:6]}.{d[6:]}',
    'dash': lambda d: f'{d[:4]}-{d[4:7]}-{d[7:]}',
    '323': lambda d: f'{d[:3]} {d[3:5]} {d[5:7]} {d[7:]}',
    '84sp': lambda d: f'+84 {d[1:4]} {d[4:7]} {d[7:]}',
    '84par': lambda d: f'(+84) {d[1:4]} {d[4:7]} {d[7:]}',
    '84plain': lambda d: f'+84{d[1:]}',
    '84noplus': lambda d: f'84{d[1:]}',
}
DEFAULT_FORMATS = ['433', '433', '433', '433', '334', 'plain', 'plain', 'dot']

PHONE_LABELS = ['Điện thoại', 'Điện thoại', 'SĐT', 'SĐT', 'Số điện thoại', 'ĐT', 'Di động', 'SĐT/Zalo', 'Phone']
PHONE_LABELS_EN = ['Phone', 'Phone', 'Mobile', 'Tel', 'Cell']
EMAIL_LABELS = ['Email', 'Email', 'Email', 'E-mail', 'Mail', 'Gmail']
ICONS = {'phone': '☎', 'email': '✉', 'addr': '⌂', 'dob': '●', 'gender': '●', 'link': '●', 'other': '●'}

HEADINGS = {
    'objective': ('Mục tiêu nghề nghiệp', 'Career objective'),
    'edu': ('Học vấn', 'Education'),
    'exp': ('Kinh nghiệm làm việc', 'Work experience'),
    'skills': ('Kỹ năng', 'Skills'),
    'certs': ('Chứng chỉ và giải thưởng', 'Certificates'),
    'activities': ('Hoạt động', 'Activities'),
    'hobbies': ('Sở thích', 'Interests'),
}


@dataclass(frozen=True)
class Row:
    kind: str
    label: str
    value: str


def ascii_slug(text: str) -> str:
    bare = unicodedata.normalize('NFD', text.replace('đ', 'd').replace('Đ', 'D'))
    return ''.join(c for c in bare if not unicodedata.combining(c)).lower().replace(' ', '.').replace("'", '')


def shown_email(r, rng) -> str:
    if r.email_lines:
        return '\n'.join(r.email_lines)
    if r.email_shown:
        return r.email_shown
    local, domain = r.email.split('@')
    if r.es == 'C':
        return f'{".".join(p.capitalize() for p in local.split("."))}@{domain.capitalize()}'
    if r.es == 'U':
        return r.email.upper()
    return r.email


def shown_phone(r, rng) -> str:
    if r.phone_lines:
        return '\n'.join(r.phone_lines)
    if r.phone_shown:
        return r.phone_shown
    return PHONE_FORMATS[r.pf or rng.choice(DEFAULT_FORMATS)](r.phone)


def own_rows(r, rng, en) -> list:
    rows = []
    if r.phone:
        rows.append(Row('phone', rng.choice(PHONE_LABELS_EN if en else PHONE_LABELS), shown_phone(r, rng)))
    if r.email:
        rows.append(Row('email', rng.choice(EMAIL_LABELS), shown_email(r, rng)))
    return list(reversed(rows)) if rng.random() < 0.3 else rows


def info_rows(r, rng, en) -> list:
    dob = f'{rng.randint(1, 28):02d}/{rng.randint(1, 12):02d}/{rng.randint(1984, 2003)}'
    rows = [Row('dob', 'Date of birth' if en else 'Ngày sinh', dob)]
    if rng.random() < 0.3:
        rows.append(Row('gender', 'Gender' if en else 'Giới tính', rng.choice(['Nam', 'Nữ'])))
    rows.append(Row('addr', 'Address' if en else 'Địa chỉ', rng.choice(ADDRESSES_EN if en else ADDRESSES)))
    if r.name and rng.random() < 0.15:
        rows.append(Row('link', 'LinkedIn', f'linkedin.com/in/{ascii_slug(r.name)}'))
    elif r.name and rng.random() < 0.15:
        rows.append(Row('link', 'Facebook', f'facebook.com/{ascii_slug(r.name)}'))
    return rows


def experience(r, rng, prof, en) -> list:
    companies = rng.sample(COMPANIES_EN if en else COMPANIES, 2)
    end = rng.randint(2022, 2026)
    start_a, start_b = end - rng.randint(1, 3), end - rng.randint(4, 6)
    until = 'present' if en else 'nay'
    lines = [*r.body_lines]
    spans = [f'{rng.randint(1, 12):02d}/{start_a} - {until}', f'{rng.randint(1, 12):02d}/{start_b} - {rng.randint(1, 12):02d}/{start_a}']
    for span, company, role in zip(spans, companies, prof['roles']):
        lines.append(f'{span}  {role} - {company}')
        lines.extend(f'- {duty}' for duty in rng.sample(prof['duties'], 2))
    return lines


def education(rng, prof, en) -> list:
    year = rng.randint(2008, 2022)
    gpa = f'{rng.randint(65, 92) / 10 / 10 * 4:.2f}'
    school = SCHOOLS[prof['school']]
    if en:
        return [f'{year} - {year + 4}  {prof["major"]}, {school}', f'GPA: {gpa}/4.0']
    return [f'{year} - {year + 4}  {school}, ngành {prof["major"]}', f'Điểm trung bình: {gpa}/4.0']


def body_sections(r, rng, prof, en) -> list:
    i = 1 if en else 0
    objective = r.intro or prof['obj']
    sections = [(HEADINGS['objective'][i], [objective])]
    if r.name_at == 'objective':
        sections.append(('Thông tin ứng viên', [f'Họ và tên: {r.name}']))
    sections.append((HEADINGS['edu'][i], education(rng, prof, en)))
    sections.append((HEADINGS['exp'][i], experience(r, rng, prof, en)))
    sections.append((HEADINGS['skills'][i], [f'- {s}' for s in prof['skills']]))
    if not en and rng.random() < 0.5:
        sections.append((HEADINGS['certs'][i], rng.sample(CERTS, 2)))
    if not en and rng.random() < 0.4:
        sections.append((HEADINGS['activities'][i], rng.sample(ACTIVITIES, 2)))
    if not en and rng.random() < 0.3:
        sections.append((HEADINGS['hobbies'][i], [rng.choice(HOBBIES)]))
    if r.name_at == 'signature':
        sections.append(('Lời cam đoan', ['Tôi xin cam đoan những lời khai trên là đúng sự thật.', 'Người khai', r.name]))
    return sections


def name_lines(r, rng, default_upper: bool) -> list:
    if r.name_at or not r.name:
        return []
    if r.name_lines:
        return list(r.name_lines)
    if r.name_shown:
        return [r.name_shown]
    style = r.ns or ('U' if default_upper else 'T')
    return [r.name.upper() if style == 'U' else r.name]


def build_doc(r, default_upper: bool = True) -> dict:
    rng = random.Random(f'fresh-{r.id}')
    prof = PROFILES[r.profile]
    en = bool(prof.get('en'))
    contact = [
        *[Row('other', label, value) for label, value in r.contact_before],
        *own_rows(r, rng, en),
        *info_rows(r, rng, en),
        *[Row('other', label, value) for label, value in r.contact_add],
    ]
    doc = dict(
        id=r.id, en=en, top=list(r.top), name=name_lines(r, rng, default_upper), title=prof['title'],
        contact=contact, pre=[(h, list(ls)) for h, ls in r.pre], sections=body_sections(r, rng, prof, en),
        post=[(h, list(ls)) for h, ls in r.post], contact_end=r.contact_end, refs_first=r.refs_first,
        title_first=r.title_first, name_low=r.name_low, image_name=r.image_name, rng=rng,
        full_name_for_form=None if r.name_at else r.name,
        nfd=r.id in NFD_IDS,
    )
    return normalise(doc) if doc['nfd'] else doc


def _nfd(text: str) -> str:
    return unicodedata.normalize('NFD', text)


def normalise(doc: dict) -> dict:
    """A few files carry decomposed Vietnamese, as some Mac exports do."""
    return {
        **doc,
        'top': [_nfd(x) for x in doc['top']],
        'name': [_nfd(x) for x in doc['name']],
        'title': _nfd(doc['title']),
        'contact': [Row(x.kind, _nfd(x.label), _nfd(x.value)) for x in doc['contact']],
        'pre': [(_nfd(h), [_nfd(x) for x in ls]) for h, ls in doc['pre']],
        'sections': [(_nfd(h), [_nfd(x) for x in ls]) for h, ls in doc['sections']],
        'post': [(_nfd(h), [_nfd(x) for x in ls]) for h, ls in doc['post']],
    }


def row_text(row: Row, mode: str = 'label') -> list:
    """Printed lines for one contact row; a value may hold a forced line break."""
    parts = row.value.split('\n')
    if mode == 'bare':
        return parts
    if mode == 'icon':
        return [f'{ICONS[row.kind]} {parts[0]}', *parts[1:]]
    return [f'{row.label}: {parts[0]}', *parts[1:]]
