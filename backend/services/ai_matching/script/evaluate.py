"""Evaluasi AI Matching: akurasi (Precision@5, NDCG@5), konsistensi, dan pembanding.

Jalankan dari root proyek (butuh data seed S3 di database pada DATABASE_URL):
    backend/.venv/Scripts/python backend/services/ai_matching/script/evaluate.py
    backend/.venv/Scripts/python backend/services/ai_matching/script/evaluate.py --runs 1   # tanpa uji konsistensi

- 20 job EVALUASI (berbeda dari 20 job kalibrasi di calibrate.py, agar tidak "menyontek").
- Dijalankan pada schema PostgreSQL sementara dari DATABASE_URL; database sumber tidak berubah.
- Kunci jawaban dari seed_truth. Relevansi kandidat terhadap job:
      2 = kategori sama & domain sama, 1 = kategori sama, 0 = kategori beda.
- Budget job dibuat longgar agar yang diuji adalah RANKING, bukan filter budget.
- Metode yang dibandingkan:
      keyword   : irisan kata job vs kata CV (tanpa AI)
      skill     : skill_score saja (skill job hasil LLM vs skill CV)
      embedding : rata-rata cosine bukti experience & portfolio saja
      hybrid    : service.recommend() lengkap (sistem kita)
"""
import argparse
from contextlib import contextmanager
import math
import os
import re
import statistics
import sys
import uuid
from pathlib import Path
from typing import Iterator

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parents[2]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import create_engine, func, inspect, select, text  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402
from sqlmodel import Session, SQLModel, select  # noqa: E402

import main  # noqa: F401, E402  (mendaftarkan seluruh model untuk snapshot evaluasi)
from database import engine as source_engine, init_db  # noqa: E402
from models import Job  # noqa: E402
from services.ai_matching.db_models import CvChunk, FreelancerProfile, SeedTruth  # noqa: E402
from services.ai_matching.embeddings import EmbeddingClient  # noqa: E402
from services.ai_matching.llm import LLMClient  # noqa: E402
from services.ai_matching.retrieval import SCORED_TYPES, StoredChunk, best_evidence  # noqa: E402
from services.ai_matching.scoring import skill_score  # noqa: E402
from services.ai_matching.service import recommend  # noqa: E402

K = 5
EVAL_BUDGET = 50_000_000  # longgar: semua freelancer lolos filter budget
CLIENT_ID = 1


def snapshot_database(source: Engine, destination: Engine) -> None:
    SQLModel.metadata.create_all(destination)
    source_tables = set(inspect(source).get_table_names())
    missing = [table.name for table in SQLModel.metadata.sorted_tables if table.name not in source_tables]
    if missing:
        raise RuntimeError(
            "Database belum memiliki tabel untuk evaluasi: "
            + ", ".join(missing)
            + ". Jalankan migrasi Alembic terlebih dahulu."
        )

    with source.connect() as source_connection, destination.begin() as destination_connection:
        for table in SQLModel.metadata.sorted_tables:
            rows = source_connection.execute(table.select()).mappings().all()
            if rows:
                destination_connection.execute(table.insert(), [dict(row) for row in rows])
            primary_key = list(table.primary_key.columns)
            if len(primary_key) == 1:
                column = primary_key[0]
                sequence = destination_connection.execute(
                    text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                    {"table_name": table.name, "column_name": column.name},
                ).scalar_one_or_none()
                if sequence:
                    maximum = destination_connection.execute(select(func.max(column))).scalar_one()
                    if maximum is not None:
                        destination_connection.execute(
                            text("SELECT setval(CAST(:sequence AS regclass), :value, true)"),
                            {"sequence": sequence, "value": maximum},
                        )


@contextmanager
def temporary_snapshot_engine(source: Engine) -> Iterator[Engine]:
    if source.dialect.name != "postgresql":
        raise ValueError("AI evaluation snapshots require PostgreSQL")

    schema = f"evaluation_{uuid.uuid4().hex}"
    with source.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))

    destination = None
    try:
        destination = create_engine(
            source.url,
            connect_args={"options": f"-csearch_path={schema}"},
            pool_pre_ping=True,
        )
        snapshot_database(source, destination)
        yield destination
    finally:
        if destination is not None:
            destination.dispose()
        with source.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))


