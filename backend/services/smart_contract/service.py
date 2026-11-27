import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3
from web3.logs import DISCARD

load_dotenv()

CONTRACT_STATUSES = {
    0: "ACTIVE",
    1: "CLOSED",
}

MILESTONE_STATUSES = {
    0: "LOCKED",
    1: "SUBMITTED",
    2: "RELEASED",
    3: "DISPUTED",
    4: "REFUNDED",
    5: "SPLIT_SETTLED",
}

VERDICT_ACTIONS = {
    "RELEASE": 0,
    "REFUND": 1,
    "SPLIT": 2,
}

PROJECT_ROOT = Path(__file__).resolve().parents[3]
ARTIFACTS_DIR = PROJECT_ROOT / "blockchain" / "artifacts" / "contracts"


def _load_abi(contract_file: str, contract_name: str) -> list:
    artifact_path = ARTIFACTS_DIR / contract_file / f"{contract_name}.json"
    if not artifact_path.exists():
        raise FileNotFoundError(
            f"Compiled ABI not found at {artifact_path}. "
            "Run `npx hardhat compile` inside /blockchain first."
        )
    with artifact_path.open("r", encoding="utf-8") as f:
        return json.load(f)["abi"]


def get_web3() -> Web3:
    rpc_url = os.getenv("RPC_URL") or os.getenv("WEB3_RPC_URL") or "http://127.0.0.1:8545"
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Unable to connect to Web3 RPC at {rpc_url}")
    return w3


def get_simidr_contract(w3: Web3 | None = None):
    w3 = w3 or get_web3()
    address = os.getenv("SIMIDR_CONTRACT_ADDRESS")
    if not address:
        raise ValueError("SIMIDR_CONTRACT_ADDRESS is not set in environment")
    abi = _load_abi("SIMIDR.sol", "SIMIDR")
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)


def get_escrow_contract(w3: Web3 | None = None):
    w3 = w3 or get_web3()
    address = os.getenv("ESCROW_CONTRACT_ADDRESS")
    if not address:
        raise ValueError("ESCROW_CONTRACT_ADDRESS is not set in environment")
    abi = _load_abi("Escrow.sol", "Escrow")
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=abi)


def _send_signed_tx(w3: Web3, contract_fn, private_key_env: str = "ARBITER_PRIVATE_KEY") -> tuple[str, Any]:
    private_key = os.getenv(private_key_env)
    if not private_key:
        raise ValueError(f"{private_key_env} is not set in environment")
    return _send_tx_with_key(w3, contract_fn, private_key)


def _send_tx_with_key(w3: Web3, contract_fn, private_key) -> tuple[str, Any]:
    account = w3.eth.account.from_key(private_key)
    nonce = w3.eth.get_transaction_count(account.address)

    tx = contract_fn.build_transaction(
        {
            "from": account.address,
            "nonce": nonce,
            "chainId": w3.eth.chain_id,
            "gasPrice": w3.eth.gas_price,
        }
    )
    if "gas" not in tx:
        tx["gas"] = w3.eth.estimate_gas(tx)

    signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)
    raw_tx = getattr(signed_tx, "raw_transaction", None) or signed_tx.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw_tx)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    return Web3.to_hex(tx_hash), receipt


# ------------------------------------------------------------------ wallet dev per user (PROTOTYPE)
# Frontend belum punya wallet (MetaMask), jadi backend memegang wallet setiap user (custodial).
# Wallet diturunkan dari mnemonic bawaan Hardhat pada index 100 + user.id: unik per user, tidak perlu
# disimpan, dan tidak bentrok dengan 20 akun bawaan (index 0-19; #0 platform, #1 arbiter).
# JANGAN dipakai di jaringan sungguhan.
HARDHAT_MNEMONIC = "test test test test test test test test test test test junk"
USER_WALLET_OFFSET = 100
GAS_TOP_UP_WEI = Web3.to_wei(1, "ether")
GAS_MIN_WEI = Web3.to_wei(0.1, "ether")


@lru_cache(maxsize=None)
def user_account(user_id: int):
    """Wallet dev milik user (LocalAccount: .address, .key)."""
    Account.enable_unaudited_hdwallet_features()
    mnemonic = os.getenv("DEV_WALLET_MNEMONIC") or HARDHAT_MNEMONIC
    return Account.from_mnemonic(mnemonic, account_path=f"m/44'/60'/0'/0/{USER_WALLET_OFFSET + int(user_id)}")


def user_address(user_id: int) -> str:
    return user_account(user_id).address


def _platform_key() -> str:
    key = os.getenv("PLATFORM_PRIVATE_KEY")
    if not key:
        raise ValueError("PLATFORM_PRIVATE_KEY is not set in environment")
    return key


