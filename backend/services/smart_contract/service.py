import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from eth_account import Account
from web3 import Web3

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


# Mnemonic bawaan Hardhat: 20 akun test di jaringan lokal (chainId 31337).
HARDHAT_MNEMONIC = "test test test test test test test test test test test junk"


@lru_cache(maxsize=1)
def _dev_wallet_keys() -> Dict[str, bytes]:
    Account.enable_unaudited_hdwallet_features()
    mnemonic = os.getenv("DEV_WALLET_MNEMONIC") or HARDHAT_MNEMONIC
    accounts = (Account.from_mnemonic(mnemonic, account_path=f"m/44'/60'/0'/0/{i}") for i in range(20))
    return {a.address.lower(): a.key for a in accounts}


def dev_private_key_for(address: str) -> bytes:
    """PROTOTYPE SAJA: private key akun dev Hardhat untuk `address`.

    Frontend belum punya wallet (MetaMask), jadi backend menandatangani transaksi atas nama
    client/freelancer memakai akun test Hardhat. Jangan dipakai di jaringan sungguhan.
    """
    key = _dev_wallet_keys().get(address.lower())
    if key is None:
        raise ValueError(f"Wallet {address} bukan akun dev Hardhat; private key tidak tersedia.")
    return key


def arbiter_address() -> str:
    """Alamat wallet dari ARBITER_PRIVATE_KEY (penanda tangan putusan arbiter)."""
    private_key = os.getenv("ARBITER_PRIVATE_KEY")
    if not private_key:
        raise ValueError("ARBITER_PRIVATE_KEY is not set in environment")
    return Account.from_key(private_key).address


def raise_dispute_onchain(contract_id: int, milestone_index: int, signer_private_key) -> Dict[str, Any]:
    """Bekukan milestone (status DISPUTED). Penanda tangan wajib client atau freelancer milestone tsb."""
    w3 = get_web3()
    escrow = get_escrow_contract(w3)
    fn = escrow.functions.raiseDispute(int(contract_id), int(milestone_index))
    tx_hash, receipt = _send_tx_with_key(w3, fn, signer_private_key)
    return {
        "tx_hash": tx_hash,
        "status": receipt["status"],
        "contract_id": contract_id,
        "milestone_index": milestone_index,
    }


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