# (kategori, domain, judul, deskripsi) - ditulis seperti client sungguhan, sebagian tanpa istilah teknis.
EVAL_JOBS = [
    ("frontend", "pariwisata dan hotel", "Website pemesanan villa",
     "Kami punya 5 villa di Bali dan ingin tampilan website pemesanan yang cantik dan cepat di HP, ada kalender ketersediaan dan galeri foto."),
    ("frontend", "marketplace umkm", "Perbaikan tampilan toko online",
     "Tampilan web marketplace kami berantakan di layar kecil. Butuh developer frontend untuk merapikan halaman produk dan checkout memakai React."),
    ("backend", "kesehatan dan klinik", "API rekam medis",
     "Butuh backend developer untuk membuat API rekam medis elektronik klinik dengan database yang aman dan hak akses dokter."),
    ("backend", "e-commerce fashion", "Server untuk toko online baju",
     "Toko baju online kami butuh sistem di belakang layar: stok barang, pesanan, dan integrasi ongkir otomatis."),
    ("fullstack", "pendidikan dan e-learning", "Platform bimbel online",
     "Kami bimbel kecil yang ingin punya platform belajar online lengkap: login siswa, video materi, tryout, dan panel admin guru."),
    ("fullstack", "logistik dan pengiriman", "Aplikasi web manajemen armada",
     "Butuh fullstack developer untuk sistem manajemen armada truk: jadwal pengiriman, pelacakan, dan laporan untuk admin."),
    ("mobile", "e-commerce fashion", "Aplikasi belanja fashion",
     "Kami ingin aplikasi HP untuk toko fashion kami supaya pelanggan bisa belanja, lihat promo, dan dapat notifikasi diskon."),
    ("mobile", "fintech dan pembayaran", "Aplikasi dompet digital koperasi",
     "Butuh developer Flutter untuk aplikasi simpan pinjam koperasi: cek saldo, transfer antar anggota, dan riwayat transaksi."),
    ("data", "marketplace umkm", "Analisis penjualan marketplace",
     "Kami punya data transaksi marketplace setahun di Excel dan ingin tahu produk paling laku, tren musiman, dan dibuatkan dashboard."),
    ("data", "kesehatan dan klinik", "Dashboard kunjungan pasien",
     "Butuh analis data untuk mengolah data kunjungan pasien klinik dan menampilkan laporan bulanan dalam Power BI."),
    ("ml", "e-commerce fashion", "Rekomendasi produk otomatis",
     "Kami ingin sistem yang bisa merekomendasikan produk fashion ke pelanggan berdasarkan riwayat belanja mereka."),
    ("ml", "layanan pemerintah", "Klasifikasi aduan masyarakat",
     "Butuh model machine learning untuk mengelompokkan ribuan aduan masyarakat berbahasa Indonesia ke dinas yang tepat secara otomatis."),
    ("devops", "marketplace umkm", "Server marketplace sering down",
     "Website marketplace kami sering mati saat ramai. Butuh orang yang bisa memindahkan server ke cloud dan membuat deployment otomatis."),
    ("devops", "kesehatan dan klinik", "Infrastruktur aplikasi klinik",
     "Butuh DevOps engineer untuk menyiapkan Docker, Kubernetes, dan backup rutin untuk sistem informasi beberapa cabang klinik."),
    ("uiux", "fintech dan pembayaran", "Desain ulang aplikasi pembayaran",
     "Pengguna aplikasi pembayaran kami sering bingung saat transfer. Butuh UI/UX designer untuk riset pengguna dan desain ulang alurnya di Figma."),
    ("uiux", "pendidikan dan e-learning", "Desain aplikasi belajar anak",
     "Kami butuh desainer untuk merancang tampilan aplikasi belajar anak SD yang ramah dan mudah dipakai, mulai dari wireframe sampai prototipe."),
    ("graphic", "pariwisata dan hotel", "Branding hotel butik",
     "Hotel butik kami butuh identitas visual baru: logo, kartu nama, papan nama, dan materi promosi cetak."),
    ("graphic", "marketplace umkm", "Desain kemasan produk UMKM",
     "Butuh desainer grafis untuk membuat kemasan dan label produk keripik UMKM agar menarik di rak toko."),
    ("content", "kuliner dan f&b", "Konten media sosial restoran",
     "Restoran kami butuh orang yang mengelola Instagram dan TikTok, menulis caption menarik, dan menjalankan iklan berbayar."),
    ("content", "fintech dan pembayaran", "Artikel SEO aplikasi keuangan",
     "Kami perlu penulis artikel SEO tentang literasi keuangan dan copywriting untuk landing page aplikasi pinjaman."),
]

STOPWORDS = set("""yang dan untuk dengan kami ingin butuh perlu bisa dari agar supaya saat atau pada dalam
ini itu ada akan sudah juga oleh sebagai secara mereka lebih para orang punya dapat membuat buat""".split())


def tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9.+#/-]{3,}", text.lower()) if w not in STOPWORDS}


def relevance(truth: SeedTruth, cat: str, domain: str) -> int:
    if truth.category != cat:
        return 0
    return 2 if truth.domain == domain else 1


