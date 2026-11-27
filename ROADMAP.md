# Gigly — Roadmap Menuju Siap Deploy

Status per commit `f629f3e` (26 Nov 2026). Dokumen ini memetakan **apa yang belum selesai** per fitur utama sampai aplikasi siap di-deploy dan didemokan. Centang `[x]` bila selesai, dan perbarui kolom status di ringkasan.

**Legenda status:** ✅ selesai · 🟡 sebagian (jalan, tapi masih ada mock/kekurangan) · ❌ belum ada
**Ukuran:** S = < ½ hari · M = 1–2 hari · L = > 2 hari

---

## 1. Ringkasan status

| # | Fitur | Pemilik (README) | Backend | Frontend | Status |
|---|---|---|---|---|---|
| F1 | Login & akun (role) | – (dikerjakan Member-4) | `services/auth/` | `auth.ts`, `Login.tsx` | 🟡 |
| F2 | Proyek / job client | Member-3 + Member-6 | `POST /api/v1/jobs` (orchestrator) saja | disimpan di browser per akun | 🟡 |
| F3 | AI matching (rekomendasi anonim) | Member-4 | `services/ai_matching/` | `matching.ts`, `Matches.tsx` | ✅ |
| F4 | Profil freelancer | Member-4 + Member-6 | `GET/PATCH /freelancer/profile` | `FreelancerProfile.tsx` | 🟡 |
| F5 | Undangan & pembukaan identitas | Member-3 (dikerjakan Member-4) | `orchestrator/router.py` (`/api/v1/invitations/*`) | `store.tsx`, `ReceivedInvitations.tsx` | 🟡 |
| F6 | Kontrak (draft → persetujuan) | Member-3 | ❌ (belum ada di `orchestrator/router.py`) | `ContractBuilder.tsx` (mock) | ❌ |
| F7 | Escrow & pembayaran SIM-IDR | Member-1 + Member-2 | 🟡 `Escrow.sol` + test ada, RPC baru sebagian | `FundEscrow.tsx`, `WalletPage.tsx` (mock) | 🟡 |
| F8 | Milestone, deliverable & review | Member-3 | ❌ | `FreelancerProjects.tsx`, `MilestoneReview.tsx` (mock) | ❌ |
| F9 | Sengketa & keputusan arbiter | Member-5 + Member-6 | ❌ (`dispute_handler/service.py` kosong) | `Disputes.tsx` (mock), `ArbiterView.tsx` kosong | ❌ |
| F10 | Notifikasi & aktivitas | Member-6 | ❌ | lokal di browser | 🟡 |
| X | Kesiapan deploy (lintas fitur) | semua | – | – | ❌ |

**Jalur kritis demo end-to-end:** F2 → F6 → F7 → F8 → F9. Fitur F1, F3, F4, dan F5 sudah tersambung ke backend asli.

### Alur platform dan posisi setiap fitur

```text
[F1 Login] → [F2 Buat proyek] → [F3 AI matching] → [F5 Undang → diterima → identitas terbuka]
          → [F6 Kontrak disetujui] → [F7 Escrow didanai] → [F8 Milestone dikirim → direview → dana dilepas]
          → (bila ada masalah) [F9 Sengketa → putusan arbiter → RELEASE / REFUND / SPLIT]
```

---

## 2. Tugas per fitur

### F1 — Login & akun · 🟡
Sudah ada: login, `/auth/me`, logout, token 8 jam tersimpan di tabel `auth_token`, dashboard terpisah per role, dan nama/perusahaan di header mengikuti akun yang login.

- [ ] **Hash password** (bcrypt/argon2). Saat ini password tersimpan sebagai teks biasa `1234`, yang hanya boleh untuk prototype. Perlu juga migrasi data seed. `backend/services/auth/router.py`, `seed_db.py` · M
- [ ] **Akun arbiter** di seed (role `arbiter`). Saat ini belum ada, sehingga login arbiter tidak mungkin dilakukan. `script/seed_data/`, `seed_db.py` · S
- [ ] Bersihkan token kedaluwarsa (job berkala atau saat login). · S
- [ ] *(opsional)* Registrasi akun baru (client/freelancer) dari UI. · M

### F2 — Proyek / job client · 🟡
Sudah ada: `POST /api/v1/jobs` di orchestrator (wajib login sebagai client; pemilik job diambil dari token) menyimpan job + `job_requirement` (skill, kategori, industri, lewat `ai_matching.service.save_requirements`) ketika matching dijalankan. `/matching/recommend` hanya bisa dipanggil pemilik job.

