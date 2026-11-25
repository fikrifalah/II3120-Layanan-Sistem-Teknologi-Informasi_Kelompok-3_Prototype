# AI Matching Module — Context for AI Assistants

Konteks untuk AI/developer yang melanjutkan pekerjaan modul ini. **Baca seluruhnya sebelum mengubah apa pun.**
Terakhir diperbarui: 2026-11-25.

## 0. Cara bekerja dengan user (WAJIB)
- User sedang **belajar**. Jangan menulis kode langsung ke file proyek. Berikan kode di chat, user yang copy-paste sendiri.
  Pengecualian: dokumen konteks seperti file ini boleh diupdate langsung.
- Format balasan gaya mentor, bahasa Indonesia santai tapi tepat:
  status singkat (✅/❌/⚠️), penyebab dulu baru solusi, langkah bernomor, baris **Tujuan:** di setiap perintah/kode,
  ✅ Checkpoint (perintah tes + hasil yang benar), konsep baru dengan analogi, 🧠 Pelajaran, lalu langkah berikutnya.
- **Satu topik per balasan.** Jangan klaim berhasil tanpa bukti output dari user. Rahasia selalu `<PLACEHOLDER>`.
- User memakai Windows + PowerShell, venv di `backend/.venv` (Python 3.14.7).
- **Tanpa file unit test baru** (permintaan user 2026-11-25, demi kecepatan). Checkpoint cukup satu perintah cek cepat (`python -c ...`) + hasil yang benar. File test lama (`tests/`) dibiarkan.
- Setiap perubahan: sebutkan **path lengkap dari root + nomor baris/posisi**.

## 1. Proyek
**Gigly**: platform pencocokan freelancer + escrow smart contract (tugas kelompok II3120, 6 anggota, satu modul per orang).
Stack tim: FastAPI + SQLModel (SQLite) di `backend/`, Hardhat/Solidity di `blockchain/`, React 18 + Vite + Tailwind di `frontend/`.

Modul ini = **AI Matching** (`AIMatchingProvider` / `MatchingServiceContract` di SoaML). Pemilik: Member-4.
**Hanya edit file di `backend/services/ai_matching/`**, kecuali perubahan kecil yang disepakati (lihat §9).

## 2. Dokumen acuan
- **`docs/AI_Matching_System_Design.md`** = **desain target**: hybrid matching, RAG, 6 parameter skor, evaluasi.
- File ini = **versi prototype** dari desain tersebut: apa yang benar-benar dibangun, dengan stack tim yang ada.
- Jika keduanya bertentangan, ikuti file ini untuk implementasi, lalu catat perbedaannya di §10.

