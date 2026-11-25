import pytest

from services.ai_matching.retrieval import StoredChunk, best_evidence, cosine


def test_cosine_same_direction_is_one():
    assert cosine([1.0, 2.0], [2.0, 4.0]) == pytest.approx(1.0)


def test_cosine_perpendicular_is_zero():
    assert cosine([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


def test_cosine_kopi_vs_es_krim_matches_hand_calculation():
    kopi = [0.0, 0.2, 0.1, 0.9]
    es_krim = [0.0, 0.9, 0.1, 0.0]
    assert cosine(kopi, es_krim) == pytest.approx(0.226, abs=1e-3)


def test_cosine_zero_vector_returns_zero():
    assert cosine([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_cosine_dimension_mismatch_raises():
    with pytest.raises(ValueError):
        cosine([1.0, 0.0], [1.0, 0.0, 0.0])


QUERY = [1.0, 0.0]  # arah "e-commerce"
CHUNKS = [
    StoredChunk(1, "experience", "toko online fashion", [0.9, 0.1]),
    StoredChunk(1, "experience", "aplikasi klinik", [0.1, 0.9]),
    StoredChunk(1, "portfolio", "dashboard toko", [0.7, 0.3]),
    StoredChunk(1, "other", "React, Laravel", [1.0, 0.0]),
    StoredChunk(2, "experience", "sistem rumah sakit", [0.2, 0.8]),
]


def test_best_evidence_picks_highest_per_type():
    result = best_evidence(QUERY, CHUNKS)
    assert result[1]["experience"].text == "toko online fashion"
    assert result[1]["experience"].similarity == pytest.approx(0.994, abs=1e-3)
    assert result[1]["portfolio"].text == "dashboard toko"


def test_best_evidence_includes_other_type():
    result = best_evidence(QUERY, CHUNKS)
    assert result[1]["other"].text == "React, Laravel"


def test_missing_type_is_absent_not_zero():
    result = best_evidence(QUERY, CHUNKS)
    assert "portfolio" not in result[2]


def test_allowed_ids_filters_candidates():
    result = best_evidence(QUERY, CHUNKS, allowed_ids={2})
    assert list(result) == [2]


def test_no_chunks_returns_empty():
    assert best_evidence(QUERY, []) == {}