- [ ] **Daftar proyek diambil dari backend**, bukan `localStorage`. Saat ini proyek hanya tersimpan di browser per akun, sehingga tidak terbawa ke laptop lain. Butuh `GET /api/v1/projects` (milik client yang login). `orchestrator/router.py`, `store.tsx` · L
- [ ] Simpan field form yang belum tersimpan di backend: deliverables, tanggal mulai/selesai, level pengalaman, dan budget fleksibel. Pilihannya kolom baru di `Job` atau di `job_requirement`. `models.py` / `db_models.py` · M
- [ ] **Edit proyek → perbarui job di backend.** Saat ini proyek yang diedit setelah matching tetap memakai `backendJobId` lama. · S
- [ ] Siklus status proyek (`draft → matching → inviting → contracting → funding → active → completed`) disimpan di `Job.status`. · M
- [x] ~~Endpoint pembuatan job memakai client dari token login~~ → selesai: dipindah ke `POST /api/v1/jobs` (orchestrator). · S

### F3 — AI matching · ✅
Sudah ada: RAG (embedding `baai/bge-m3` + LLM `llama-3.3-70b`), hard filter budget/kapasitas, skor 6 komponen, alasan grounded + validator + cadangan, alias anonim. Evaluasi: P@5 0.72, NDCG@5 0.56, konsistensi 96%.

