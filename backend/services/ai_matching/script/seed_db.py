"""Memasukkan data seed ke database yang dikonfigurasi lewat DATABASE_URL.

Jalankan dari root proyek:
    backend/.venv/Scripts/python backend/services/ai_matching/script/seed_db.py
    backend/.venv/Scripts/python backend/services/ai_matching/script/seed_db.py --limit 5   # coba sedikit dulu

1. Client     (seed_data/clients.json)     -> `user` (role client) + `client_profile`.
2. Freelancer (seed_data/freelancers.json) -> alur indexing:
       clean_cv -> extract_skills (LLM) -> chunk_cv -> embed
       -> `user` (role freelancer) + `freelancer_profile` + `cv_chunk` + `seed_truth`.
Tabel `job` (proyek client) sengaja dibiarkan kosong; diisi saat demo.

Aman dijalankan berulang: akun yang email-nya sudah ada dilewati. Freelancer disimpan per batch,
jadi kalau terputus cukup jalankan ulang.
"""
import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parents[2]
sys.path.insert(0, str(BACKEND_DIR))

from sqlmodel import Session, func, select  # noqa: E402

from database import engine, init_db  # noqa: E402
from models import Job, User  # noqa: E402
from services.ai_matching.cv_parser import chunk_cv, clean_cv  # noqa: E402
from services.ai_matching.db_models import ClientProfile, CvChunk, FreelancerProfile, SeedTruth  # noqa: E402
from services.ai_matching.embeddings import EmbeddingClient  # noqa: E402
from services.ai_matching.llm import LLMClient, LLMError, extract_skills  # noqa: E402

DATA_DIR = SCRIPT_DIR / "seed_data"
CLIENTS_PATH = DATA_DIR / "clients.json"
FREELANCERS_PATH = DATA_DIR / "freelancers.json"
TRUTH_PATH = DATA_DIR / "seed_truth.json"
BATCH = 20  # freelancer per batch (1x embed + 1x commit per batch)
LLM_WORKERS = 8  # panggilan extract_skills paralel
LLM_RETRIES = 3


def load_json(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))


def email_exists(session: Session, email: str) -> bool:
    return session.exec(select(User).where(User.email == email)).first() is not None


# ------------------------------------------------------------------ client

def load_clients(session: Session) -> tuple[int, int]:
    added = skipped = 0
    for c in load_json(CLIENTS_PATH):
        if email_exists(session, c["email"]):
            skipped += 1
            continue
        user = User(name=c["name"], email=c["email"], password=c["password"], role=c["role"])
        session.add(user)
        session.flush()  # mengisi user.id dari database (bisa beda dengan id di JSON)
        session.add(ClientProfile(client_id=user.id, company=c["company"], industry=c["industry"],
                                  aboutme=c["aboutme"]))
        added += 1
    session.commit()
    return added, skipped


# ------------------------------------------------------------------ freelancer

def prepare(account: dict, llm: LLMClient) -> dict:
    """Langkah tanpa database: bersihkan CV, ekstrak skill, potong."""
    clean = clean_cv(account["aboutme"], known_names=[account["name"]]).text
    for attempt in range(LLM_RETRIES):
        try:
            skills = extract_skills(llm, clean)
            break
        except LLMError:
            if attempt == LLM_RETRIES - 1:
                raise
    return {"account": account, "clean": clean, "skills": skills, "chunks": chunk_cv(clean)}


def save_freelancer(session: Session, item: dict, vectors: list[list[float]], truth: dict, model: str) -> None:
    a = item["account"]
    user = User(name=a["name"], email=a["email"], password=a["password"], role=a["role"])
    session.add(user)
    session.flush()
    session.add(FreelancerProfile(freelancer_id=user.id, cv_text=item["clean"],
                                  skills=",".join(item["skills"]), rate=a["rate"]))
    for chunk, vec in zip(item["chunks"], vectors):
        session.add(CvChunk(freelancer_id=user.id, type=chunk.type, text=chunk.text, embedding=vec, model=model))
    session.add(SeedTruth(freelancer_id=user.id, category=truth["category"], domain=truth["domain"],
                          skills=",".join(truth["skills"])))


def load_freelancers(session: Session, limit: int | None) -> tuple[int, int]:
    accounts = load_json(FREELANCERS_PATH)[:limit]
    truth_by_id = {t["id"]: t for t in load_json(TRUTH_PATH)}
    todo = [a for a in accounts if not email_exists(session, a["email"])]
    skipped = len(accounts) - len(todo)
    if not todo:
        return 0, skipped

    llm, emb = LLMClient(), EmbeddingClient()
    added = 0
    with ThreadPoolExecutor(max_workers=LLM_WORKERS) as pool:
        for start in range(0, len(todo), BATCH):
            batch = list(pool.map(lambda a: prepare(a, llm), todo[start:start + BATCH]))
            texts = [c.text for item in batch for c in item["chunks"]]
            vectors = emb.embed(texts)  # semua potongan satu batch sekaligus (dipecah per 64 teks)
            pos = 0
            for item in batch:
                n = len(item["chunks"])
                save_freelancer(session, item, vectors[pos:pos + n], truth_by_id[item["account"]["id"]], emb.model)
                pos += n
            session.commit()
            added += len(batch)
            print(f"  freelancer {skipped + added}/{len(accounts)} tersimpan")
    return added, skipped


# ------------------------------------------------------------------ main

def count(session: Session, model) -> int:
    return session.exec(select(func.count()).select_from(model)).one()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="hanya N freelancer pertama")
    args = parser.parse_args()

    init_db()  # membuat tabel yang belum ada
    with Session(engine) as session:
        added, skipped = load_clients(session)
        print(f"client: {added} ditambahkan, {skipped} sudah ada")
        added, skipped = load_freelancers(session, args.limit)
        print(f"freelancer: {added} ditambahkan, {skipped} sudah ada")

        roles = session.exec(select(User.role, func.count()).group_by(User.role)).all()
        print("\nisi database:")
        print(f"  user per role     : {dict(roles)}")
        print(f"  client_profile    : {count(session, ClientProfile)}")
        print(f"  freelancer_profile: {count(session, FreelancerProfile)}")
        print(f"  cv_chunk          : {count(session, CvChunk)}")
        print(f"  seed_truth        : {count(session, SeedTruth)}")
        print(f"  job (proyek)      : {count(session, Job)}")


if __name__ == "__main__":
    main()
