import re
from dataclasses import dataclass, field
from typing import Iterable

# Label baris yang berisi data pribadi / atribut sensitif -> seluruh baris dibuang.
SENSITIVE_LABELS = [
    "nama", "nama lengkap", "alamat", "domisili",
    "email", "e-mail", "telepon", "telp", "no hp", "no. hp", "hp", "whatsapp", "wa",
    "tempat lahir", "tanggal lahir", "tempat, tanggal lahir", "ttl", "usia", "umur",
    "jenis kelamin", "gender", "agama", "status pernikahan", "nik", "no ktp", "ktp",
    "linkedin", "github", "instagram",
]

_labels = sorted(SENSITIVE_LABELS, key=len, reverse=True)
LABEL_LINE = re.compile(
    r"^[ \t]*(?:" + "|".join(re.escape(l) for l in _labels) + r")[ \t]*:.*$",
    re.IGNORECASE | re.MULTILINE,
)
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
URL = re.compile(r"(?:https?://|www\.)\S+|\b(?:linkedin|github|instagram)\.com/\S+", re.IGNORECASE)
NIK = re.compile(r"\b\d{16}\b")
PHONE = re.compile(r"(?:\+62[\s.-]?|\b62|\b0)8\d(?:[\s.-]?\d){7,10}\b")


@dataclass
class CleanResult:
    text: str
    removed: dict[str, int] = field(default_factory=dict)


def clean_cv(text: str, known_names: Iterable[str] = ()) -> CleanResult:
    removed: dict[str, int] = {}

    def remove(pattern: re.Pattern, label: str, s: str) -> str:
        new_s, count = pattern.subn("", s)
        if count:
            removed[label] = removed.get(label, 0) + count
        return new_s

    text = remove(LABEL_LINE, "baris_label", text)
    text = remove(EMAIL, "email", text)
    text = remove(URL, "url", text)
    text = remove(NIK, "nik", text)
    text = remove(PHONE, "telepon", text)
    for name in known_names:
        for token in name.split():
            if len(token) >= 3:
                pattern = re.compile(rf"\b{re.escape(token)}\b", re.IGNORECASE)
                text = remove(pattern, "nama", text)

    return CleanResult(text=_tidy(text), removed=removed)


def _tidy(text: str) -> str:
    lines = [re.sub(r"[ \t]{2,}", " ", line).strip(" \t,;|") for line in text.splitlines()]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()




# ---------------------------------------------------------------- Chunker

SECTION_TYPES = {
    "pengalaman": "experience",
    "pengalaman kerja": "experience",
    "riwayat kerja": "experience",
    "experience": "experience",
    "work experience": "experience",
    "portofolio": "portfolio",
    "portfolio": "portfolio",
    "proyek": "portfolio",
    "project": "portfolio",
    "projects": "portfolio",
    "ringkasan": "other",
    "profil": "other",
    "tentang saya": "other",
    "summary": "other",
    "keahlian": "other",
    "skill": "other",
    "skills": "other",
    "pendidikan": "other",
    "education": "other",
}

_headers = sorted(SECTION_TYPES, key=len, reverse=True)
HEADER = re.compile(
    r"^(" + "|".join(re.escape(h) for h in _headers) + r")[ \t]*(?::[ \t]*(.*))?$",
    re.IGNORECASE,
)
BULLET = re.compile(r"^(?:[-•*]|\d+[.)])\s+")
MIN_CHUNK_CHARS = 15


@dataclass
class Chunk:
    type: str  # "experience" | "portfolio" | "other"
    text: str


def chunk_cv(clean_text: str) -> list[Chunk]:
    chunks: list[Chunk] = []
    section = "other"
    current: list[str] = []

    def flush() -> None:
        text = " ".join(current).strip()
        if len(text) >= MIN_CHUNK_CHARS:
            chunks.append(Chunk(type=section, text=text))
        current.clear()

    for raw_line in clean_text.splitlines():
        line = raw_line.strip()
        if not line:
            flush()
            continue

        header = HEADER.match(line)
        if header:
            flush()
            section = SECTION_TYPES[header.group(1).lower()]
            rest = (header.group(2) or "").strip()
            if rest:
                current.append(rest)
            continue

        bullet = BULLET.match(line)
        if bullet:
            flush()
            current.append(line[bullet.end():])
        else:
            current.append(line)

    flush()
    return chunks