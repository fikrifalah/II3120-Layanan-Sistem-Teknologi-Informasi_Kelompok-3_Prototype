"""Kalibrasi SIM_FLOOR / SIM_CEIL (scoring.py) dari data seed di DATABASE_URL.

Jalankan dari root proyek (butuh data seed di PostgreSQL):
    backend/.venv/Scripts/python backend/services/ai_matching/script/calibrate.py

Cara kerja:
1. 20 contoh job (2 per kategori) dengan target kategori + domain yang diketahui.
2. Setiap job di-embed, lalu retrieval.best_evidence() dihitung ke 300 freelancer (jalur yang sama dengan produksi).
3. Cosine dikelompokkan memakai seed_truth (kunci jawaban):
     cocok   = kategori sama & domain sama
     sebagian= kategori sama, domain beda
     tidak   = kategori beda
4. Usulan: FLOOR = median kelompok "tidak" (CV tak relevan yang khas -> skor 0),
           CEIL  = persentil 90 kelompok "cocok" (CV sangat cocok -> skor 100).
"""
import os
import statistics
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parents[2]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from sqlmodel import Session, select  # noqa: E402

from database import engine  # noqa: E402
from services.ai_matching.db_models import CvChunk, SeedTruth  # noqa: E402
from services.ai_matching.embeddings import EmbeddingClient  # noqa: E402
from services.ai_matching.retrieval import StoredChunk, best_evidence  # noqa: E402

# (kategori, domain, deskripsi job)
JOBS = [
    ("frontend", "e-commerce fashion",
     "Butuh frontend developer untuk membuat tampilan toko online pakaian muslim yang responsif dengan React, "
     "lengkap dengan halaman katalog, filter ukuran, dan keranjang belanja."),
    ("frontend", "pendidikan dan e-learning",
     "Mencari developer frontend untuk membangun antarmuka platform kursus online: halaman materi video, "
     "kuis interaktif, dan dashboard progres siswa."),
    ("backend", "fintech dan pembayaran",
     "Dibutuhkan backend developer untuk membuat REST API layanan pembayaran digital, integrasi payment gateway, "
     "pencatatan transaksi, dan rekonsiliasi saldo."),
    ("backend", "logistik dan pengiriman",
     "Perlu backend developer untuk sistem pelacakan paket: API status pengiriman, manajemen kurir, "
     "dan perhitungan ongkos kirim antar kota."),
    ("fullstack", "marketplace umkm",
     "Cari fullstack developer untuk membangun marketplace produk UMKM lokal dari frontend sampai backend, "
     "termasuk pendaftaran penjual, katalog, dan pembayaran."),
    ("fullstack", "properti dan real estate",
     "Butuh fullstack developer untuk website listing rumah dan apartemen dengan pencarian berdasarkan lokasi, "
     "panel admin agen, dan formulir janji survei."),
    ("mobile", "kesehatan dan klinik",
     "Mencari mobile developer untuk aplikasi Android dan iOS reservasi dokter di klinik, "
     "dengan notifikasi antrean dan riwayat kunjungan pasien."),
    ("mobile", "kuliner dan f&b",
     "Dibutuhkan developer aplikasi mobile untuk pemesanan makanan restoran: menu, keranjang, "
     "pembayaran, dan status pesanan real-time."),
    ("data", "kuliner dan f&b",
     "Butuh data analyst untuk menganalisis data penjualan kedai kopi beberapa cabang, menentukan menu terlaris, "
     "jam ramai, dan membuat dashboard laporan bulanan."),
    ("data", "layanan pemerintah",
     "Mencari analis data untuk mengolah data layanan publik pemerintah daerah dan menyajikan visualisasi "
     "indikator kinerja dalam dashboard."),
    ("ml", "media dan berita",
     "Dibutuhkan machine learning engineer untuk membuat model klasifikasi topik dan ringkasan otomatis "
     "artikel berita berbahasa Indonesia."),
    ("ml", "manufaktur",
     "Perlu engineer machine learning untuk deteksi cacat produk di lini produksi pabrik menggunakan "
     "computer vision dari kamera inspeksi."),
    ("devops", "fintech dan pembayaran",
     "Butuh DevOps engineer untuk menyiapkan infrastruktur cloud aplikasi pembayaran: containerisasi, "
     "pipeline CI/CD, monitoring, dan autoscaling."),
    ("devops", "media dan berita",
     "Mencari DevOps untuk memindahkan server portal berita ke cloud, mengatur load balancer, "
     "dan deployment otomatis agar tahan lonjakan trafik."),
    ("uiux", "kesehatan dan klinik",
     "Dibutuhkan UI/UX designer untuk riset pengguna dan merancang prototipe aplikasi pendaftaran pasien "
     "klinik yang mudah dipakai lansia."),
    ("uiux", "pariwisata dan hotel",
     "Cari UI/UX designer untuk mendesain ulang alur pemesanan kamar hotel dan paket wisata di website, "
     "mulai dari wireframe sampai design system."),
    ("graphic", "kuliner dan f&b",
     "Butuh desainer grafis untuk membuat logo, desain kemasan, dan menu untuk brand kedai kopi baru."),
    ("graphic", "e-commerce fashion",
     "Mencari graphic designer untuk identitas visual brand fashion lokal: logo, banner promo, "
     "dan materi konten Instagram."),
    ("content", "pariwisata dan hotel",
     "Dibutuhkan content writer untuk menulis artikel SEO destinasi wisata dan copywriting promosi hotel, "
     "serta mengelola media sosial."),
    ("content", "pendidikan dan e-learning",
     "Perlu digital marketer untuk kampanye iklan Google Ads dan Meta Ads platform kursus online, "
     "termasuk email marketing dan konten media sosial."),
]


