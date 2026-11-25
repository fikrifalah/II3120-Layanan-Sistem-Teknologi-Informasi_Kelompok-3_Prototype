from services.ai_matching.cv_parser import clean_cv

SAMPLE_CV = """Nama: Budi Santoso
Email: budi.santoso@mail.com
No. HP: 0812-3456-7890
Agama: Islam

Pengalaman:
- 2023: Budi membangun toko online fashion dengan React dan Midtrans.
- 2022: Membuat company profile klinik gigi dengan Laravel.
Hubungi saya di budi.s@kerja.id atau +62 812 3456 7890.
Portofolio: https://github.com/budisantoso
NIK 3273012345678901
"""


def test_labeled_lines_removed():
    result = clean_cv(SAMPLE_CV)
    assert "Islam" not in result.text
    assert "Nama" not in result.text
    assert result.removed["baris_label"] == 4


def test_inline_email_phone_url_nik_removed():
    result = clean_cv(SAMPLE_CV)
    assert "@" not in result.text
    assert "812" not in result.text
    assert "github.com" not in result.text
    assert "3273012345678901" not in result.text
    assert result.removed["email"] == 1
    assert result.removed["telepon"] == 1
    assert result.removed["url"] == 1
    assert result.removed["nik"] == 1


def test_known_name_removed_inline():
    result = clean_cv(SAMPLE_CV, known_names=["Budi Santoso"])
    assert "Budi" not in result.text
    assert "membangun toko online fashion" in result.text


def test_professional_content_kept():
    result = clean_cv(SAMPLE_CV, known_names=["Budi Santoso"])
    assert "- 2023: membangun toko online fashion dengan React dan Midtrans." in result.text
    assert "- 2022: Membuat company profile klinik gigi dengan Laravel." in result.text


def test_phone_formats():
    for phone in ["081234567890", "0812-3456-7890", "+6281234567890", "+62 812 3456 7890", "62812.3456.7890"]:
        result = clean_cv(f"Kontak {phone} ya")
        assert result.text == "Kontak ya", phone


def test_years_and_money_not_treated_as_phone():
    text = "Sejak 2019 mengerjakan 12 proyek senilai Rp 85.000.000."
    result = clean_cv(text)
    assert result.text == text
    assert result.removed == {}


def test_text_without_pii_unchanged():
    text = "Membangun aplikasi kasir dengan Next.js."
    result = clean_cv(text)
    assert result.text == text
    assert result.removed == {}