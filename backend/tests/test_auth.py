import time

from auth import create_token, decode_token, JWT_SECRET, JWT_ALGORITHM
import jwt


def test_create_and_decode_token() -> None:
    token = create_token(user_id=1, username="alice")
    payload = decode_token(token)
    assert payload is not None
    assert payload["user_id"] == 1
    assert payload["username"] == "alice"


def test_decode_invalid_token_returns_none() -> None:
    result = decode_token("not.a.valid.token")
    assert result is None


def test_decode_expired_token_returns_none() -> None:
    payload = {
        "sub": 1,
        "username": "alice",
        "exp": int(time.time()) - 3600,
        "iat": int(time.time()) - 7200,
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    result = decode_token(token)
    assert result is None


def test_decode_token_with_wrong_secret_returns_none() -> None:
    payload = {
        "sub": 1,
        "username": "alice",
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    token = jwt.encode(payload, "wrong-secret", algorithm=JWT_ALGORITHM)
    result = decode_token(token)
    assert result is None
