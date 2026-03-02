from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app, _STATIC_INDEX

client = TestClient(app)

_MINIMAL_HTML = "<html><body>test</body></html>"


@pytest.fixture()
def _static_index(tmp_path: Path) -> None:  # noqa: PT004
    """Ensure static/index.html exists for the duration of the test."""
    created = False
    _STATIC_INDEX.parent.mkdir(parents=True, exist_ok=True)
    if not _STATIC_INDEX.exists():
        _STATIC_INDEX.write_text(_MINIMAL_HTML)
        created = True
    yield
    if created:
        _STATIC_INDEX.unlink(missing_ok=True)


@pytest.mark.usefixtures("_static_index")
def test_root_serves_html() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()
