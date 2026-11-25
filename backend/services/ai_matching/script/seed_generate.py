"""S1 seed: membuat 300 akun freelancer sintetis beserta kunci jawabannya.

Akun: id, name, email (NamaDepanNamaBelakang@example.com), password ("1234", sama untuk semua;
prototype: disimpan apa adanya, keputusan user), rate (estimasi biaya per proyek, Rp), aboutme (CV).

Jalankan dari root proyek:
    backend/.venv/Scripts/python backend/services/ai_matching/script/seed_generate.py
    backend/.venv/Scripts/python backend/services/ai_matching/script/seed_generate.py --n 10   # coba sedikit dulu

Output (folder script/seed_data/):
    freelancers.json  -> akun: [{"id", "name", "email", "password", "rate", "aboutme"}]
    seed_truth.json   -> kunci jawaban: [{"id", "category", ...}]   (HANYA untuk evaluasi)

Benih dibuat deterministik (random.Random(42)); CV ditulis LLM (temperature 0.9 agar bervariasi)
lalu DISIMPAN, sehingga run berikutnya tidak memanggil LLM lagi. Bisa dilanjutkan bila terputus.
"""
import argparse
import json
import random
import sys
import threading
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR.parent))  # agar bisa import cv_parser
from check_llm import DEFAULT_BASE_URL, ENV_PATH, http_json, load_env  # noqa: E402
from cv_parser import chunk_cv  # noqa: E402

OUT_DIR = SCRIPT_DIR / "seed_data"
ACCOUNTS_PATH = OUT_DIR / "freelancers.json"
TRUTH_PATH = OUT_DIR / "seed_truth.json"
RNG_SEED = 42
SEED_PASSWORD = "1234"  # dummy, sama untuk semua akun seed
EMAIL_DOMAIN = "example.com"  # domain khusus contoh (RFC 2606), bukan milik orang
# Estimasi biaya per proyek (Rp) menurut seniority, dibulatkan ke Rp100.000.
RATE_RANGE = {"junior": (1_000_000, 3_000_000), "mid": (3_000_000, 8_000_000), "senior": (8_000_000, 20_000_000)}

# ------------------------------------------------------------------ benih

CATEGORIES: dict[str, dict] = {
    "frontend": {
        "role": "Frontend Developer",
        "skills": ["html", "css", "javascript", "typescript", "react", "next.js", "vue", "tailwind css", "redux"],
    },
    "backend": {
        "role": "Backend Developer",
        "skills": ["node.js", "express", "python", "django", "fastapi", "php", "laravel", "go", "postgresql",
                   "mysql", "redis", "rest api"],
    },
    "fullstack": {
        "role": "Fullstack Developer",
        "skills": ["react", "next.js", "node.js", "express", "laravel", "vue", "postgresql", "mysql",
                   "mongodb", "typescript", "docker"],
    },
    "mobile": {
        "role": "Mobile Developer",
        "skills": ["flutter", "dart", "kotlin", "swift", "react native", "firebase", "rest api"],
    },
    "data": {
        "role": "Data Analyst",
        "skills": ["python", "pandas", "sql", "excel", "power bi", "tableau", "data visualization", "statistik"],
    },
    "ml": {
        "role": "Machine Learning Engineer",
        "skills": ["python", "machine learning", "scikit-learn", "tensorflow", "pytorch", "nlp",
                   "computer vision", "pandas"],
    },
    "devops": {
        "role": "DevOps Engineer",
        "skills": ["docker", "kubernetes", "aws", "google cloud", "linux", "ci/cd", "terraform", "nginx"],
    },
    "uiux": {
        "role": "UI/UX Designer",
        "skills": ["figma", "ui design", "ux research", "wireframing", "prototyping", "design system",
                   "adobe xd"],
    },
    "graphic": {
        "role": "Graphic Designer",
        "skills": ["adobe illustrator", "adobe photoshop", "canva", "branding", "logo design",
                   "desain kemasan", "tipografi"],
    },
    "content": {
        "role": "Content Writer & Digital Marketer",
        "skills": ["copywriting", "seo", "content writing", "social media marketing", "google ads",
                   "meta ads", "email marketing"],
    },
}

DOMAINS = [
    "e-commerce fashion", "marketplace umkm", "kesehatan dan klinik", "pendidikan dan e-learning",
    "fintech dan pembayaran", "logistik dan pengiriman", "kuliner dan f&b", "pariwisata dan hotel",
    "properti dan real estate", "layanan pemerintah", "media dan berita", "manufaktur",
]

SENIORITY = {
    "junior": {"years": (1, 2), "jobs": 2, "projects": 2},
    "mid": {"years": (3, 5), "jobs": 3, "projects": 3},
    "senior": {"years": (6, 10), "jobs": 3, "projects": 4},
}

