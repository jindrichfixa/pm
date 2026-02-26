import os
import json
from typing import Any

import httpx

OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b"


class MissingApiKeyError(RuntimeError):
    pass


class OpenRouterUpstreamError(RuntimeError):
    pass


def _extract_assistant_message(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise OpenRouterUpstreamError("OpenRouter response did not include choices.")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise OpenRouterUpstreamError("OpenRouter response choice is invalid.")

    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise OpenRouterUpstreamError("OpenRouter response message is invalid.")

    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise OpenRouterUpstreamError("OpenRouter response content is empty.")

    return content.strip()


def _extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        raise OpenRouterUpstreamError("OpenRouter response content is empty.")

    try:
        parsed = json.loads(text)
    except ValueError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise OpenRouterUpstreamError(
                "OpenRouter response did not contain valid JSON output."
            ) from None

        snippet = text[start : end + 1]
        try:
            parsed = json.loads(snippet)
        except ValueError as error:
            raise OpenRouterUpstreamError(
                "OpenRouter response did not contain valid JSON output."
            ) from error

    if not isinstance(parsed, dict):
        raise OpenRouterUpstreamError("OpenRouter JSON output must be an object.")

    return parsed


async def request_openrouter_completion(prompt: str, timeout_seconds: float = 20.0) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise MissingApiKeyError("OPENROUTER_API_KEY is not configured.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                OPENROUTER_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as error:
        raise OpenRouterUpstreamError("Failed to reach OpenRouter.") from error

    if response.status_code >= 400:
        raise OpenRouterUpstreamError(
            f"OpenRouter request failed with status {response.status_code}."
        )

    try:
        response_payload = response.json()
    except ValueError as error:
        raise OpenRouterUpstreamError("OpenRouter response was not valid JSON.") from error

    if not isinstance(response_payload, dict):
        raise OpenRouterUpstreamError("OpenRouter response payload is invalid.")

    return _extract_assistant_message(response_payload)


async def request_openrouter_structured_output(
    board: dict[str, Any],
    user_message: str,
    conversation_history: list[dict[str, str]],
    timeout_seconds: float = 30.0,
) -> dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key:
        raise MissingApiKeyError("OPENROUTER_API_KEY is not configured.")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    system_prompt = (
        "You are a project-management assistant. "
        "Return only valid JSON with this schema: "
        "{\"assistant_message\": string, \"board_update\": optional object}. "
        "If board_update is included, it may contain \"board\" with a full board object. "
        "Do not include markdown code fences."
    )

    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for item in conversation_history:
        role = item.get("role", "")
        content = item.get("content", "")
        if role in {"user", "assistant", "system"} and isinstance(content, str):
            messages.append({"role": role, "content": content})

    messages.append(
        {
            "role": "user",
            "content": (
                "Current board JSON:\n"
                f"{json.dumps(board, ensure_ascii=False)}\n\n"
                "User request:\n"
                f"{user_message}\n\n"
                "Respond with valid JSON only."
            ),
        }
    )

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": messages,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                OPENROUTER_CHAT_COMPLETIONS_URL,
                headers=headers,
                json=payload,
            )
    except httpx.HTTPError as error:
        raise OpenRouterUpstreamError("Failed to reach OpenRouter.") from error

    if response.status_code >= 400:
        raise OpenRouterUpstreamError(
            f"OpenRouter request failed with status {response.status_code}."
        )

    try:
        response_payload = response.json()
    except ValueError as error:
        raise OpenRouterUpstreamError("OpenRouter response was not valid JSON.") from error

    if not isinstance(response_payload, dict):
        raise OpenRouterUpstreamError("OpenRouter response payload is invalid.")

    content = _extract_assistant_message(response_payload)
    return _extract_json_object(content)
