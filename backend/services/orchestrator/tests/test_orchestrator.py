"""Tes alur orchestrator dengan SQLite in-memory dan blockchain palsu (tanpa node Hardhat)."""
import hashlib
import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import models  # noqa: F401
from database import get_db
from models import Dispute, Job, Milestone, User
from services.ai_matching.db_models import JobRequirement
from services.auth.router import AuthToken
from services.invitations.router import Invitation
from services.orchestrator import auto_release, router as orchestrator
from services.orchestrator.db_models import Submission
from services.smart_contract import service as chain

WEI = 10**18


class FakeChain:
    def __init__(self):
        self.balances = {}
        self.calls = []
        self.onchain_hash = None
        self.timed_out = set()

    def user_address(self, uid):
        return f"0x{uid:040x}"

    def token_balance(self, address):
        return self.balances.get(address, 0)

    def faucet(self, address, amount_wei):
        self.balances[address] = self.balances.get(address, 0) + amount_wei
        return {"tx_hash": "0xfaucet", "status": 1}

    def create_and_lock_escrow(self, client_uid, contract_hash, freelancer_address, amounts):
        self.calls.append(("lock", client_uid, contract_hash.hex(), freelancer_address, amounts))
        self.balances[self.user_address(client_uid)] -= sum(amounts)
        self.onchain_hash = contract_hash.hex()
        return {"tx_hash": "0xlock", "status": 1, "contract_id": 7, "escrow_address": "0xescrow"}

    def submit_milestone_onchain(self, uid, cid, index, digest):
        self.calls.append(("submit", uid, cid, index, digest.hex()))
        return {"tx_hash": "0xsubmit", "status": 1}

    def release_milestone_onchain(self, cid, index, client_user_id=None):
        self.calls.append(("release", cid, index, client_user_id))
        return {"tx_hash": "0xrelease", "status": 1}

    def reassign_remaining_onchain(self, client_uid, cid, address):
        self.calls.append(("reassign", client_uid, cid, address))
        return {"tx_hash": "0xreassign", "status": 1}

    def close_contract_onchain(self, cid):
        self.calls.append(("close", cid))
        return {"tx_hash": "0xclose", "status": 1}

    def get_contract(self, cid):
        return {"offchain_contract_hash": self.onchain_hash}

    def review_timeout_reached(self, cid, index):
        return (cid, index) in self.timed_out


