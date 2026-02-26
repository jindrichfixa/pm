import asyncio
import json

import httpx
import pytest

from ai import (
    MissingApiKeyError,
    OpenRouterUpstreamError,
    request_openrouter_completion,
    request_openrouter_structured_output,
)


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _FakeAsyncClient:
    last_headers = None
    last_json = None

    def __init__(self, timeout: float):
        self.timeout = timeout

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url: str, headers: dict, json: dict):
        _FakeAsyncClient.last_headers = headers
        _FakeAsyncClient.last_json = json
        return _FakeResponse(
            200,
            {
                "choices": [
                    {
                        "message": {
                            "content": "4",
                        }
                    }
                ]
            },
        )


def test_request_openrouter_completion_requires_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(MissingApiKeyError):
        asyncio.run(request_openrouter_completion("2+2"))


def test_request_openrouter_completion_shapes_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("ai.httpx.AsyncClient", _FakeAsyncClient)

    response = asyncio.run(request_openrouter_completion("2+2"))

    assert response == "4"
    assert _FakeAsyncClient.last_headers is not None
    assert _FakeAsyncClient.last_headers["Authorization"] == "Bearer test-key"
    assert _FakeAsyncClient.last_json is not None
    assert _FakeAsyncClient.last_json["model"] == "openai/gpt-oss-120b"
    assert _FakeAsyncClient.last_json["messages"] == [{"role": "user", "content": "2+2"}]


def test_request_openrouter_completion_handles_upstream_status(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _ErrorClient(_FakeAsyncClient):
        async def post(self, url: str, headers: dict, json: dict):
            return _FakeResponse(502, {"error": "bad gateway"})

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("ai.httpx.AsyncClient", _ErrorClient)

    with pytest.raises(OpenRouterUpstreamError):
        asyncio.run(request_openrouter_completion("2+2"))


def test_request_openrouter_completion_handles_http_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _RaisingClient(_FakeAsyncClient):
        async def post(self, url: str, headers: dict, json: dict):
            raise httpx.ReadTimeout("timeout")

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("ai.httpx.AsyncClient", _RaisingClient)

    with pytest.raises(OpenRouterUpstreamError):
        asyncio.run(request_openrouter_completion("2+2"))


def test_request_openrouter_structured_output_parses_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _StructuredClient(_FakeAsyncClient):
        async def post(self, url: str, headers: dict, json: dict):
            _StructuredClient.last_headers = headers
            _StructuredClient.last_json = json
            return _FakeResponse(
                200,
                {
                    "choices": [
                        {
                            "message": {
                                "content": '{"assistant_message":"Done","board_update":null}'
                            }
                        }
                    ]
                },
            )

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("ai.httpx.AsyncClient", _StructuredClient)

    response = asyncio.run(
        request_openrouter_structured_output(
            board={"columns": [], "cards": {}},
            user_message="summarize",
            conversation_history=[{"role": "user", "content": "hello"}],
        )
    )

    assert response == {"assistant_message": "Done", "board_update": None}
    assert _StructuredClient.last_json is not None
    assert _StructuredClient.last_json["model"] == "openai/gpt-oss-120b"


def test_request_openrouter_structured_output_rejects_non_json_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class _BadStructuredClient(_FakeAsyncClient):
        async def post(self, url: str, headers: dict, json: dict):
            return _FakeResponse(
                200,
                {
                    "choices": [
                        {
                            "message": {
                                "content": "not json"
                            }
                        }
                    ]
                },
            )

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("ai.httpx.AsyncClient", _BadStructuredClient)

    with pytest.raises(OpenRouterUpstreamError):
        asyncio.run(
            request_openrouter_structured_output(
                board={"columns": [], "cards": {}},
                user_message="summarize",
                conversation_history=[],
            )
        )
