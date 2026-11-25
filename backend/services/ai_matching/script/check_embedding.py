"""Tes embedding OpenRouter. Hanya memakai standard library.

Jalankan dari root proyek:
    python backend/services/ai_matching/script/check_embedding.py

Membaca LLM_API_KEY, EMBEDDING_MODEL, LLM_BASE_URL dari backend/.env. API key tidak pernah dicetak.
"""
import math
import sys
import urllib.error

from check_llm import DEFAULT_BASE_URL, ENV_PATH, http_json, load_env
QUERY = "Butuh developer untuk membuat website e-commerce fashion dengan React."

# (teks, perkiraan kita) -> kita ingin urutan cosine mengikuti perkiraan ini
TEXTS = [
    ("Membangun toko online pakaian wanita menggunakan React dan Midtrans.", "sangat mirip"),
    ("Membuat marketplace sepatu berbasis Next.js.", "mirip"),
    ("Membuat company profile klinik gigi dengan Laravel.", "beda domain"),
    ("Menganalisis data penjualan dengan Python dan Excel.", "beda jauh"),
    ("Saya suka memasak nasi goreng di akhir pekan.", "tidak berhubungan"),
]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b)


def main() -> int:
    env = load_env(ENV_PATH)
    base_url = env.get("LLM_BASE_URL") or DEFAULT_BASE_URL
    api_key = env.get("LLM_API_KEY", "")
    model = env.get("EMBEDDING_MODEL", "")

    print(f"api key  : {'terisi' if len(api_key) > 10 else 'KOSONG'}")
    print(f"model    : {model or 'KOSONG'}")
    if not api_key or not model:
        print("\nIsi LLM_API_KEY dan EMBEDDING_MODEL di backend/.env dulu.")
        return 1

    embed_models = http_json(f"{base_url}/models?output_modalities=embeddings")["data"]
    if model not in {m["id"] for m in embed_models}:
        print(f"\nSlug '{model}' bukan model embedding yang tersedia di OpenRouter.")
        return 1
    print("slug     : valid")

    inputs = [QUERY] + [text for text, _ in TEXTS]
    try:
        result = http_json(f"{base_url}/embeddings", api_key, {"model": model, "input": inputs})
    except urllib.error.HTTPError as e:
        print(f"\nGAGAL HTTP {e.code}: {e.read().decode()[:300]}")
        return 1
    except urllib.error.URLError as e:
        print(f"\nGAGAL koneksi: {e.reason}")
        return 1

    data = sorted(result["data"], key=lambda d: d.get("index", 0))
    vectors = [d["embedding"] for d in data]
    print(f"jumlah   : {len(vectors)} vektor (harusnya {len(inputs)})")
    print(f"dimensi  : {len(vectors[0])}")
    print(f"usage    : {result.get('usage')}")

    query_vec = vectors[0]
    scored = [
        (cosine(query_vec, vec), text, expected)
        for vec, (text, expected) in zip(vectors[1:], TEXTS)
    ]
    scored.sort(reverse=True)

    print(f"\nQuery: {QUERY}\n")
    for sim, text, expected in scored:
        print(f"  {sim:.3f}  [{expected:17s}]  {text}")

    order_ok = [expected for _, _, expected in scored] == [expected for _, expected in TEXTS]
    print("\nUrutan sesuai perkiraan:", "YA" if order_ok else "TIDAK (lihat penjelasan)")
    return 0


if __name__ == "__main__":
    sys.exit(main())