def ndcg(rels: list[int], all_rels: list[int], k: int = K) -> float:
    dcg = sum((2 ** r - 1) / math.log2(i + 2) for i, r in enumerate(rels[:k]))
    ideal = sorted(all_rels, reverse=True)[:k]
    idcg = sum((2 ** r - 1) / math.log2(i + 2) for i, r in enumerate(ideal))
    return dcg / idcg if idcg else 0.0


def rank(scores: dict[int, float], k: int = K) -> list[int]:
    return [fid for fid, _ in sorted(scores.items(), key=lambda x: (-x[1], x[0]))[:k]]


def run_evaluation(evaluation_engine: Engine, runs: int, llm: LLMClient, emb: EmbeddingClient) -> None:
    with Session(evaluation_engine) as session:
        truth = {t.freelancer_id: t for t in session.exec(select(SeedTruth))}
        cv_tokens = {p.freelancer_id: tokens(p.cv_text) for p in session.exec(select(FreelancerProfile))}
        cv_skills = {p.freelancer_id: p.skills for p in session.exec(select(FreelancerProfile))}
        chunks = [StoredChunk(c.freelancer_id, c.type, c.text, c.embedding)
                  for c in session.exec(select(CvChunk).where(CvChunk.type.in_(SCORED_TYPES)))]
        job_ids = []
        for cat, domain, title, desc in EVAL_JOBS:
            job = Job(client_id=CLIENT_ID, title=title, description=desc, budget=EVAL_BUDGET)
            session.add(job)
            session.flush()
            job_ids.append(job.id)
        session.commit()

        methods = {m: {"p": [], "ndcg": []} for m in ("keyword", "skill", "embedding", "hybrid")}
        identical = 0
        overlaps = []
        print(f"{'job':38s} {'kw':>4s} {'skill':>5s} {'emb':>4s} {'hyb':>4s}  P@5 hybrid (kategori top-5)")
        query_vecs = emb.embed([f"{t}\n{d}" for _, _, t, d in EVAL_JOBS])
        for (cat, domain, title, desc), job_id, qvec in zip(EVAL_JOBS, job_ids, query_vecs):
            rel = {fid: relevance(t, cat, domain) for fid, t in truth.items()}
            all_rels = list(rel.values())

            results = [recommend(session, job_id, top_k=K, with_reasons=False, llm=llm, emb=emb)
                       for _ in range(runs)]
            tops = [[c.freelancer_id for c in r.candidates] for r in results]
            identical += all(t == tops[0] for t in tops)
            overlaps += [len(set(tops[0]) & set(t)) / K for t in tops[1:]]

            job_tokens = tokens(f"{title} {desc}")
            ev = best_evidence(qvec, chunks)
            rankings = {
                "keyword": rank({f: len(job_tokens & cv_tokens[f]) / max(len(job_tokens), 1) for f in truth}),
                "skill": rank({f: skill_score(results[0].job_skills, [], cv_skills[f])[0] or 0.0 for f in truth}),
                "embedding": rank({f: statistics.mean(e.similarity for e in ev.get(f, {}).values())
                                   if ev.get(f) else 0.0 for f in truth}),
                "hybrid": tops[0],
            }
            line = []
            for m, top in rankings.items():
                rels = [rel[f] for f in top]
                methods[m]["p"].append(sum(r > 0 for r in rels) / K)
                methods[m]["ndcg"].append(ndcg(rels, all_rels))
                line.append(f"{methods[m]['p'][-1]:.1f}")
            cats = ",".join(truth[f].category[:4] for f in tops[0])
            print(f"{cat + ' | ' + title:38.38s} {line[0]:>4s} {line[1]:>5s} {line[2]:>4s} {line[3]:>4s}  {cats}"
                  f"   skill job={results[0].job_skills}")

    print("\n== RINGKASAN (rata-rata 20 job)")
    print(f"{'metode':10s} {'Precision@5':>12s} {'NDCG@5':>8s}")
    for m, v in methods.items():
        print(f"{m:10s} {statistics.mean(v['p']):12.2f} {statistics.mean(v['ndcg']):8.2f}")
    if runs > 1:
        print(f"\n== KONSISTENSI hybrid ({runs}x per job)")
        print(f"top-5 identik (urutan sama): {identical}/{len(EVAL_JOBS)} job")
        print(f"rata-rata irisan top-5 antar run: {statistics.mean(overlaps):.0%}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3, help="berapa kali hybrid diulang (uji konsistensi)")
    args = parser.parse_args()

    init_db()
    llm, emb = LLMClient(), EmbeddingClient()
    with temporary_snapshot_engine(source_engine) as evaluation_engine:
        run_evaluation(evaluation_engine, args.runs, llm, emb)


if __name__ == "__main__":
    main()
