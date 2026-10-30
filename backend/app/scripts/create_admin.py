from getpass import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main() -> None:
    full_name = input("Administrator name: ").strip()
    email = input("Administrator email: ").strip().lower()
    password = getpass("Administrator password (at least 8 characters): ")
    confirmation = getpass("Confirm password: ")

    if len(full_name) < 2:
        raise SystemExit("Name must contain at least 2 characters.")
    if len(password) < 8 or len(password) > 128:
        raise SystemExit("Password must contain 8 to 128 characters.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    with SessionLocal() as database:
        if database.scalar(select(User).where(User.email == email)) is not None:
            raise SystemExit("An account with this email already exists.")
        database.add(
            User(
                full_name=full_name,
                email=email,
                hashed_password=hash_password(password),
                role="admin",
            )
        )
        database.commit()

    print(f"Administrator account created for {email}.")


if __name__ == "__main__":
    main()
