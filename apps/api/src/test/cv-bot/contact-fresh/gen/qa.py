"""Checks the set with an independent text reader (pypdf), not the code under test. No output of that code is used.

  PYTHONPATH=<dir with pypdf> python3 -B qa.py <pdf-dir>

Every labelled value must be readable in the PDF text, unless the record says the text is broken on purpose.
"""
import json
import pathlib
import re
import sys
import unicodedata

from pypdf import PdfReader

HERE = pathlib.Path(__file__).resolve().parent


def squeeze(text: str) -> str:
    return re.sub(r'\s+', '', unicodedata.normalize('NFC', text)).casefold()


def digits(text: str) -> str:
    return re.sub(r'\D', '', text)


def problems_of(label: dict, text: str) -> list:
    out = []
    flat = squeeze(text)
    if label['fullName'] and squeeze(label['fullName']) not in flat:
        out.append(f'name {label["fullName"]}')
    if label['email'] and squeeze(label['email']) not in flat:
        out.append(f'email {label["email"]}')
    phone = label['phone']
    if phone and phone not in digits(text) and f'84{phone[1:]}' not in digits(text):
        out.append(f'phone {phone}')
    return out


def main(pdf_dir: str):
    labels = json.loads((HERE.parent / 'labels.json').read_text(encoding='utf-8'))
    bad, pages = 0, 0
    for label in labels:
        reader = PdfReader(pathlib.Path(pdf_dir) / label['file'])
        pages += len(reader.pages)
        problems = problems_of(label, '\n'.join(p.extract_text() for p in reader.pages))
        if problems:
            bad += 1
            print(label['id'], label['template'], problems)
    print(f'{len(labels)} files, {pages} pages, {bad} with a labelled value not readable')


if __name__ == '__main__':
    main(sys.argv[1])