STYLES = ["formal dan rapi", "santai tapi profesional", "ringkas dan to the point",
          "detail dengan angka pencapaian"]

FIRST_NAMES = [
    "Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hendra", "Indah", "Joko", "Kartika", "Lukman",
    "Maya", "Nanda", "Oki", "Putri", "Rizky", "Sari", "Taufik", "Utami", "Vina", "Wahyu", "Yoga", "Zahra",
    "Agus", "Bayu", "Dimas", "Fitri", "Galih", "Hana", "Ilham", "Intan", "Kevin", "Laras", "Made", "Nisa",
    "Rani", "Satria", "Tiara", "Wulan", "Arif", "Bella", "Dodi", "Elsa", "Farhan", "Gilang", "Kadek", "Reza",
]
LAST_NAMES = [
    "Pratama", "Saputra", "Wijaya", "Lestari", "Nugroho", "Santoso", "Hidayat", "Kurniawan", "Permata",
    "Siregar", "Simanjuntak", "Hasibuan", "Wibowo", "Setiawan", "Rahmawati", "Purnomo", "Utomo", "Halim",
    "Gunawan", "Putra", "Anggraini", "Firmansyah", "Ramadhan", "Susanto", "Maharani", "Sitompul", "Tanjung",
    "Prasetyo", "Suryadi", "Wardhana",
]


def build_seeds(n: int) -> list[dict]:
    """Benih deterministik: kategori dibagi rata, sisanya diacak dengan seed tetap."""
    rng = random.Random(RNG_SEED)
    names = [f"{f} {l}" for f in FIRST_NAMES for l in LAST_NAMES]
    rng.shuffle(names)
    cats = list(CATEGORIES)
    seeds = []
    for i in range(n):
        cat = cats[i % len(cats)]
        pool = CATEGORIES[cat]["skills"]
        level = rng.choices(list(SENIORITY), weights=[3, 4, 3])[0]
        lo, hi = SENIORITY[level]["years"]
        domain = rng.choice(DOMAINS)
        other_domain = rng.choice([d for d in DOMAINS if d != domain])
        seeds.append({
            "id": i + 1,
            "name": names[i],
            "category": cat,
            "role": CATEGORIES[cat]["role"],
            "domain": domain,
            "other_domain": other_domain,
            "skills": sorted(rng.sample(pool, k=min(len(pool), rng.randint(3, 5)))),
            "seniority": level,
            "years": rng.randint(lo, hi),
            "style": rng.choice(STYLES),
        })
    return seeds


def account_fields(seed: dict) -> dict:
    """Data akun selain CV. RNG terpisah per id agar benih & CV yang sudah dibuat tidak berubah."""
    rng = random.Random(f"{RNG_SEED}-rate-{seed['id']}")
    lo, hi = RATE_RANGE[seed["seniority"]]
    return {
        "id": seed["id"],
        "name": seed["name"],
        "email": seed["name"].replace(" ", "") + "@" + EMAIL_DOMAIN,
        "password": SEED_PASSWORD,
        "role": "freelancer",
        "rate": rng.randrange(lo, hi + 1, 100_000),
    }


# ------------------------------------------------------------------ LLM

PROMPT = """Tulis CV freelancer fiktif dalam Bahasa Indonesia untuk platform freelance.

Profil (rahasia, jangan disalin mentah):
- Peran: {role} ({seniority}, {years} tahun pengalaman)
- Domain utama: {domain} (sebagian besar pengalaman & portofolio di sini)
- Domain lain: {other_domain} (cukup 1 pengalaman atau proyek)
- Skill yang dikuasai: {skills}
- Gaya tulisan: {style}

Aturan:
1. Pakai PERSIS struktur header berikut, masing-masing di baris sendiri diakhiri titik dua:
Ringkasan:
Keahlian:
Pengalaman:
Portofolio:
Pendidikan:
2. Ringkasan: 2-3 kalimat. Keahlian: daftar dipisah koma.
3. Pengalaman: {jobs} poin, Portofolio: {projects} poin. Setiap poin diawali "- " dan berisi 1-2 kalimat
   konkret (apa yang dibuat, untuk siapa, teknologi apa, hasilnya). Sebut skill secara alami.
4. JANGAN menulis nama, email, nomor telepon, alamat, tautan, atau nama perusahaan asli.
5. Jangan menyebut kata "fiktif", "seed", atau label kategori.
6. Balas HANYA teks CV, tanpa pembuka atau penutup."""