## 3. Status (update setiap ada kemajuan)
| Komponen | Status | Bukti |
|---|---|---|
| `schemas.py`, `router.py` | 🗑️ **dihapus user** (2026-11-25) | Versi skeleton lama dibuang agar dibangun ulang sesuai desain RAG. Akan dibuat lagi saat merangkai `service.py` |
| `__init__.py` | ⚪ kosong | Tidak lagi mengekspor `router` |
| Router di `backend/main.py` | ✅ dicabut | `main.py` dikembalikan ke versi tim (`git restore`); `import main` → OK. Daftarkan lagi saat router dibuat ulang |
| LLM OpenRouter (`script/check_llm.py`) | ✅ terbukti | Slug valid, ekstraksi skill mengembalikan JSON array. Jalan dari folder baru |
| Embedding OpenRouter (`script/check_embedding.py`) | ✅ terbukti | `baai/bge-m3`, **1024 dimensi**, batch jalan, urutan kemiripan sesuai perkiraan. Jalan dari folder baru |
| `scoring.py` + `tests/` | ❌ belum ada | Kode versi 3 parameter pernah diberikan di chat, tapi harus diganti ke versi 6 parameter |
| `cv_parser.py`: `clean_cv()` (Cleaner PII) + `chunk_cv()` (Chunker) | ✅ selesai | `tests/test_cv_parser.py` + `tests/test_chunker.py`: 15 passed di laptop user (2026-11-25). Format CV dibakukan: header bagian (`Pengalaman:`/`Portofolio:`/...) + bullet |
| `retrieval.py`: `cosine()`, `best_evidence()` | ✅ selesai | `tests/test_retrieval.py`; total 25 passed (diverifikasi 2026-11-25) |
| `embeddings.py`: `EmbeddingClient` (httpx, batch 64, `EmbeddingError`) | ✅ selesai | `httpx` terpasang & ditambahkan ke `requirements.txt` (baris 7, belum di-commit). Cek live dikonfirmasi user |
| `filtering.py`: `hard_filter()` | ✅ selesai | Gugur jika: rate > budget × 1.2 (`BUDGET_TOLERANCE`) atau proyek aktif ≥ `MAX_ACTIVE_PROJECTS` (keputusan #14, #15; gerbang skill dihapus). Data kosong → lolos + `needs_confirmation`. `rejection_counts` untuk menjelaskan hasil 0 kandidat. Tanpa sinonim (lihat keputusan #12) |
| `skills.py` | 🗑️ dihapus user | Keputusan #12 opsi C: format skill diatur lewat prompt saja |
| `db_models.py`: 4 tabel baru (keputusan #13) | ✅ selesai | Tabel `cv_chunk`, `freelancer_profile`, `match_alias`, `seed_truth` terbentuk di `backend/app.db` laptop user (2026-11-25) |
| `scoring.py`: 6 parameter, `score_candidate()` | ✅ selesai (cek 90.1 cocok) | Pemetaan cosine `SIM_FLOOR=0.40`, `SIM_CEIL=0.80` **sementara** (kalibrasi setelah seed). Skill = 80% recall wajib + 20% preferred. Budget: ≤ budget → 100, turun linear sampai 0 di 2× budget. Availability: bool. Reliability: rata-rata rating/5 dan proyek selesai (maks 10) |
| `embeddings.py`, `retrieval.py`, `filtering.py`, `llm.py`, `anonymizer.py`, `service.py` | ❌ belum ada | `service.py` masih kosong |
| Seed S1: generate 300 akun + CV | ✅ selesai (2026-11-25, dibuat Claude atas permintaan user) | `script/seed_generate.py` → `script/seed_data/freelancers.json` (akun: `id`, `name`, `email` = NamaDepanNamaBelakang@example.com, `password` = "1234" untuk semua (prototype: disimpan apa adanya, keputusan user). **Pengecualian opsi A (disetujui tim via user, 2026-11-25):** `backend/models.py` `User` ditambah `email: Optional[str]` (unique, index) dan `password: Optional[str]`. DB lama perlu `ALTER TABLE user ADD COLUMN email/password` + unique index `ix_user_email` (sudah dijalankan di `app.db` laptop user); DB baru otomatis lewat `create_all`, `rate` Rp per proyek menurut seniority: junior 1–3 jt, mid 3–8 jt, senior 8–20 jt, RNG terpisah per id, `aboutme` = CV teks) + `script/seed_data/seed_truth.json` (kunci jawaban: category, role, domain, other_domain, skills, seniority, years). 10 kategori × 30, 12 domain, benih deterministik `Random(42)`, CV ditulis llama-3.3-70b temperature 0.9 lalu disimpan (tidak di-generate ulang). Semua lolos `chunk_cv` (6–10 chunk/CV, ≥1 experience & ≥1 portfolio), tidak ada PII. Token: 109k prompt + 140k completion. Availability seed = 0 proyek aktif (belum punya kontrak) → 100 |
| Role akun | ✅ (2026-11-26) | Semua akun (client & freelancer) ada di SATU tabel `user`; kolom `role` ("client" / "freelancer") menentukan dashboard setelah login. `role` juga tertulis di `clients.json` & `freelancers.json`; `seed_db.py` memakai `role` dari JSON. Endpoint login & routing dashboard belum ada (frontend `src` belum punya login/dashboard) |
| Seed client (3 akun) | ✅ selesai (2026-11-26, dibuat Claude atas permintaan user) | `script/seed_data/clients.json` (id, name, email @example.com, password "1234", company, industry, aboutme) → `script/seed_db.py` → tabel `user` (role="client") + tabel baru `client_profile` (di `db_models.py`: client_id, company, industry, aboutme). user.id 1–3 di `app.db` laptop user. Idempoten (dilewati bila email sudah ada). Industri dipilih agar cocok dengan domain seed freelancer (fashion, klinik, f&b) untuk demo. Tabel `job` sengaja kosong, diisi saat demo. S3 freelancer akan ditambahkan ke `seed_db.py` yang sama |
| `llm.py` bagian 1: `LLMClient.chat()` + `extract_skills()` + `parse_skill_list()` | ⏳ kode diberikan (2026-11-26) | Diuji Claude di scratchpad pada 30 CV seed: recall skill benih 97% (117/121). **Temuan: temperature=0 TIDAK deterministik di OpenRouter** — 3× panggilan identik hanya 21–24/30 CV; parameter `seed` tidak membantu (22/30), jadi tidak dipakai. Selisihnya skill "pinggiran" (mis. `desain kemasan`, `youtube`). Mitigasi: hasil diurutkan (`sorted`); CV diekstrak SEKALI lalu disimpan; untuk sisi job (per request, opsi B) pertimbangkan voting mayoritas 3× bila uji konsistensi gagal. Juga terlihat risiko opsi C: `desain logo` vs `logo design` |
| Pengukuran gerbang skill (2026-11-26) | 📊 | 20 job kalibrasi, skill job diekstrak LLM, dicocokkan ke `freelancer_profile.skills`: jika SEMUA skill job wajib → **6/20 job 0 kandidat** (mis. `android, ios`; `autoscaling, containerisasi`; `ui, ux, wireframe`) dan job lain menyusut drastis (content: 3 dari 30 orang yang benar). "Minimal 1 cocok" → masih 2/20 job 0 kandidat. 8/20 job ditulis bahasa awam → skill job kosong. Juga teramati: LLM sesekali membalas string KOSONG → `extract_skills` raise `LLMError` (service wajib retry/fallback). **Keputusan #15: opsi C** (user, 2026-11-26) — skill TIDAK lagi menjadi gerbang; hard filter hanya budget (+20% toleransi) dan kapasitas (proyek aktif ≥ 3). Skill tetap dipakai di `skill_score` (bobot 0.30). Blok skill di `filtering.py` dihapus |
| `anonymizer.py`: `get_aliases(session, job_id, fids)` + `resolve_alias(session, job_id, alias)` | ✅ (checkpoint user OK 2026-11-26) | Alias `Candidate-XXXX` (4 hex, `secrets`), unik per job, dipakai ulang bila freelancer muncul lagi di job yang sama; commit sekali per panggilan. Diuji di SQLite in-memory (app.db tidak tersentuh) |
| `llm.py` bagian 2: `explain()` + `validate_reason()` + `template_reason()` | ✅ (checkpoint user OK 2026-11-26) | Diuji Claude dengan data DB asli: alasan 1–2 kalimat, grounded ke bukti, injeksi di bukti diabaikan; validator menolak alasan yang menyebut skor/kontak; `template_reason` = fallback tanpa LLM. **Temuan untuk `service.py`:** ekstraksi skill job "mobile developer Android dan iOS" menghasilkan `["android","ios"]`, padahal CV menulis flutter/kotlin → matched kosong. Jika semua skill hasil ekstraksi job dijadikan WAJIB di hard filter, semua kandidat bisa gugur. Perlu keputusan desain: skill wajib vs sekadar disebut (bahas saat `service.py`/ekstraksi job) |
| Evaluasi #1 (`script/evaluate.py`, 2026-11-26) | 📊 | 20 job EVALUASI (beda dari 20 job kalibrasi), salinan DB sementara, budget longgar, relevansi 2/1/0 dari seed_truth. Hasil P@5 / NDCG@5: keyword 0.73/0.52, skill 0.54/0.34, embedding 0.64/0.49, **hybrid (sistem saat ini) 0.66/0.49 → kalah dari keyword**. Konsistensi hybrid 3×: top-5 identik 17/20 job, irisan rata-rata 95%. Gagal terutama pada job bahasa awam untuk peran software yang mirip (frontend/backend/fullstack/mobile). **Akar masalah:** retrieval hanya memakai chunk experience/portfolio; chunk `other` (Ringkasan: "Saya adalah seorang Backend Developer...") yang memuat PERAN diabaikan |
| Eksperimen varian ranking (2026-11-26) | 📊 | Bobot dipilih di 20 job kalibrasi, dilaporkan di 20 job evaluasi (P@5/NDCG@5 eval): A sekarang 0.67/0.50; B +profil(chunk other) 0.72/0.56; C +keyword 0.69/0.52; **D +profil +keyword (skill .20, exp .15, port .15, profil .25, keyword .25) 0.82/0.67** (terbaik NDCG kalibrasi 0.77); F profil+keyword tanpa exp/port 0.82/0.63; keyword saja 0.73/0.52. Keputusan adopsi menunggu user. Catatan: budget/availability konstan saat eksperimen; di produksi bobot D diskalakan ke 0.80 + budget .10 + availability .10 |
| Evaluasi #2 setelah keputusan #16 (varian B), 2026-11-26 | 📊 | Dijalankan Claude di salinan backend dengan perubahan `service.py` langkah 3: **hybrid 0.72 / 0.56** (sesuai prediksi eksperimen), keyword 0.73/0.52, skill 0.59/0.37, embedding-saja (kini termasuk chunk other) 0.73/0.60. Konsistensi 18/20 identik, irisan 96%. Catatan jujur: embedding-saja kini sedikit di atas hybrid untuk NDCG → komponen skill (sisi job, opsi C) adalah sinyal terlemah; kandidat perbaikan: turunkan bobot skill atau perbaiki ekstraksi skill job |
| `schemas.py` + `router.py` + daftar di `main.py` | ✅ (user: /docs muncul, 404 untuk job kosong, 2026-11-26) | `POST /api/v1/matching/recommend` (tag "AI Matching"), body `{job_id, top_k=5 (1..20)}` → `{job_id, candidates:[{alias, score, matched_skills, reason}]}`. 404 job tidak ada, 422 validasi, 503 bila LLM/embedding belum dikonfigurasi. Diuji Claude via TestClient di salinan backend: 200, tanpa `freelancer_id`/`breakdown`/nama di response. `main.py`: import router setelah `import models` (baris 8) + `app.include_router(...)` sebelum `app.mount` (baris 33); import router juga mendaftarkan tabel `db_models` ke `init_db()` |
| `service.py`: `recommend(session, job_id, top_k, with_reasons, llm, emb) -> MatchResult` | ✅ (checkpoint user OK 2026-11-26) | Diuji Claude di salinan app.db: job desain kopi → top-5 semua graphic, #1 graphic/kuliner (tepat); ~5–7 detik/request; ranking konsisten 2× (alias+urutan identik); kandidat dengan 3 kontrak aktif hilang (`availability`); LLM+embedding dimatikan → tetap 200 dengan cadangan (`fallbacks=['extract_skills','embedding','explain']`). `Candidate` internal memuat `freelancer_id`/`breakdown` — router HANYA boleh mengirim alias, score, matched_skills, reason. **Keterbatasan terukur:** job "aplikasi mobile Android & iOS klinik" → skill job `android, ios` tidak cocok dengan CV (flutter/kotlin) → skill=0 untuk semua; ranking didominasi domain "klinik" (fullstack/frontend klinik di top-5, mobile pertama di peringkat 8). Kandidat perbaikan untuk fase evaluasi: prompt ekstraksi sisi job yang menerjemahkan kebutuhan ke teknologi umum |
| Seed S3: 300 freelancer ke DB | ✅ selesai (2026-11-26, dibuat & dijalankan Claude atas permintaan user) | `script/seed_db.py` → `load_freelancers()`: clean_cv → extract_skills (8 paralel, retry 3) → chunk_cv → embed per batch 20 → `user` (role freelancer, user.id 4–303) + `freelancer_profile` + `cv_chunk` (2572: 812 experience, 895 portfolio, 865 other; dim 1024, model baai/bge-m3) + `seed_truth`. Recall skill benih 98.4% (graphic 86% terendah, karena ejaan Indonesia/Inggris, risiko opsi C). 0 kebocoran nama/email di `cv_text`. Opsi `--limit N`. Idempoten per email |
| `pytest` | ✅ terpasang di `.venv` (9.2) | Belum dicatat di `requirements.txt` |

`backend/.env.example` sudah diubah user (belum di-commit): `LLM_BASE_URL` dan `LLM_MODEL` OpenRouter. `LLM_API_KEY` masih placeholder.
**`EMBEDDING_MODEL` belum ditambahkan ke `.env.example`.**

## 4. Hasil uji embedding (acuan kalibrasi)
Query: *"Butuh developer untuk membuat website e-commerce fashion dengan React."*

| Cosine | Perkiraan | Teks |
|---|---|---|
| 0.730 | sangat mirip | Membangun toko online pakaian wanita menggunakan React dan Midtrans. |
| 0.611 | mirip | Membuat marketplace sepatu berbasis Next.js. |
| 0.498 | beda domain | Membuat company profile klinik gigi dengan Laravel. |
| 0.475 | beda jauh | Menganalisis data penjualan dengan Python dan Excel. |
| 0.385 | tidak berhubungan | Saya suka memasak nasi goreng di akhir pekan. |

Implikasi:
- Cosine untuk teks yang tidak berhubungan pun ~0.38. **Jangan pakai `cosine × 100` mentah** sebagai skor.
- Pemetaan cosine → 0–100 memakai rentang (mis. min-max), tetapi **batasnya belum ditetapkan**. Tentukan dari sebaran nilai 300 data seed, bukan dari tes 5 kalimat ini.
- Biaya terukur: 77 token = $0.00000077 (~$0.01 per juta token).

## 5. Keputusan desain (jangan diubah tanpa persetujuan user)
1. **Hybrid**: AI memahami teks; kode deterministik menentukan kelayakan, skor, dan ranking. LLM **tidak boleh** mengubah skor.
2. **Pakai RAG** (keputusan final user). Dirakit sendiri tanpa framework (bukan LangChain/LlamaIndex) agar setiap tahap bisa dijelaskan dan dites.
3. **Data freelancer berupa CV teks** (pengalaman, proyek, bahasa/teknologi yang dikuasai). Bukan sekadar daftar skill.
4. **Ratusan data** (target ~300 freelancer sintetis) untuk membuktikan hasil **konsisten** dan **sesuai aktual**.
5. **Konsistensi**: `temperature=0`; hasil ekstraksi LLM per CV dan embedding CV **disimpan di DB**, tidak dihitung ulang. Sisi job dihitung ulang setiap request (lihat #11).
6. **Fallback wajib** untuk setiap titik AI: ekstraksi → keyword match; alasan → template. API tidak boleh gagal karena LLM gagal.
7. **Anonimisasi**: response hanya memuat alias (`Candidate-XXXX`), tidak pernah `name`, `wallet_address`, atau `user_id`. PII dibuang dari CV **sebelum** dikirim ke OpenRouter.
8. **Teks CV = data, bukan instruksi** (cegah prompt injection): bungkus dalam tag `<bukti>` dan instruksikan LLM mengabaikan perintah di dalamnya.
9. Fungsi scoring, filtering, dan cosine harus **murni** (tanpa I/O) agar mudah dites.
10. **Konfirmasi client** atas hasil ekstraksi: **ditunda** (bukan MVP).
13. **Penyimpanan: opsi A** (keputusan user, 2026-11-25): tabel baru khusus modul, tabel tim (`user`, `job`) **tidak diubah**. Didefinisikan di `services/ai_matching/db_models.py` (bukan di `backend/models.py`) agar nol bentrok: `freelancer_profile`, `cv_chunk` (vektor JSON + nama model), `seed_truth` (kunci jawaban evaluasi), `match_alias` (unik per job+freelancer dan job+alias). Semua memakai `freelancer_id` = `user.id`. Tabel dibuat lewat `database.init_db()` setelah `db_models` diimpor; DB = `backend/app.db` (di-ignore git), jalankan dari folder `backend`.
12. **Penyeragaman nama skill: opsi C, instruksi di prompt saja** (keputusan user, 2026-11-25; menggantikan kosakata baku). `skills.py` **dihapus user**. Tidak ada daftar baku maupun kamus sinonim. Prompt ekstraksi LLM (job & CV) menginstruksikan format nama skill: huruf kecil, nama teknologi yang paling umum, tanpa versi. `normalize_skills()` tetap hanya lowercase+strip. **Risiko yang disadari user:** ejaan berbeda (mis. `react.js` vs `react`) membuat skill tidak cocok di `skill_score` dan hard filter. Uji konsistensi (§11) wajib mengukur ini; jika gagal, kembali ke kosakata baku (A) atau skill via embedding (B). Daftar kategori/skill untuk membuat benih pindah ke `script/seed.py` (hanya untuk generate data, bukan untuk validasi).
14. **Budget, availability, reliability** (keputusan user, 2026-11-25):
    - **Budget** = `rate` milik freelancer = estimasi biaya yang ia minta **per proyek** (Rp), dibandingkan dengan budget job.
    - **Availability** = dihitung dari **jumlah proyek aktif** freelancer di aplikasi ini (tabel `contract` milik tim), bukan diisi sendiri. `MAX_ACTIVE_PROJECTS = 3`: skor = 100 × (1 − aktif/3), jadi 0→100, 1→66.7, 2→33.3, ≥3→0. Hard filter: gugur jika aktif ≥ 3. Kolom `available` dihapus dari `freelancer_profile`.
    - **Reliability dihapus** (beserta `rating`, `completed_projects`, `MAX_PROJECTS`).
    - Bobot baru (usulan Claude, 0.05 milik reliability dipindah ke portfolio): skill 0.30, experience 0.25, portfolio 0.25, budget 0.10, availability 0.10.
    - **Proyek aktif** (definisi user, 2026-11-26) = kontrak yang smart contract-nya masih ada, yaitu belum ada kesepakatan selesai antara client dan freelancer. Implementasi: `Contract.freelancer_id == fid` dan `Contract.status NOT IN ("completed", "cancelled")`. `draft` ikut dihitung aktif (freelancer sudah dipilih). Nama status final mengikuti modul kontrak; simpan sebagai konstanta `FINISHED_CONTRACT_STATUSES` di `service.py`.
16. **Ranking: tambah komponen `profile` (varian B)** (keputusan user, 2026-11-26). Awalnya dipilih D (profile + keyword), tetapi user menolak menambah kode keyword (baik file `keywords.py` maupun fungsi di `retrieval.py`), jadi yang dipakai varian B: `profile` = cosine terbaik chunk `other` (Ringkasan/Keahlian, memuat PERAN), lewat `similarity_score` yang sama. `SCORED_TYPES` di `retrieval.py` += "other" (sudah diubah user); bukti untuk `explain()` tetap hanya experience/portfolio. Bobot: skill .26, experience .18, portfolio .18, profile .18, budget .10, availability .10. Ekspektasi dari eksperimen (job evaluasi): B 0.72/0.56 vs sekarang 0.67/0.50 vs keyword 0.73/0.52 vs D 0.82/0.67. Keyword tetap opsi perbaikan bila nanti dibutuhkan.
11. **Waktu panggil matching: opsi B** (keputusan user, 2026-11-25). Seluruh jalur query (ekstraksi job, embedding job, filter, retrieval, scoring, alasan) dijalankan **setiap kali client meminta rekomendasi** (`POST /recommend`), bukan saat lowongan dibuat. Konsekuensi: setiap klik memanggil LLM + embedding ulang, sehingga lebih lambat, dan hasil ekstraksi LLM bisa sedikit berbeda antar-request. Mitigasi: `temperature=0`; uji konsistensi (§11) wajib mencakup variasi ini. Indexing CV tetap dilakukan sekali per CV.

## 6. Tech stack modul
| Lapisan | Pilihan | Catatan |
|---|---|---|
| API | FastAPI + Pydantic | Sudah dipakai tim |
| LLM | OpenRouter `meta-llama/llama-3.3-70b-instruct` | Ekstraksi kebutuhan job/CV + alasan grounded |
| Embedding | OpenRouter `baai/bge-m3` (1024 dim, multilingual) | Alternatif: `intfloat/multilingual-e5-large`. **Hindari model `-en`** (CV berbahasa Indonesia) |
| Vector store | SQLite, vektor disimpan sebagai JSON | Cukup untuk ratusan data; pgvector = future work |
| Similarity | Cosine similarity di Python | Fungsi `cosine()` sudah ada di `script/check_embedding.py`, nanti pindah ke `retrieval.py` |
| HTTP client | `httpx` (rencana) | Script `check_*.py` memakai stdlib `urllib` |
| Test | `pytest` | |

Env (nilai asli hanya di `backend/.env`, tidak pernah di-commit):
```text
LLM_API_KEY=<OPENROUTER_API_KEY>
LLM_MODEL=meta-llama/llama-3.3-70b-instruct
LLM_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_MODEL=baai/bge-m3
```
Satu key OpenRouter dipakai untuk LLM dan embedding. Model embedding saat indexing dan query **wajib sama**; simpan nama model bersama setiap vektor.

## 7. Alur RAG
### Jalur indexing (sekali per CV)
1. **Cleaner** (`cv_parser.py`): buang PII (nama, HP, email, alamat).
2. **Ekstraksi profil** (`llm.py`): CV → JSON terstruktur (skills, years_experience, domains, rate, dst). Disimpan.
3. **Chunker** (`cv_parser.py`): potong per pengalaman/proyek, diberi `type` = `experience` atau `portfolio`.
4. **Embedding** (`embeddings.py`): batch request ke `/embeddings` → vektor 1024 dim.
5. **Simpan** ke SQLite: `freelancer_id, type, text, embedding(JSON), model`.

### Jalur query (setiap request `/recommend`)
1. **Ekstraksi kebutuhan job** (`llm.py`): `required_skills`, `preferred_skills`, `project_type`, `industry`, `max_budget`, `duration_days`. Validasi Pydantic, fallback keyword. Dihitung ulang setiap request (keputusan #11, opsi B).
2. **Hard filter** (`filtering.py`): query biasa, tanpa AI. Data wajib yang kosong → lolos dengan tanda "perlu konfirmasi", bukan digugurkan. Jika 0 kandidat → tampilkan alasan.
3. **Embedding job** (model sama dengan indexing).
4. **Retrieval** (`retrieval.py`): cosine vs potongan CV kandidat yang lolos filter; ambil potongan teratas per `type`.
   Hasilnya dipakai **dua kali**: nilai `sim` → skor experience/portfolio; `text` → bukti untuk prompt.
5. **Weighted scoring** (`scoring.py`), lihat §8.
6. **Ranking** descending, ambil `top_k` (default 5).
7. **Augmentation + generation** (`llm.py`): **satu** panggilan LLM untuk semua top-K, berisi bukti potongan CV + skor; output JSON `alias, reason, limitations`.
8. **Validator**: schema valid, alias cocok, skor selalu dari scoring. Gagal → template.
9. **Anonymizer** (`anonymizer.py`): alias per job, pemetaan alias → freelancer_id disimpan di DB.

## 8. Scoring (mengikuti desain target §4.4)
| Parameter | Bobot | Sumber |
|---|---:|---|
| skill | 0.30 | recall skill wajib + bonus skill preferred |
| experience | 0.25 | cosine potongan `experience` teratas (setelah pemetaan) |
| portfolio | 0.20 | cosine potongan `portfolio` teratas (setelah pemetaan) |
| budget | 0.10 | rate/estimasi biaya vs `max_budget` |
| availability | 0.10 | data ketersediaan |
| reliability | 0.05 | rating, proyek selesai |

- Setiap komponen bernilai 0–100, atau `None` jika datanya tidak ada.
- Komponen `None` dibuang dan bobot sisanya **dinormalisasi ulang**: freelancer baru tidak otomatis dianggap buruk.
- Skill memakai **recall** (bukan Jaccard) agar skill tambahan tidak menghukum kandidat.

## 9. Struktur file target
```text
backend/services/ai_matching/
├── __init__.py                     # nanti export `router`                ⚪ kosong
├── router.py                       # APIRouter /api/v1/matching           ❌ (dihapus, dibuat ulang)
├── schemas.py                      # Pydantic request/response (§10)      ❌ (dihapus, dibuat ulang)
├── service.py                      # merangkai jalur query                 ❌
├── cv_parser.py                    # cleaner PII + chunker                 ❌
├── llm.py                          # ekstraksi + alasan grounded + fallback ❌
├── embeddings.py                   # panggilan /embeddings (batch)         ❌
├── retrieval.py                    # cosine + top potongan per kandidat    ❌
├── filtering.py                    # hard filter                           ❌
├── scoring.py                      # 6 parameter, fungsi murni             ❌
├── anonymizer.py                   # alias + pemetaan                      ❌
├── script/                         # alat bantu, BUKAN kode aplikasi
│   ├── check_llm.py                # tes koneksi LLM                       ✅
│   ├── check_embedding.py          # tes embedding + cosine                ✅
│   └── seed.py                     # 300 freelancer sintetis dari benih    ❌
├── docs/
│   ├── AI_Matching_System_Design.md  # desain target
│   └── CONTEXT.md                    # dokumen ini
└── tests/                                                                  ❌
```
Script di `script/` dijalankan dari root proyek (`python backend/services/ai_matching/script/<file>.py`), memakai import pendek antar-file (`from check_llm import ...`) dan `ENV_PATH = parents[3]`.
```text
```

## 10. Kontrak API
```text
POST /api/v1/matching/recommend
Request : { "job_id": int, "top_k": int = 5 }   # top_k 1..20
Response: { "job_id": int,
            "candidates": [
              { "alias": "Candidate-A7F3",
                "score": 88.6,
                "matched_skills": ["react"],
                "reason": "string" } ] }
```
- **Tanpa field baru** (keputusan user, 2026-11-26): `score_breakdown` & `limitations` TIDAK masuk response. Breakdown tetap dihitung di `ScoreResult` untuk evaluasi/log saja. Tidak perlu mengabari Member-6.
- README menyebut modul ini "Anonymized matching" dan frontend "anonymized AI match selection": response tidak boleh memuat `freelancer_id`/nama.
- **Alias → `freelancer_id`: opsi B** (keputusan user, 2026-11-26). Alias acak per job disimpan di `match_alias` (dipakai ulang bila freelancer muncul lagi di job yang sama). Orchestrator (Member-3) cukup meng-import `from services.ai_matching.anonymizer import resolve_alias` lalu `resolve_alias(job_id, alias) -> freelancer_id` saat client memilih kandidat; tanpa endpoint HTTP baru. Opsi A (kirim `freelancer_id` langsung) ditolak karena bertentangan dengan "anonymized" di README.

## 11. Data dan evaluasi
- **Data sintetis dari benih**: kode membuat benih terstruktur (skill, domain, tahun, rate) → LLM hanya menulis ulang menjadi teks CV natural. **Benih = kunci jawaban**, sehingga evaluasi tidak melingkar.
- Tambahan: set kecil yang dinilai manusia (user), mis. 5 job × 10 kandidat.
- Uji **konsistensi**: job yang sama dijalankan berulang → ranking harus identik.
- Uji **akurasi**: Precision@5 dan NDCG@5 terhadap kunci jawaban.
- Pembanding: keyword saja vs scoring vs hybrid semantic (desain target §8).
- Kasus tepi: 0 kandidat, profil tidak lengkap, freelancer baru, job ambigu.

## 12. Dependensi eksternal (koordinasi tim)
| Perubahan | Pemilik | Status |
|---|---|---|
| `include_router` di `backend/main.py` | Member-3 | Dicabut sementara (router dihapus); dipasang lagi saat router dibuat ulang, setelah disepakati |
| Tabel modul di `db_models.py` (keputusan #13); `User.email`/`password` di `models.py` | bersama | ✅ Disetujui tim via user (2026-11-25). Kabari tim soal migrasi `app.db` lama |
| Status kontrak yang dihitung "aktif" (availability) | user | ✅ Diputuskan (lihat #14) |
| Endpoint login + routing dashboard per role | belum jelas | Ditunda user ("nanti aja") |
| Kabari tim soal `httpx` | user | Ditunda user; user commit sendiri |
| Tambah `httpx`, `pytest` ke `requirements.txt`; `EMBEDDING_MODEL` ke `.env.example` | bersama | Belum |
| Perubahan response (`score_breakdown`, `limitations`) | Member-6 | Belum dikabari |
| Mekanisme alias → freelancer_id | Member-3 | ✅ Diputuskan opsi B (`resolve_alias`), tinggal dikabari ke Member-3 |

## 13. Di luar cakupan (future work)
Konfirmasi client, upload/parsing PDF, pgvector, feedback loop, Learning to Rank, LLM reranking.

## 14. Urutan pengerjaan berikutnya
1. ✅ **Cleaner** (`cv_parser.py`, `clean_cv()`) + test.
2. ✅ **Chunker** (`cv_parser.py`, `chunk_cv()`) + `tests/test_chunker.py`. Format CV ditentukan sendiri (header bagian + bullet), dipakai juga oleh seed.
3. ✅ `retrieval.py` (`cosine`, `best_evidence`) + test; `embeddings.py` (panggilan `/embeddings`, diuji dengan `httpx.MockTransport`) ← sedang dikerjakan.
4. ✅ `scoring.py` versi 6 parameter.
5. ✅ `filtering.py`, `db_models.py`, seed S1 (300 freelancer JSON), 3 client di DB.
6. ✅ Perubahan keputusan #14 di `scoring.py`/`filtering.py` (diverifikasi 2026-11-26: 76.3, availability gugur di 3 proyek aktif).
7. `llm.py`: `extract_skills()` (CV & job, prompt opsi C) + `extract_job()` + `explain()` grounded + fallback.
8. ✅ Seed S3 di `seed_db.py`: 300 freelancer → `user` + `freelancer_profile` + `cv_chunk` (embed) + `seed_truth`.
9. ✅ (diterapkan user, checkpoint `[0.0, 0.0, 50.0, 100.0, 100.0]`) Kalibrasi `SIM_FLOOR`/`SIM_CEIL`: `script/calibrate.py` (20 job contoh × 300 freelancer via `best_evidence`, dikelompokkan dengan `seed_truth`). Hasil 2026-11-26 (median cosine experience/portfolio): cocok 0.655/0.637, kategori sama domain beda 0.594/0.573, kategori beda 0.499/0.497. Usulan FLOOR = median "tidak" = **0.50**, CEIL = p90 "cocok" = **0.72** → median skor cocok 71/62, sebagian 43/33, tidak 0. (Lama 0.40/0.80 memberi CV tak relevan ±25 poin.) Perubahan di `scoring.py` baris 12–14 diberikan ke user.
10. `anonymizer.py` (alias + `match_alias`), lalu `service.py` merangkai semuanya (termasuk hitung proyek aktif dari `contract`).
11. Buat ulang `schemas.py` + `router.py` (kontrak §10), daftarkan di `main.py` (juga meng-import `db_models`).
12. Evaluasi (§11) + bahan demo (job contoh untuk 3 client).

## 15. Aturan untuk AI yang melanjutkan
- Patuhi §0 (mode mengajar).
- Jangan menampilkan `name`, `wallet_address`, atau `user_id` di response, dan jangan mengirim PII ke OpenRouter.
- Jangan mengedit file modul lain (`orchestrator`, `smart_contract`, `dispute_handler`, `blockchain/`, `frontend/`, `models.py`, `main.py`) tanpa persetujuan user.
- Jangan menghardcode API key atau nama model; baca dari env.
- Slug model OpenRouter bisa berubah; verifikasi lewat `script/check_llm.py` / `script/check_embedding.py`.
- Update §3 (status) dan §14 (urutan) setiap ada kemajuan.