def _ensure_gas(w3: Web3, address: str) -> None:
    """Akun platform mengirim ETH lokal bila wallet user hampir habis gas."""
    if w3.eth.get_balance(address) >= GAS_MIN_WEI:
        return
    platform = Account.from_key(_platform_key())
    tx = {"to": address, "value": GAS_TOP_UP_WEI, "from": platform.address, "chainId": w3.eth.chain_id,
          "nonce": w3.eth.get_transaction_count(platform.address), "gas": 21000, "gasPrice": w3.eth.gas_price}
    signed = w3.eth.account.sign_transaction(tx, private_key=platform.key)
    w3.eth.wait_for_transaction_receipt(w3.eth.send_raw_transaction(signed.raw_transaction))


def _send_as_user(w3: Web3, user_id: int, contract_fn) -> tuple[str, Any]:
    account = user_account(user_id)
    _ensure_gas(w3, account.address)
    return _send_tx_with_key(w3, contract_fn, account.key)


def _receipt(tx_hash: str, receipt, **extra) -> Dict[str, Any]:
    return {"tx_hash": tx_hash, "status": receipt["status"], **extra}


def arbiter_address() -> str:
    """Alamat wallet dari ARBITER_PRIVATE_KEY (penanda tangan putusan arbiter)."""
    private_key = os.getenv("ARBITER_PRIVATE_KEY")
    if not private_key:
        raise ValueError("ARBITER_PRIVATE_KEY is not set in environment")
    return Account.from_key(private_key).address


def escrow_address() -> str:
    return get_escrow_contract().address


# ------------------------------------------------------------------ token SIM-IDR
def token_balance(address: str) -> int:
    """Saldo SIM-IDR dalam satuan terkecil (wei, 18 desimal)."""
    return get_simidr_contract().functions.balanceOf(Web3.to_checksum_address(address)).call()


def faucet(address: str, amount_wei: int) -> Dict[str, Any]:
    """Cetak token simulasi ke `address` (fungsi faucet publik SIMIDR), ditandatangani akun platform."""
    w3 = get_web3()
    fn = get_simidr_contract(w3).functions.mint(Web3.to_checksum_address(address), int(amount_wei))
    return _receipt(*_send_tx_with_key(w3, fn, _platform_key()))


# ------------------------------------------------------------------ operasi escrow (EscrowPaymentContract)
def create_and_lock_escrow(client_user_id: int, contract_hash: bytes, freelancer_address: str,
                           milestone_amounts_wei: List[int]) -> Dict[str, Any]:
    """Client menyetujui token lalu mengunci seluruh dana milestone sekaligus. Arbiter = default Escrow.sol."""
    w3 = get_web3()
    escrow = get_escrow_contract(w3)
    total = sum(milestone_amounts_wei)
    _send_as_user(w3, client_user_id, get_simidr_contract(w3).functions.approve(escrow.address, total))
    fn = escrow.functions.createAndLockEscrow(
        contract_hash, Web3.to_checksum_address(freelancer_address), "0x" + "0" * 40,
        [int(a) for a in milestone_amounts_wei],
    )
    tx_hash, receipt = _send_as_user(w3, client_user_id, fn)
    (event,) = escrow.events.EscrowCreatedAndLocked().process_receipt(receipt, errors=DISCARD)  # abaikan event Transfer token
    return _receipt(tx_hash, receipt, contract_id=event["args"]["contractId"], escrow_address=escrow.address)


def submit_milestone_onchain(freelancer_user_id: int, contract_id: int, milestone_index: int,
                             deliverable_hash: bytes) -> Dict[str, Any]:
    """Freelancer mencatat hash hasil kerja; memulai timer review 5 hari di smart contract."""
    w3 = get_web3()
    fn = get_escrow_contract(w3).functions.submitMilestone(int(contract_id), int(milestone_index), deliverable_hash)
    return _receipt(*_send_as_user(w3, freelancer_user_id, fn))


def release_milestone_onchain(contract_id: int, milestone_index: int, client_user_id: int | None = None) -> Dict[str, Any]:
    """Cairkan milestone ke freelancer. client_user_id=None: auto-release setelah timeout, ditandatangani platform."""
    w3 = get_web3()
    fn = get_escrow_contract(w3).functions.releaseMilestonePayment(int(contract_id), int(milestone_index))
    if client_user_id is None:
        return _receipt(*_send_tx_with_key(w3, fn, _platform_key()))
    return _receipt(*_send_as_user(w3, client_user_id, fn))


def request_revision_onchain(client_user_id: int, contract_id: int, milestone_index: int) -> Dict[str, Any]:
    """Client menolak hasil dan minta perbaikan: milestone kembali LOCKED, timer review 5 hari berhenti."""
    w3 = get_web3()
    fn = get_escrow_contract(w3).functions.requestRevision(int(contract_id), int(milestone_index))
    return _receipt(*_send_as_user(w3, client_user_id, fn))