def generate_cv(seed: dict, cfg: dict) -> tuple[str, dict]:
    level = SENIORITY[seed["seniority"]]
    content = PROMPT.format(
        role=seed["role"], seniority=seed["seniority"], years=seed["years"], domain=seed["domain"],
        other_domain=seed["other_domain"], skills=", ".join(seed["skills"]), style=seed["style"],
        jobs=level["jobs"], projects=level["projects"],
    )
    payload = {
        "model": cfg["model"],
        "temperature": 0.9,
        "max_tokens": 900,
        "messages": [{"role": "user", "content": content}],
    }
    last_error = "unknown"
    for attempt in range(4):
        try:
            result = http_json(f"{cfg['base_url']}/chat/completions", cfg["api_key"], payload, timeout=90)
            text = result["choices"][0]["message"]["content"].strip()
            problem = validate_cv(text)
            if problem is None:
                return text, result.get("usage", {})
            last_error = problem
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code}"
            if e.code in (401, 402, 403):
                raise RuntimeError(f"{last_error}: cek API key / saldo OpenRouter") from e
        except Exception as e:  # noqa: BLE001 - timeout, JSON rusak, dll -> coba lagi
            last_error = type(e).__name__
        time.sleep(2 ** attempt)
    raise RuntimeError(f"seed {seed['id']} gagal: {last_error}")


def validate_cv(text: str) -> str | None:
    """CV harus bisa dipotong chunker kita: minimal 1 pengalaman dan 1 portofolio, tanpa kontak."""
    types = [c.type for c in chunk_cv(text)]
    if "experience" not in types:
        return "tanpa chunk experience"
    if "portfolio" not in types:
        return "tanpa chunk portfolio"
    if "@" in text or "http" in text.lower():
        return "memuat kontak/tautan"
    return None


# ------------------------------------------------------------------ main

def load_existing() -> dict[int, dict]:
    if not ACCOUNTS_PATH.exists():
        return {}
    return {a["id"]: a for a in json.loads(ACCOUNTS_PATH.read_text(encoding="utf-8"))}


def save(accounts: dict[int, dict], seeds: list[dict]) -> None:
    OUT_DIR.mkdir(exist_ok=True)
    done = sorted(accounts)
    ACCOUNTS_PATH.write_text(
        json.dumps([accounts[i] for i in done], ensure_ascii=False, indent=2), encoding="utf-8")
    truth_keys = ("id", "category", "role", "domain", "other_domain", "skills", "seniority", "years")
    by_id = {s["id"]: s for s in seeds}
    TRUTH_PATH.write_text(
        json.dumps([{k: by_id[i][k] for k in truth_keys} for i in done], ensure_ascii=False, indent=2),
        encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=300)
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    env = load_env(ENV_PATH)
    cfg = {"api_key": env.get("LLM_API_KEY", ""), "model": env.get("LLM_MODEL", ""),
           "base_url": env.get("LLM_BASE_URL") or DEFAULT_BASE_URL}
    if not cfg["api_key"] or not cfg["model"]:
        print("Isi LLM_API_KEY dan LLM_MODEL di backend/.env dulu.")
        return 1

    seeds = build_seeds(args.n)
    accounts = load_existing()
    # Segarkan data akun (email, password, rate) untuk akun lama tanpa memanggil LLM ulang.
    for s in seeds:
        if s["id"] in accounts:
            accounts[s["id"]] = {**account_fields(s), "aboutme": accounts[s["id"]]["aboutme"]}
    save(accounts, seeds)
    todo = [s for s in seeds if s["id"] not in accounts]
    print(f"target {args.n}, sudah ada {len(accounts)}, akan dibuat {len(todo)} (model {cfg['model']})")

    lock = threading.Lock()
    tokens = {"prompt_tokens": 0, "completion_tokens": 0}
    failed = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(generate_cv, s, cfg): s for s in todo}
        for k, fut in enumerate(as_completed(futures), 1):
            seed = futures[fut]
            try:
                text, usage = fut.result()
            except RuntimeError as e:
                failed.append(seed["id"])
                print(f"  [{k}/{len(todo)}] GAGAL {e}")
                continue
            with lock:
                accounts[seed["id"]] = {**account_fields(seed), "aboutme": text}
                for key in tokens:
                    tokens[key] += usage.get(key, 0)
                save(accounts, seeds)
            print(f"  [{k}/{len(todo)}] id={seed['id']:3d} {seed['category']:9s} {seed['domain']}")

    print(f"\nselesai: {len(accounts)} akun tersimpan di {ACCOUNTS_PATH}")
    print(f"token: prompt={tokens['prompt_tokens']} completion={tokens['completion_tokens']}")
    if failed:
        print(f"gagal: {sorted(failed)} -> jalankan ulang skrip ini untuk melanjutkan")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
