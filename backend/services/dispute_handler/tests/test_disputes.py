"""Tes endpoint sengketa dengan PostgreSQL terisolasi dan blockchain palsu (tanpa node Hardhat)."""
import hashlib
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel
from web3.exceptions import ContractLogicError

import models  # noqa: F401
from database import get_db
from models import Contract, Job, Milestone, User
from services.auth.router import AuthToken
from services.dispute_handler import service
from services.smart_contract import service as chain

CLIENT_WALLET = "0x" + "c1" * 20
FREELANCER_WALLET = "0x" + "f1" * 20
ARBITER_WALLET = "0x" + "a1" * 20
WEI = 10**18


class FakeChain:
    def __init__(self):
        self.statuses = ["SUBMITTED", "LOCKED"]
        self.amounts = [6000 * WEI, 9000 * WEI]
        self.calls = []
        self.wallets = {}

    def get_contract(self, contract_id):
        return {"client": CLIENT_WALLET, "arbiter": ARBITER_WALLET, "milestones": [
            {"amount": a, "freelancer": FREELANCER_WALLET, "status": s} for a, s in zip(self.amounts, self.statuses)]}

    def raise_dispute_onchain(self, user_id, contract_id, index):
        self.calls.append(("raise", contract_id, index, self.wallets[user_id]))
        self.statuses[index] = "DISPUTED"
        return {"tx_hash": "0xraise", "status": 1}

    def execute_arbiter_verdict_onchain(self, contract_id, index, action, pct):
        self.calls.append(("verdict", contract_id, index, action, pct))
        self.statuses[index] = {"RELEASE": "RELEASED", "REFUND": "REFUNDED", "SPLIT": "SPLIT_SETTLED"}[action]
        return {"tx_hash": "0xverdict", "status": 1}