def reassign_remaining_onchain(client_user_id: int, contract_id: int, new_freelancer_address: str) -> Dict[str, Any]:
    w3 = get_web3()
    fn = get_escrow_contract(w3).functions.reassignRemainingMilestones(
        int(contract_id), Web3.to_checksum_address(new_freelancer_address))
    return _receipt(*_send_as_user(w3, client_user_id, fn))


def raise_dispute_onchain(user_id: int, contract_id: int, milestone_index: int) -> Dict[str, Any]:
    """Bekukan milestone (status DISPUTED). Penanda tangan wajib client atau freelancer milestone tsb."""
    w3 = get_web3()
    fn = get_escrow_contract(w3).functions.raiseDispute(int(contract_id), int(milestone_index))
    return _receipt(*_send_as_user(w3, user_id, fn), contract_id=contract_id, milestone_index=milestone_index)


def review_timeout_reached(contract_id: int, milestone_index: int) -> bool:
    """True bila milestone SUBMITTED dan 5 hari review sudah lewat menurut waktu blok terakhir."""
    w3 = get_web3()
    escrow = get_escrow_contract(w3)
    _, _, status, submitted_at, _ = escrow.functions.milestones(int(contract_id), int(milestone_index)).call()
    timeout = escrow.functions.REVIEW_TIMEOUT().call()
    now = w3.eth.get_block("latest")["timestamp"]
    return MILESTONE_STATUSES.get(status) == "SUBMITTED" and submitted_at > 0 and now >= submitted_at + timeout


def get_contract(contract_id: int) -> Dict[str, Any]:
    """Read on-chain EscrowContract summary and all milestones."""
    w3 = get_web3()
    escrow = get_escrow_contract(w3)
    (
        offchain_hash,
        client,
        freelancer,
        arbiter,
        total_locked,
        total_released,
        milestone_count,
        status_int,
    ) = escrow.functions.contracts(contract_id).call()

    raw_milestones = escrow.functions.getContractMilestones(contract_id).call()
    milestones_list: List[Dict[str, Any]] = [
        {
            "index": idx,
            "amount": m[0],
            "freelancer": m[1],
            "status_code": m[2],
            "status": MILESTONE_STATUSES.get(m[2], "UNKNOWN"),
            "submitted_at": m[3],
            "deliverable_hash": m[4].hex(),
        }
        for idx, m in enumerate(raw_milestones)
    ]

    return {
        "contract_id": contract_id,
        "offchain_contract_hash": offchain_hash.hex(),
        "client": client,
        "freelancer": freelancer,
        "arbiter": arbiter,
        "total_locked": total_locked,
        "total_released": total_released,
        "milestone_count": milestone_count,
        "status_code": status_int,
        "status": CONTRACT_STATUSES.get(status_int, "UNKNOWN"),
        "milestones": milestones_list,
    }


def execute_arbiter_verdict_onchain(
    contract_id: int,
    milestone_index: int,
    verdict_action: str,
    freelancer_share_percentage: int = 0,
) -> Dict[str, Any]:
    """Execute binding arbiter verdict (RELEASE, REFUND, or SPLIT) signed by ARBITER_PRIVATE_KEY."""
    action_key = verdict_action.upper()
    if action_key not in VERDICT_ACTIONS:
        raise ValueError(f"Invalid verdict_action '{verdict_action}'. Must be RELEASE, REFUND, or SPLIT.")

    w3 = get_web3()
    escrow = get_escrow_contract(w3)
    fn = escrow.functions.executeArbiterVerdict(
        int(contract_id),
        int(milestone_index),
        VERDICT_ACTIONS[action_key],
        int(freelancer_share_percentage),
    )
    tx_hash, receipt = _send_signed_tx(w3, fn, "ARBITER_PRIVATE_KEY")

    return {
        "tx_hash": tx_hash,
        "status": receipt["status"],
        "contract_id": contract_id,
        "milestone_index": milestone_index,
        "verdict_action": action_key,
        "freelancer_share_percentage": freelancer_share_percentage,
    }


def close_contract_onchain(contract_id: int) -> Dict[str, Any]:
    """Permanently close a settled escrow contract signed by ARBITER_PRIVATE_KEY."""
    w3 = get_web3()
    escrow = get_escrow_contract(w3)
    fn = escrow.functions.closeContract(int(contract_id))
    tx_hash, receipt = _send_signed_tx(w3, fn, "ARBITER_PRIVATE_KEY")

    return {
        "tx_hash": tx_hash,
        "status": receipt["status"],
        "contract_id": contract_id,
    }