- [ ] **Evaluasi ulang memakai skill dari form** (sekarang skill job berasal dari pilihan client, bukan tebakan LLM). Perbarui angka untuk laporan. `script/evaluate.py` · S
- [ ] Tuning bobot komponen skill (sinyal terlemah di evaluasi #2) di job kalibrasi, lalu buktikan di job evaluasi. · S
- [ ] Ringkasan hasil evaluasi untuk laporan (tabel, metode, keterbatasan). `docs/` · S
- [ ] *(opsional)* Cache hasil rekomendasi per job agar klik ulang tidak memanggil LLM lagi. Ini menghemat biaya dan waktu sekitar 7 detik. · M
- [ ] *(opsional)* Batas laju (*rate limit*) endpoint `/recommend` untuk mengendalikan biaya OpenRouter. · S

### F4 — Profil freelancer · 🟡
Sudah ada: lihat/edit profil, dan setiap edit diindeks ulang (bersihkan PII → potong → embed) sehingga matching langsung memakai data baru.

- [ ] **Perluas katalog skill UI.** Sekarang hanya 20 skill pemrograman, jadi desainer, penulis, dan developer mobile tidak bisa menyimpan profil. Ubah `skillGroups` di `frontend/src/services/freelancerProfile.ts` **dan** `UI_SKILL_CATALOG` di `ai_matching/service.py` (harus sama). · S
- [ ] Bagian **Pendidikan** CV ikut dipertahankan saat profil diedit (sekarang hilang). `ai_matching/service.py` · S
- [ ] *(opsional)* Upload CV (PDF) → teks → indeks. · L

### F5 — Undangan & pembukaan identitas · 🟡
Sudah ada: client mengundang alias → backend `resolve_alias` → freelancer menerima/menolak → nama terbuka di sisi client (cek status setiap 5 detik).

- [ ] **Chat undangan** (client ↔ freelancer) lewat backend. Sekarang tombol pesan hanya ada untuk undangan demo. `orchestrator/router.py`, `InvitationMessages.tsx` · M
- [ ] Skor dan alasan AI di undangan **dihitung/disimpan backend**, tidak dikirim frontend (sekarang penyederhanaan prototype). · S
- [ ] Notifikasi untuk freelancer saat ada undangan baru (lihat F10). · S

### F6 — Kontrak · ❌
Sudah ada: UI Contract Builder (mock) dan tabel `Contract` di `models.py`.

- [ ] `POST /api/v1/contracts` dibuat dari undangan yang **diterima** (memakai `freelancer_id` hasil `resolve_alias`). `orchestrator/router.py` · M
- [ ] `PATCH` draft kontrak (lingkup, durasi, milestone, nominal) + `POST /contracts/{id}/send` untuk persetujuan. · M
- [ ] Freelancer menyetujui/menolak kontrak. Perlu halaman di sisi freelancer (sekarang belum ada). · M
- [ ] Hash dokumen kontrak (SHA-256) disimpan untuk bukti. · S
- [ ] Hubungkan `store.tsx` (`createContract`, `saveContract`, `sendContractForApproval`) ke API dengan saklar seperti tahap 1–3. · M

### F7 — Escrow & pembayaran SIM-IDR · 🟡
Sudah ada: `SIMIDR.sol` (ERC-20 + faucet), `Escrow.sol` (multi-milestone, auto-release 5 hari, handover, putusan arbiter), 383 baris test Hardhat, dan `smart_contract/service.py` yang baru berisi `get_contract`, `execute_arbiter_verdict_onchain`, `close_contract_onchain`.

- [ ] **Tentukan model wallet:** wallet platform (backend menandatangani transaksi dengan private key Hardhat) **atau** MetaMask di browser. Keputusan ini memengaruhi semua tugas di bawah. · keputusan tim
- [ ] Fungsi RPC yang belum ada: `approve` SIM-IDR, `createAndLockEscrow`, `submitMilestone`, `releaseMilestonePayment`, `raiseDispute`. `smart_contract/service.py` · M
- [ ] Endpoint pendanaan escrow + transaksi (`/transactions/{id}`, `/reconcile`, `/retry`) dan `/wallet` sesuai yang dipanggil `frontend/src/services/projectWork.ts`. · L
- [ ] Faucet token demo dari backend (menggantikan `addDemoTokens` mock). · S
- [ ] Simpan alamat escrow + hash transaksi ke tabel `Escrow`. · S
- [ ] Sinkronkan `FundEscrow.tsx` dan `WalletPage.tsx` ke API. Saat ini saldo setiap client adalah angka demo 25.000 dengan alamat wallet yang sama. · M

### F8 — Milestone, deliverable & review · ❌
Sudah ada: UI workspace freelancer dan review client (mock), tabel `Milestone`, dan folder `backend/uploads/`.

- [ ] Endpoint yang **sudah dipanggil frontend** (`projectWork.ts`): `GET /projects`, `GET /projects/{id}/workspace`, `GET /milestones/{id}`, `POST /milestones/{id}/submit`, `POST /files`, `GET /files/{id}/content`. `orchestrator/router.py` · L
- [ ] Upload file deliverable + **hash SHA-256** disimpan ke `Milestone.deliverable_hash`. · M
- [ ] Review client: approve (→ lepas dana on-chain) atau minta revisi; auto-release setelah 5 hari (sesuai `Escrow.sol`). · M
- [ ] Hubungkan `approveMilestone` di `store.tsx` dan halaman `MilestoneReview.tsx` ke API. · M

### F9 — Sengketa & arbiter · ❌
Sudah ada: fungsi `raiseDispute` / `executeArbiterVerdict` di `Escrow.sol`, `execute_arbiter_verdict_onchain` di RPC, dan tabel `Dispute`.

- [ ] `POST /api/v1/disputes` (alasan + upload bukti + hash) → bekukan milestone. `dispute_handler/service.py` · M
- [ ] `POST /api/v1/disputes/{id}/verdict` (RELEASE / REFUND / SPLIT) → eksekusi on-chain. · M
- [ ] **Halaman arbiter** (`ArbiterView.tsx` masih kosong): daftar sengketa, bukti, form putusan. · L
- [ ] Hubungkan `raiseDispute` di `store.tsx` dan `Disputes.tsx` ke API. · S

### F10 — Notifikasi & aktivitas · 🟡
- [ ] Notifikasi dan log aktivitas disimpan di backend (sekarang di browser, jadi hilang bila pindah perangkat). · M
- [ ] Notifikasi untuk freelancer (undangan baru, kontrak menunggu persetujuan, milestone direview). · M

---

## 3. Kesiapan deploy (lintas fitur) · ❌

### Konfigurasi & rahasia
- [ ] **Perbaiki `backend/.env.example`:** `LLM_MODEL` masih `llama-3.3-70b-versatile` (nama model Groq, tidak valid di OpenRouter) → `meta-llama/llama-3.3-70b-instruct`; tambahkan `EMBEDDING_MODEL=baai/bge-m3`. Tanpa ini, anggota yang meng-clone repo langsung mendapat error AI. · S
- [ ] Perbarui README: langkah seed data (`seed_db.py`), API key OpenRouter, akun demo, dan semua saklar `VITE_*`. · S
- [ ] Rahasia (API key, private key) hanya di `.env` / secret manager hosting, tidak pernah di repo. · S
- [ ] CORS: `allow_origins=["*"]` diganti dengan domain frontend sebenarnya. `backend/main.py` · S

### Database
- [ ] **Migrasi skema** (Alembic). `create_all` tidak bisa mengubah tabel yang sudah ada; selama ini kolom baru (`email`, `password`) ditambah manual dengan `ALTER TABLE`. · M
- [ ] Tentukan DB produksi: SQLite (cukup untuk demo satu server) atau PostgreSQL (bila backend di-hosting dengan banyak instance). · keputusan tim
- [ ] Skrip **reset data demo**: kosongkan `job`, `job_requirement`, `match_alias`, `invitation`, `auth_token`, lalu jalankan ulang seed. · S

### Blockchain
- [ ] Tentukan jaringan: **Hardhat lokal** (cukup untuk demo di satu laptop) atau **testnet** (mis. Sepolia, butuh RPC provider + ETH testnet). · keputusan tim
- [ ] Alamat kontrak hasil `deploy.js` dibaca otomatis oleh backend (bukan disalin manual ke `.env`). · S

### Kualitas & pengujian
- [ ] Test backend untuk modul baru (`auth`, `invitations`, endpoint orchestrator). Saat ini hanya `ai_matching` yang punya test (25 test). · M
- [ ] `npx hardhat test` dijalankan sebelum setiap rilis. · S
- [ ] Uji end-to-end alur demo lengkap (F1 → F9) dengan 2 browser (client + freelancer) + 1 arbiter. · M
- [ ] Frontend `npm run build` tanpa error; matikan semua saklar mock untuk build produksi (`VITE_USE_MOCK=false`, setelah F6–F9 selesai). · S

### Hosting
- [ ] Tentukan target: **demo lokal** (`npm run dev` di satu laptop) atau **cloud** (mis. frontend statis di Vercel/Netlify, backend di Render/Railway, kontrak di testnet). · keputusan tim
- [ ] Backend produksi: `uvicorn` tanpa `--reload`, log ke file, endpoint `/health` untuk pengecekan. · S
- [ ] Frontend: `VITE_API_BASE_URL` menunjuk ke URL backend produksi. · S

---

## 4. Keputusan tim yang dibutuhkan

| # | Keputusan | Memengaruhi | Pilihan |
|---|---|---|---|
| K1 | Model wallet | F7, F8, F9 | Wallet platform (backend menandatangani) / MetaMask |
| K2 | Jaringan blockchain | F7, deploy | Hardhat lokal / testnet |
| K3 | Target deploy | Semua | Demo lokal / cloud |
| K4 | Database | F2, deploy | SQLite / PostgreSQL |
| ~~K5~~ | ~~Letak kode undangan & pembuatan job~~ | F2, F5 | ✅ Diputuskan: dipindah ke `orchestrator/router.py` (sesuai README). `services/auth/` tetap modul terpisah |

---

## 5. Urutan pengerjaan yang disarankan

| Gelombang | Isi | Siapa |
|---|---|---|
| **0. Rapikan** | Perbaiki `.env.example`, perbarui README, putuskan K1–K4 | Semua |
| **1. Kontrak** | F6 + F2 (proyek dari backend) | Member-3, Member-6 |
| **2. Uang** | F7 (RPC + endpoint escrow/wallet) | Member-1, Member-2 |
| **3. Kerja** | F8 (milestone, upload + hash, review → release) | Member-3, Member-2 |
| **4. Sengketa** | F9 + halaman arbiter | Member-5, Member-6 |
| **5. Poles & bukti** | F3 evaluasi ulang + laporan, F4 katalog skill, F10 notifikasi, password hashing | Member-4, Member-6 |
| **6. Deploy** | Bagian 3: migrasi DB, CORS, build produksi, uji end-to-end | Semua |

Setiap gelombang memakai pola yang sama dengan integrasi tahap 1–3: endpoint backend dibuat sesuai bentuk data yang **sudah dipanggil frontend**, lalu frontend dipindahkan dari mock ke API lewat saklar `VITE_*` khusus fitur itu, sehingga fitur lain tidak rusak.

---

## 6. Definisi "siap deploy"

- [ ] Semua saklar mock bisa dimatikan (`VITE_USE_MOCK=false`) tanpa error.
- [ ] Alur demo lengkap berjalan: login → buat proyek → matching → undang → kontrak → danai escrow → submit milestone → approve → dana dilepas, plus satu skenario sengketa → putusan arbiter.
- [ ] Data demo bisa di-reset dengan satu perintah.
- [ ] Tidak ada rahasia di repo; `.env.example` lengkap dan benar.
- [ ] Semua test lulus: `pytest`, `npx hardhat test`, `npm run build`.
- [ ] README menjelaskan cara menjalankan dari nol (clone → setup → seed → jalan).