def pct(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(p * len(s)))]


def summary(name: str, values: list[float]) -> str:
    return (f"{name:9s} n={len(values):5d}  p10={pct(values, .10):.3f}  median={statistics.median(values):.3f}  "
            f"p90={pct(values, .90):.3f}  max={max(values):.3f}")


def main() -> None:
    with Session(engine) as session:
        truth = {t.freelancer_id: t for t in session.exec(select(SeedTruth))}
        chunks = [StoredChunk(c.freelancer_id, c.type, c.text, c.embedding)
                  for c in session.exec(select(CvChunk).where(CvChunk.type.in_(["experience", "portfolio"])))]
    print(f"{len(truth)} freelancer, {len(chunks)} potongan experience/portfolio\n")

    vectors = EmbeddingClient().embed([j[2] for j in JOBS])
    groups = {t: {"cocok": [], "sebagian": [], "tidak": []} for t in ("experience", "portfolio")}
    for (cat, domain, _), qvec in zip(JOBS, vectors):
        for fid, per_type in best_evidence(qvec, chunks).items():
            t = truth[fid]
            g = "tidak" if t.category != cat else ("cocok" if t.domain == domain else "sebagian")
            for ctype, ev in per_type.items():
                groups[ctype][g].append(ev.similarity)

    proposals = {}
    for ctype, g in groups.items():
        print(f"== {ctype}")
        for name in ("cocok", "sebagian", "tidak"):
            print("  " + summary(name, g[name]))
        proposals[ctype] = (statistics.median(g["tidak"]), pct(g["cocok"], .90))
        print()

    floor = round(sum(p[0] for p in proposals.values()) / 2, 2)
    ceil = round(sum(p[1] for p in proposals.values()) / 2, 2)
    print(f"USULAN  SIM_FLOOR = {floor}   SIM_CEIL = {ceil}")

    def to_score(sim: float) -> float:
        return 100 * min(max((sim - floor) / (ceil - floor), 0.0), 1.0)

    print("\nmedian skor 0-100 dengan usulan ini:")
    for ctype, g in groups.items():
        print(f"  {ctype:10s}" + "  ".join(f"{n}={statistics.median([to_score(v) for v in g[n]]):5.1f}"
                                           for n in ("cocok", "sebagian", "tidak")))


if __name__ == "__main__":
    main()
