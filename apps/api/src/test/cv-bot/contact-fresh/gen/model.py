"""One fictional CV: the labels, written literally, plus how the document shows them."""
from dataclasses import dataclass, field, replace
from typing import Optional


@dataclass(frozen=True)
class Record:
    id: str
    template: str
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    profile: str
    group: str = ''
    family: str = ''
    ns: Optional[str] = None
    pf: Optional[str] = None
    es: Optional[str] = None
    top: tuple = ()
    contact_before: tuple = ()
    contact_add: tuple = ()
    pre: tuple = ()
    post: tuple = ()
    body_lines: tuple = ()
    contact_end: bool = False
    refs_first: bool = False
    title_first: bool = False
    name_low: bool = False
    name_at: Optional[str] = None
    name_lines: tuple = ()
    name_shown: Optional[str] = None
    phone_shown: Optional[str] = None
    email_shown: Optional[str] = None
    email_lines: tuple = ()
    phone_lines: tuple = ()
    image_name: Optional[str] = None
    intro: Optional[str] = None
    ambiguous: dict = field(default_factory=dict)

    def tag(self, group: str, family: str) -> 'Record':
        return replace(self, group=group, family=family)


def R(id_, template, name, phone, email, profile, **options) -> Record:
    tuple_fields = {'top', 'contact_before', 'contact_add', 'pre', 'post', 'body_lines', 'name_lines',
                    'email_lines', 'phone_lines'}
    cleaned = {k: tuple(v) if k in tuple_fields else v for k, v in options.items()}
    return Record(id_, template, name, phone, email, profile, **cleaned)
