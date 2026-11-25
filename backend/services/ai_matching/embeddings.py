import os
from typing import Optional, Sequence

import httpx
from dotenv import load_dotenv

load_dotenv()

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
BATCH_SIZE = 64
TIMEOUT_SECONDS = 30.0


class EmbeddingError(RuntimeError):
    """Gagal membuat embedding (konfigurasi, jaringan, atau respons aneh)."""


class EmbeddingClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("EMBEDDING_MODEL", "")
        self.base_url = base_url or os.getenv("LLM_BASE_URL") or DEFAULT_BASE_URL
        if not self.api_key or not self.model:
            raise EmbeddingError("LLM_API_KEY dan EMBEDDING_MODEL wajib diisi di backend/.env")
        self._http = httpx.Client(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {self.api_key}"},
            timeout=TIMEOUT_SECONDS,
            transport=transport,
        )

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        """Ubah banyak teks menjadi vektor, urutan hasil = urutan input."""
        vectors: list[list[float]] = []
        for start in range(0, len(texts), BATCH_SIZE):
            vectors.extend(self._embed_batch(texts[start : start + BATCH_SIZE]))
        return vectors

    def _embed_batch(self, batch: Sequence[str]) -> list[list[float]]:
        try:
            response = self._http.post("/embeddings", json={"model": self.model, "input": list(batch)})
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise EmbeddingError(f"HTTP {e.response.status_code}: {e.response.text[:200]}") from e
        except httpx.HTTPError as e:
            raise EmbeddingError(f"Gagal koneksi ke {self.base_url}: {e}") from e

        data = sorted(response.json()["data"], key=lambda d: d.get("index", 0))
        if len(data) != len(batch):
            raise EmbeddingError(f"Jumlah vektor ({len(data)}) tidak sama dengan jumlah teks ({len(batch)})")
        return [d["embedding"] for d in data]