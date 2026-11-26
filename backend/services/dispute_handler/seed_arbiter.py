"""Buat akun arbiter untuk login dan pemutusan sengketa (aman dijalankan berulang).

Jalankan dari folder backend:  python -m services.dispute_handler.seed_arbiter
Wallet arbiter = alamat ARBITER_PRIVATE_KEY, yaitu arbiter default Escrow.sol saat deploy lokal.
"""
from sqlmodel import Session, select

import models  # noqa: F401  (mendaftarkan tabel tim)
from database import engine, init_db
from models import User
from services.smart_contract.service import arbiter_address

EMAIL = "arbiter@example.com"


def main() -> None:
    init_db()
    wallet = arbiter_address()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == EMAIL)).first()
        if user is None:
            user = User(name="Arbiter Gigly", email=EMAIL, password="1234", role="arbiter")
        user.wallet_address = wallet
        session.add(user)
        session.commit()
        print(f"arbiter id={user.id} email={EMAIL} password=1234 wallet={wallet}")


if __name__ == "__main__":
    main()
