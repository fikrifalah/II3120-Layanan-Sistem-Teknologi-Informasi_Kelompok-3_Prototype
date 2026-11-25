"""Tes koneksi OpenRouter. Hanya memakai standard library, tanpa install apa pun.

Jalankan dari root proyek:
       python backend/services/ai_matching/script/check_llm.py
    python backend/services/ai_matching/script/check_llm.py --list free     # cari model berakhiran :free
    python backend/services/ai_matching/script/check_llm.py --list llama    # cari model yang slug-nya memuat "llama"
Membaca LLM_API_KEY, LLM_MODEL, LLM_BASE_URL dari backend/.env. API key tidak pernah dicetak.
"""
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


def load_env(path: Path) -> dict:
    env = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def http_json(url: str, api_key: str | None = None, payload: dict | None = None, timeout: int = 30):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def list_models(base_url: str, query: str) -> None:
    models = http_json(f"{base_url}/models")["data"]
    q = query.lower()
    hits = [m for m in models if q in m["id"].lower()]
    print(f"{len(hits)} model cocok dengan '{query}':")
    for m in hits[:40]:
        pricing = m.get("pricing", {})
        print(f"  {m['id']:60s} prompt={pricing.get('prompt')} completion={pricing.get('completion')}")


def main() -> int:
    env = load_env(ENV_PATH)
    base_url = env.get("LLM_BASE_URL") or DEFAULT_BASE_URL

    if len(sys.argv) >= 3 and sys.argv[1] == "--list":
        list_models(base_url, sys.argv[2])
        return 0

    api_key = env.get("LLM_API_KEY", "")
    model = env.get("LLM_MODEL", "")
    print(f"env file : {ENV_PATH} ({'ada' if ENV_PATH.exists() else 'TIDAK ADA'})")
    print(f"api key  : {'terisi' if len(api_key) > 10 else 'KOSONG'}")
    print(f"model    : {model or 'KOSONG'}")
    if not api_key or not model:
        print("\nIsi LLM_API_KEY dan LLM_MODEL di backend/.env dulu.")
        return 1

    ids = {m["id"] for m in http_json(f"{base_url}/models")["data"]}
    if model not in ids:
        print(f"\nSlug '{model}' tidak ditemukan di OpenRouter. Cari yang valid dengan --list <kata>.")
        return 1
    print("slug     : valid")

    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 120,
        "messages": [
            {
                "role": "user",
                "content": 'Ekstrak nama dari teks ini dan balas HANYA JSON array string lowercase: '
                '"Butuh developer React(kaem) dan Tailwind(dani) untuk membuat dashboard, backend FastAPI(krisna)."',
            }
        ],
    }
    try:
        result = http_json(f"{base_url}/chat/completions", api_key, payload)
    except urllib.error.HTTPError as e:
        print(f"\nGAGAL HTTP {e.code}: {e.read().decode()[:300]}")
        return 1
    except urllib.error.URLError as e:
        print(f"\nGAGAL koneksi: {e.reason}")
        return 1

    print("\nbalasan model:", result["choices"][0]["message"]["content"])
    print("OK, koneksi OpenRouter berfungsi.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