@pytest.fixture
def env(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    fake = FakeChain()
    monkeypatch.setattr(orchestrator, "UPLOADS_DIR", tmp_path)
    for name in ("user_address", "token_balance", "faucet", "create_and_lock_escrow", "submit_milestone_onchain",
                 "release_milestone_onchain", "reassign_remaining_onchain", "close_contract_onchain",
                 "get_contract", "review_timeout_reached"):
        monkeypatch.setattr(chain, name, getattr(fake, name))

    with Session(engine) as s:
        users = {n: User(name=n, email=f"{n}@x.id", role=r) for n, r in [
            ("client", "client"), ("freelancer", "freelancer"), ("pengganti", "freelancer"), ("outsider", "client"), ("arbiter", "arbiter")]}
        s.add_all(users.values())
        s.flush()
        job = Job(client_id=users["client"].id, title="Backend API", description="Microservices", budget=15_000_000)
        s.add(job)
        s.flush()
        s.add(JobRequirement(job_id=job.id, category="backend"))
        invs = {n: Invitation(job_id=job.id, client_id=users["client"].id, freelancer_id=users[n].id,
                              alias=f"Candidate-{n}", status="accepted") for n in ("freelancer", "pengganti")}
        s.add_all(invs.values())
        for n, u in users.items():
            s.add(AuthToken(token=n, user_id=u.id, expires_at=time.time() + 3600))
        s.commit()
        ids = {"job": job.id, **{f"inv_{n}": i.id for n, i in invs.items()}, **{n: u.id for n, u in users.items()}}

    def db():
        with Session(engine) as s:
            yield s

    app = FastAPI()
    app.include_router(orchestrator.router)
    app.dependency_overrides[get_db] = db
    client = TestClient(app)

    def call(method, path, who, **kw):
        return client.request(method, "/api/v1" + path, headers={"Authorization": "Bearer " + who, **kw.pop("headers", {})}, **kw)

    return {"call": call, "ids": ids, "fake": fake, "engine": engine}


CONTRACT = {
    "scope": "Bangun backend microservices",
    "start_at": "2026-12-01T00:00:00Z",
    "end_at": "2027-01-31T00:00:00Z",
    "milestones": [
        {"title": "Desain API", "amount": 6000, "criteria": [
            {"description": "ERD 3NF", "is_mandatory": True}, {"description": "Swagger", "is_mandatory": False}]},
        {"title": "Deployment", "amount": 9000, "criteria": [{"description": "docker-compose up jalan"}]},
    ],
}


def _create(env, **override):
    return env["call"]("POST", "/contracts", "client", json={"invitation_id": env["ids"]["inv_freelancer"],
                                                              **CONTRACT, **override})


def _funded(env):
    contract_id = _create(env).json()["data"]["contract_id"]
    env["call"]("POST", "/wallet/faucet", "client", json={"amount": 20000})
    assert env["call"]("POST", "/escrow/lock", "client", json={"contract_id": contract_id}).status_code == 201
    return contract_id


def _milestones(env, who="freelancer"):
    return env["call"]("GET", f"/projects/{env['ids']['job']}/workspace", who).json()["data"]["milestones"]


def _upload(env, who="freelancer", name="erd.pdf", content=b"%PDF-1.4 erd"):
    return env["call"]("POST", "/files", who, files={"file": (name, content, "application/pdf")},
                       data={"purpose": "deliverable"})


def _submit(env, m, file_ids=(), **override):
    body = {"title": "ERD final", "notes": "lihat lampiran", "file_ids": list(file_ids),
            "declared_criteria": [{"criterion_id": c["id"], "declared": True} for c in m["criteria"]], **override}
    return env["call"]("POST", f"/milestones/{m['id']}/submit", "freelancer", json=body,
                       headers={"Idempotency-Key": "k-" + str(m["id"])})


def test_contract_draft_hashes_canonical_terms(env):
    r = _create(env)
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert d["status"] == "draft"
    contract = d["contract"]
    canonical = json.dumps(contract["terms"], sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert d["sha256_hash"] == hashlib.sha256(canonical.encode()).hexdigest() == contract["contract_hash"]
    assert contract["total_amount"] == "15000"
    assert [(m["sequence"], m["status"], m["amount"]) for m in contract["milestones"]] == [
        (1, "pending", "6000"), (2, "pending", "9000")]
    assert [c["is_mandatory"] for c in contract["milestones"][0]["criteria"]] == [True, False]
    assert _create(env).status_code == 409  # satu kontrak per job


def test_contract_draft_rejections(env):
    assert env["call"]("POST", "/contracts", "freelancer", json={"invitation_id": 1, **CONTRACT}).status_code == 403
    assert env["call"]("POST", "/contracts", "outsider",
                       json={"invitation_id": env["ids"]["inv_freelancer"], **CONTRACT}).status_code == 404
    assert _create(env, milestones=[]).status_code == 422
    assert _create(env, end_at="2026-01-01T00:00:00Z").status_code == 422
    with Session(env["engine"]) as s:
        inv = s.get(Invitation, env["ids"]["inv_freelancer"])
        inv.status = "pending"
        s.add(inv)
        s.commit()
    assert _create(env).status_code == 409


def test_lock_requires_balance_then_locks_and_starts_first_milestone(env):
    contract_id = _create(env).json()["data"]["contract_id"]
    r = env["call"]("POST", "/escrow/lock", "client", json={"contract_id": contract_id})
    assert r.status_code == 409 and "faucet" in r.json()["detail"]
    assert env["call"]("POST", "/escrow/lock", "freelancer", json={"contract_id": contract_id}).status_code == 403

    faucet = env["call"]("POST", "/wallet/faucet", "client", json={"amount": 20000}).json()["data"]
    assert faucet["available_balance"] == "20000"
    r = env["call"]("POST", "/escrow/lock", "client", json={"contract_id": contract_id})
    assert r.status_code == 201, r.text
    d = r.json()["data"]
    assert (d["status"], d["locked_amount"], d["onchain_contract_id"], d["token_symbol"]) == ("locked", "15000", 7, "SIM-IDR")
    (call,) = env["fake"].calls
    assert call[0] == "lock" and call[3] == chain.user_address(env["ids"]["freelancer"]) and call[4] == [6000 * WEI, 9000 * WEI]
    assert [m["status"] for m in _milestones(env)] == ["in_progress", "pending"]
    assert env["call"]("POST", "/escrow/lock", "client", json={"contract_id": contract_id}).status_code == 409
    wallet = env["call"]("GET", "/wallet", "client").json()["data"]
    assert (wallet["available_balance"], wallet["locked_in_escrow"]) == ("5000", "15000")
    detail = env["call"]("GET", f"/contracts/{contract_id}", "freelancer").json()["data"]
    assert detail["integrity"]["matches"] is True


def test_full_flow_submit_approve_close(env):
    contract_id = _funded(env)
    projects = env["call"]("GET", "/projects?page=1&page_size=50", "freelancer").json()
    assert projects["meta"]["total"] == 1
    assert projects["data"][0] | {"id": None} == {
        "id": None, "contract_id": contract_id, "title": "Backend API", "category": "backend", "status": "in_progress",
        "description": "Microservices", "expected_start_at": "2026-12-01T00:00:00+00:00",
        "expected_end_at": "2027-01-31T00:00:00+00:00"}

    m1, m2 = _milestones(env)
    assert m1["allowed_actions"] == ["submit", "dispute"]
    file_id = _upload(env).json()["data"]["id"]
    mandatory_only = [{"criterion_id": m1["criteria"][0]["id"], "declared": True}]
    assert _submit(env, m1, declared_criteria=[]).status_code == 422  # kriteria wajib belum dikonfirmasi
    assert _submit(env, m1, repository_url="ftp://x").status_code == 422
    r = _submit(env, m1, [file_id], declared_criteria=mandatory_only)
    assert r.status_code == 200, r.text
    m = r.json()["data"]
    assert m["status"] == "under_review" and m["review_deadline"]
    sub = m["current_submission"]
    assert [f["id"] for f in sub["files"]] == [file_id]
    assert env["fake"].calls[-1] == ("submit", env["ids"]["freelancer"], 7, 0, sub["deliverable_hash"])
    assert _submit(env, m1, [file_id], declared_criteria=mandatory_only).status_code == 200  # replay idempoten
    assert sum(c[0] == "submit" for c in env["fake"].calls) == 1

    assert env["call"]("POST", f"/milestones/{m1['id']}/approve", "freelancer").status_code == 403
    client_view = _milestones(env, "client")[0]
    assert client_view["allowed_actions"] == ["approve", "dispute"]
    r = env["call"]("POST", f"/milestones/{m1['id']}/approve", "client", json={"approval_notes": "sesuai"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert (d["status"], d["disbursed_amount"], d["remaining_escrow_balance"]) == ("disbursed", "6000", "9000")
    assert env["fake"].calls[-1] == ("release", 7, 0, env["ids"]["client"])
    assert [x["status"] for x in _milestones(env)] == ["released", "in_progress"]
    wallet = env["call"]("GET", "/wallet", "freelancer").json()["data"]
    assert (wallet["total_earnings"], wallet["pending_payout"]) == ("6000", "9000")

    assert env["call"]("POST", f"/escrow/{contract_id}/close", "client").status_code == 409  # masih ada milestone
    assert _submit(env, m2, repository_url="https://github.com/x/y").status_code == 200
    assert env["call"]("POST", f"/milestones/{m2['id']}/approve", "client").status_code == 200
    r = env["call"]("POST", f"/escrow/{contract_id}/close", "client")
    assert r.status_code == 200 and r.json()["data"]["status"] == "closed"
    work = env["call"]("GET", f"/projects/{env['ids']['job']}/workspace", "freelancer").json()["data"]
    assert (work["project"]["status"], work["contract"]["status"], work["escrow"]["status"]) == ("completed", "completed", "closed")
    assert work["escrow"]["remaining_locked_amount"] == "0"
    assert [f["id"] for f in work["files"]] == [file_id]
    assert "Contract closed on-chain" in [a["summary"] for a in work["recent_activity"]]


def test_file_upload_and_download_access(env):
    _funded(env)
    assert _upload(env, name="script.exe").status_code == 422
    assert _upload(env, content=b"").status_code == 422
    file_id = _upload(env).json()["data"]["id"]
    assert env["call"]("GET", f"/files/{file_id}/content", "client").status_code == 404  # belum diserahkan
    assert _submit(env, _milestones(env)[0], [file_id]).status_code == 200
    r = env["call"]("GET", f"/files/{file_id}/content", "client")
    assert r.status_code == 200 and r.content == b"%PDF-1.4 erd"
    assert env["call"]("GET", f"/files/{file_id}/content", "outsider").status_code == 404
    assert env["call"]("GET", f"/files/{file_id}/content", "arbiter").status_code == 404
    with Session(env["engine"]) as s:  # arbiter sengketa milestone ini boleh memeriksa hasil kerja
        s.add(Dispute(milestone_id=_milestones(env)[0]["id"], raised_by_id=env["ids"]["client"],
                      arbiter_id=env["ids"]["arbiter"], reason="x"))
        s.commit()
    assert env["call"]("GET", f"/files/{file_id}/content", "arbiter").status_code == 200
    other = _upload(env, who="pengganti").json()["data"]["id"]
    assert _submit(env, _milestones(env)[1], [other]).status_code == 409  # milestone 2 belum dimulai


def test_reassign_moves_remaining_milestones_to_replacement(env):
    contract_id = _funded(env)
    m1 = _milestones(env)[0]
    assert _submit(env, m1, repository_url="https://github.com/x/y").status_code == 200
    r = env["call"]("POST", f"/escrow/{contract_id}/reassign", "client", json={"invitation_id": env["ids"]["inv_pengganti"]})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert (d["reassigned_milestones"], d["new_freelancer"]["name"]) == (2, "pengganti")
    assert env["fake"].calls[-1] == ("reassign", env["ids"]["client"], 7, chain.user_address(env["ids"]["pengganti"]))
    assert env["call"]("GET", f"/projects/{env['ids']['job']}/workspace", "freelancer").status_code == 404
    m1_new, m2_new = _milestones(env, "pengganti")
    assert (m1_new["status"], m1_new["current_submission"], m2_new["status"]) == ("in_progress", None, "pending")
    with Session(env["engine"]) as s:
        assert s.get(Submission, 1).status == "superseded"
    same = env["call"]("POST", f"/escrow/{contract_id}/reassign", "client", json={"invitation_id": env["ids"]["inv_pengganti"]})
    assert same.status_code == 422


def test_auto_release_after_review_timeout(env):
    _funded(env)
    m1 = _milestones(env)[0]
    assert _submit(env, m1, repository_url="https://github.com/x/y").status_code == 200
    with Session(env["engine"]) as s:
        assert auto_release.release_overdue(s) == []
        env["fake"].timed_out.add((7, 0))
        assert auto_release.release_overdue(s) == [m1["id"]]
        assert s.get(Milestone, m1["id"]).status == "released"
    assert env["fake"].calls[-1] == ("release", 7, 0, None)  # ditandatangani platform
    assert [m["status"] for m in _milestones(env)] == ["released", "in_progress"]