@pytest.fixture
def env(tmp_path, monkeypatch, postgres_engine):
    engine = postgres_engine
    SQLModel.metadata.create_all(engine)
    fake = FakeChain()
    monkeypatch.setattr(service, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(chain, "get_contract", fake.get_contract)
    monkeypatch.setattr(chain, "raise_dispute_onchain", fake.raise_dispute_onchain)
    monkeypatch.setattr(chain, "execute_arbiter_verdict_onchain", fake.execute_arbiter_verdict_onchain)
    monkeypatch.setattr(chain, "user_address", lambda uid: fake.wallets.get(uid, "0x" + "00" * 20))
    monkeypatch.setattr(chain, "arbiter_address", lambda: ARBITER_WALLET)

    with Session(engine) as s:
        users = {name: User(name=name, email=f"{name}@x.id", role=role, wallet_address=wallet)
                 for name, role, wallet in [("client", "client", None), ("freelancer", "freelancer", None),
                                            ("arbiter", "arbiter", ARBITER_WALLET), ("outsider", "client", None)]}
        s.add_all(users.values())
        s.flush()
        job = Job(client_id=users["client"].id, title="Backend API", description="-", budget=15000)
        s.add(job)
        s.flush()
        contract = Contract(job_id=job.id, client_id=users["client"].id, freelancer_id=users["freelancer"].id,
                            total_amount=15000, status="active", onchain_contract_id=1)
        s.add(contract)
        s.flush()
        # M1: hasil revisi sedang direview (client sudah pernah meminta perbaikan) -> boleh disengketakan.
        ms = [Milestone(contract_id=contract.id, sequence=i, title=t, amount=a, status=st, revision_count=rc)
              for i, (t, a, st, rc) in enumerate([("Desain API", 6000, "under_review", 1),
                                                   ("Deployment", 9000, "pending", 0)], 1)]
        s.add_all(ms)
        for name, u in users.items():
            s.add(AuthToken(token=name, user_id=u.id, expires_at=time.time() + 3600))
        s.commit()
        fake.wallets.update({users["client"].id: CLIENT_WALLET, users["freelancer"].id: FREELANCER_WALLET})
        ids = {"contract": contract.id, "m1": ms[0].id, "m2": ms[1].id, **{n: u.id for n, u in users.items()}}

    def db():
        with Session(engine) as s:
            yield s

    app = FastAPI()
    app.include_router(service.router)
    app.dependency_overrides[get_db] = db
    client = TestClient(app)

    def call(method, path, who, **kw):
        return client.request(method, "/api/v1/disputes" + path, headers={"Authorization": "Bearer " + who}, **kw)

    return {"call": call, "ids": ids, "fake": fake, "engine": engine, "uploads": tmp_path}


def _raise(env, who="client", milestone="m1", files=None):
    return env["call"]("POST", "", who, data={"milestone_id": env["ids"][milestone], "reason": "ERD tidak 3NF"},
                       files=files or [])


def test_client_raises_dispute_with_hashed_evidence(env):
    content = b"screenshot ERD"
    r = _raise(env, files=[("evidence", ("erd.png", content, "image/png"))])
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["status"] == "open"
    assert d["milestone"]["status"] == "disputed"
    assert d["milestone"]["index"] == 0
    assert d["assigned_arbiter"]["name"] == "arbiter"
    assert d["raise_transaction_hash"] == "0xraise"
    (ev,) = d["evidence"]
    assert ev["filename"] == "erd.png"
    assert ev["sha256"] == hashlib.sha256(content).hexdigest()
    assert (env["uploads"] / "disputes" / ev["url"].rsplit("/", 1)[1]).read_bytes() == content
    assert env["fake"].calls == [("raise", 1, 0, CLIENT_WALLET)]


def _set_milestone(env, key, **fields):
    with Session(env["engine"]) as s:
        m = s.get(Milestone, env["ids"][key])
        for k, v in fields.items():
            setattr(m, k, v)
        s.add(m)
        s.commit()


def test_freelancer_raise_is_signed_with_freelancer_wallet(env):
    _set_milestone(env, "m1", status="revision_required")  # freelancer menolak permintaan perbaikan
    env["fake"].statuses[0] = "LOCKED"
    assert _raise(env, who="freelancer").status_code == 201
    assert env["fake"].calls == [("raise", 1, 0, FREELANCER_WALLET)]


def test_dispute_only_after_revision_is_not_agreed(env):
    _set_milestone(env, "m1", revision_count=0)
    r = _raise(env)
    assert r.status_code == 409 and "Minta perbaikan dulu" in r.json()["detail"]
    r = _raise(env, who="freelancer")  # hasil masih direview, belum ada permintaan perbaikan
    assert r.status_code == 409 and "permintaan perbaikan" in r.json()["detail"]
    _set_milestone(env, "m1", status="in_progress")
    assert _raise(env).status_code == 409
    assert env["fake"].calls == []


def test_raise_rejections(env):
    assert _raise(env, who="outsider").status_code == 404
    assert _raise(env).status_code == 201
    assert _raise(env).status_code == 409  # sudah dalam sengketa
    with Session(env["engine"]) as s:
        c = s.get(Contract, env["ids"]["contract"])
        c.onchain_contract_id = None
        s.add(c)
        s.commit()
    _set_milestone(env, "m2", status="under_review", revision_count=1)
    r = _raise(env, milestone="m2")
    assert r.status_code == 409 and "belum dikunci" in r.json()["detail"]


def test_raise_rejected_by_smart_contract_returns_409(env, monkeypatch):
    def revert(*args):
        raise ContractLogicError("execution reverted: Escrow: milestone cannot be disputed")
    monkeypatch.setattr(chain, "raise_dispute_onchain", revert)
    r = _raise(env)
    assert r.status_code == 409 and "cannot be disputed" in r.json()["detail"]
    assert env["call"]("GET", "", "client").json()["data"] == []  # tidak ada sisa di DB


def test_too_many_or_empty_evidence_files(env):
    many = [("evidence", (f"{i}.txt", b"x", "text/plain")) for i in range(6)]
    assert _raise(env, files=many).status_code == 422
    assert _raise(env, files=[("evidence", ("kosong.txt", b"", "text/plain"))]).status_code == 422
    assert env["fake"].calls == []  # validasi bukti sebelum transaksi on-chain


def test_split_verdict_pays_out_and_closes_dispute(env):
    dispute_id = _raise(env).json()["data"]["id"]
    body = {"verdict_action": "SPLIT", "freelancer_share_percentage": 70, "verdict_reasoning": "Dokumentasi kurang"}
    assert env["call"]("POST", f"/{dispute_id}/verdict", "client", json=body).status_code == 403
    r = env["call"]("POST", f"/{dispute_id}/verdict", "arbiter", json=body)
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["status"] == "resolved"
    assert d["milestone"]["status"] == "split"
    assert (d["onchain_status"], d["verdict_action"], d["freelancer_payout"], d["client_refund"], d["transaction_hash"]) == (
        "resolved_onchain", "SPLIT", 4200.0, 1800.0, "0xverdict")
    assert d["verdict"] | {"resolved_at": None} == {
        "action": "SPLIT", "freelancer_share_percentage": 70, "client_refund_percentage": 30,
        "reasoning": "Dokumentasi kurang", "freelancer_payout": 4200.0, "client_refund": 1800.0,
        "transaction_hash": "0xverdict", "resolved_at": None}
    assert env["fake"].calls[-1] == ("verdict", 1, 0, "SPLIT", 70)
    with Session(env["engine"]) as s:  # alur kembali ke milestone berikutnya
        assert s.get(Milestone, env["ids"]["m2"]).status == "in_progress"
    assert env["call"]("POST", f"/{dispute_id}/verdict", "arbiter", json=body).status_code == 409
    files = [("evidence", ("late.txt", b"x", "text/plain"))]
    assert env["call"]("POST", f"/{dispute_id}/evidence", "freelancer", files=files).status_code == 409


@pytest.mark.parametrize("action,payout,refund,status", [
    ("RELEASE", 6000.0, 0.0, "released"), ("REFUND", 0.0, 6000.0, "refunded")])
def test_release_and_refund_verdicts(env, action, payout, refund, status):
    dispute_id = _raise(env).json()["data"]["id"]
    r = env["call"]("POST", f"/{dispute_id}/verdict", "arbiter", json={"verdict_action": action, "verdict_reasoning": "ok"})
    d = r.json()["data"]
    assert (d["verdict"]["freelancer_payout"], d["verdict"]["client_refund"], d["milestone"]["status"]) == (payout, refund, status)
    assert env["fake"].calls[-1] == ("verdict", 1, 0, action, 0)


def test_split_without_percentage_is_rejected(env):
    dispute_id = _raise(env).json()["data"]["id"]
    r = env["call"]("POST", f"/{dispute_id}/verdict", "arbiter", json={"verdict_action": "SPLIT", "verdict_reasoning": "x"})
    assert r.status_code == 422
    assert env["fake"].calls[-1][0] == "raise"


def test_visibility_and_extra_evidence(env):
    dispute_id = _raise(env).json()["data"]["id"]
    files = [("evidence", ("bantahan.pdf", b"%PDF", "application/pdf"))]
    r = env["call"]("POST", f"/{dispute_id}/evidence", "freelancer", files=files)
    assert r.status_code == 201
    assert [e["uploaded_by"]["role"] for e in r.json()["data"]["evidence"]] == ["freelancer"]
    assert env["call"]("POST", f"/{dispute_id}/evidence", "arbiter", files=files).status_code == 403
    for who in ("client", "freelancer", "arbiter"):
        assert [d["id"] for d in env["call"]("GET", "", who).json()["data"]] == [dispute_id]
        assert env["call"]("GET", f"/{dispute_id}", who).status_code == 200
    assert env["call"]("GET", "", "outsider").json()["data"] == []
    assert env["call"]("GET", f"/{dispute_id}", "outsider").status_code == 404
    assert env["call"]("GET", "?status=resolved", "arbiter").json()["data"] == []
