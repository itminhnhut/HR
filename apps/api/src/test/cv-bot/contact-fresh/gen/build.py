"""Builds the fresh CV set and its labels. Run with system python3 (reportlab, PIL) and Google Chrome.

  python3 -B build.py <scratch-dir>

PDFs are written to <scratch-dir>/pdfs (generated outside the repo), labels.json next to this folder's parent.
Copy the PDFs to ../pdfs (git-ignored) afterwards.
"""
import json
import pathlib
import re
import shutil
import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from content import build_doc
from records_hard import HARD
from records_ordinary import ORDINARY
from render_html import HTML_TEMPLATES
from render_pdf import PDF_TEMPLATES, render_pdf

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
HERE = pathlib.Path(__file__).resolve().parent
MOBILE = re.compile(r'^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9\d)\d{7}$')


def check_records(records):
    ids = [r.id for r in records]
    assert len(set(ids)) == len(ids), 'duplicate ids'
    phones = [r.phone for r in records if r.phone]
    assert len(set(phones)) == len(phones), [p for p, n in Counter(phones).items() if n > 1]
    emails = [r.email for r in records if r.email]
    assert len(set(emails)) == len(emails), [p for p, n in Counter(emails).items() if n > 1]
    for r in records:
        assert r.template in HTML_TEMPLATES or r.template in PDF_TEMPLATES, r.template
        assert r.phone is None or MOBILE.match(r.phone), f'{r.id} phone {r.phone}'
        assert r.email is None or (r.email == r.email.lower() and '@' in r.email), f'{r.id} email'
        assert r.name is None or r.name == r.name.strip(), f'{r.id} name'


def render_html(r, doc, work: pathlib.Path, out: pathlib.Path):
    source = work / f'{r.id}.html'
    source.write_text(HTML_TEMPLATES[r.template](doc), encoding='utf-8')
    profile = work / f'profile-{r.id}'
    subprocess.run(
        [CHROME, '--headless=new', '--disable-gpu', '--no-first-run', '--no-pdf-header-footer',
         f'--user-data-dir={profile}', f'--print-to-pdf={out}', source.as_uri()],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120,
    )
    shutil.rmtree(profile, ignore_errors=True)


def label_of(r):
    entry = dict(id=r.id, file=f'{r.id}.pdf', group=r.group, family=r.family, template=r.template,
                 fullName=r.name, phone=r.phone, email=r.email)
    return {**entry, 'ambiguous': r.ambiguous} if r.ambiguous else {**entry, 'ambiguous': {}}


def main(scratch: str):
    records = [*ORDINARY, *HARD]
    check_records(records)
    pdfs = pathlib.Path(scratch) / 'pdfs'
    work = pathlib.Path(scratch) / 'html'
    pdfs.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    web_jobs = []
    for r in records:
        out = pdfs / f'{r.id}.pdf'
        doc = build_doc(r, default_upper=r.template not in ('vnw_profile', 'word_cv'))
        if r.template in HTML_TEMPLATES:
            web_jobs.append((r, doc, work, out))
        else:
            render_pdf(doc, r.template, str(out))
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(lambda job: render_html(*job), web_jobs))
    labels = [label_of(r) for r in records]
    (HERE.parent / 'labels.json').write_text(json.dumps(labels, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(len(records), Counter(r.group for r in records), Counter(r.family for r in records))


if __name__ == '__main__':
    main(sys.argv[1])
