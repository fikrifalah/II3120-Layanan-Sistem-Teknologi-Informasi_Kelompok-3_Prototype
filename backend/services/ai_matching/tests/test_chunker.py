from services.ai_matching.cv_parser import Chunk, chunk_cv, clean_cv

CV = """Ringkasan:
Web developer yang fokus di e-commerce.

Pengalaman:
- 2023: Membangun toko online fashion dengan React dan Midtrans.
- 2022: Membuat company profile klinik gigi dengan Laravel.

Portofolio:
1. Aplikasi kasir (POS) untuk minimarket dengan Next.js.
2. Dashboard penjualan dengan Python dan Streamlit.

Keahlian:
React, Next.js, Laravel, Python
"""


def test_bullets_become_typed_chunks():
    chunks = chunk_cv(CV)
    experience = [c.text for c in chunks if c.type == "experience"]
    portfolio = [c.text for c in chunks if c.type == "portfolio"]
    assert experience == [
        "2023: Membangun toko online fashion dengan React dan Midtrans.",
        "2022: Membuat company profile klinik gigi dengan Laravel.",
    ]
    assert portfolio == [
        "Aplikasi kasir (POS) untuk minimarket dengan Next.js.",
        "Dashboard penjualan dengan Python dan Streamlit.",
    ]


def test_text_outside_known_sections_is_other():
    chunks = chunk_cv(CV)
    other = [c.text for c in chunks if c.type == "other"]
    assert "Web developer yang fokus di e-commerce." in other
    assert "React, Next.js, Laravel, Python" in other


def test_header_with_inline_content():
    chunks = chunk_cv("Proyek: Sistem reservasi hotel dengan Django.")
    assert chunks == [Chunk(type="portfolio", text="Sistem reservasi hotel dengan Django.")]


def test_paragraph_without_bullets_is_one_chunk():
    text = "PENGALAMAN KERJA\nMengembangkan aplikasi logistik\nuntuk perusahaan ekspedisi."
    assert chunk_cv(text) == [
        Chunk(type="experience", text="Mengembangkan aplikasi logistik untuk perusahaan ekspedisi.")
    ]


def test_header_word_inside_sentence_is_not_header():
    chunks = chunk_cv("Pengalaman saya membangun API dengan FastAPI.")
    assert chunks == [Chunk(type="other", text="Pengalaman saya membangun API dengan FastAPI.")]


def test_short_fragments_dropped():
    chunks = chunk_cv("Pengalaman:\n- OK\n- Membangun chatbot dengan Python.")
    assert [c.text for c in chunks] == ["Membangun chatbot dengan Python."]


def test_empty_text():
    assert chunk_cv("") == []


def test_clean_then_chunk_has_no_pii():
    raw = "Nama: Budi Santoso\nNo. HP: 0812-3456-7890\n\nPengalaman:\n- Budi membangun toko online dengan React."
    cleaned = clean_cv(raw, known_names=["Budi Santoso"]).text
    chunks = chunk_cv(cleaned)
    assert chunks == [Chunk(type="experience", text="membangun toko online dengan React.")]