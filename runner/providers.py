"""Model API adapters.

Each adapter turns one frame into a :class:`FrameOutcome`. Call shape, retry
policy, refusal detection and JSON extraction all follow the published eval
scripts:

* Anthropic follows ``s51`` — native ``messages.create`` with a base64 image
  block, and ``stop_reason == "refusal"`` surfaced with its ``stop_details``.
* OpenAI follows ``s54`` — chat completions with a data-URL image and
  ``max_completion_tokens``, plus the ``message.refusal`` field.
* OpenRouter follows ``s55`` — the OpenAI SDK pointed at OpenRouter.
* Google reuses the OpenAI adapter against Gemini's OpenAI-compatible endpoint,
  because no published script calls Gemini natively and reusing the OpenAI path
  keeps parsing and refusal handling identical to the benchmarked runs.
"""

from __future__ import annotations

import base64
import re
import time
from dataclasses import dataclass, field
from typing import Never, Protocol

from anthropic import Anthropic, APIError
from openai import OpenAI

from runner.config import (
    MAX_OUTPUT_TOKENS,
    MAX_RETRIES,
    MEDIA_TYPES,
    RETRY_BASE_DELAY,
    TEMPERATURE,
    ServiceConfig,
)
from runner.prompts import ToolDetectionResult

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# Moderation-style API errors and refusal-style openings in free text, verbatim
# from s54/s55 so refusal rates stay comparable with the published runs.
MODERATION_ERROR_RE = re.compile(
    r"moderation|flagged|content policy|content_policy", re.IGNORECASE
)
REFUSAL_TEXT_RE = re.compile(
    r"(i['\u2019]?m sorry|i apolog|i can['\u2019]?not|i can['\u2019]?t"
    r"|i am unable|i['\u2019]?m unable|unable to (assist|help|identify)"
    r"|cannot (assist|help|identify|provide))",
    re.IGNORECASE,
)

# OpenRouter slug prefix used when falling back for a natively-unsupported model.
FAMILY_TO_OPENROUTER_PREFIX = {
    "openai": "openai",
    "anthropic": "anthropic",
    "google": "google",
}

# ------------------------------------------------------------------ outcome


@dataclass
class FrameOutcome:
    """Result of scoring a single frame.

    Attributes:
        predicted_tools: Validated, de-duplicated, sorted tool names.
        status: One of "success", "parse_error", "refusal", "skip".
        raw_response: Model text, or a description of the failure.
        stop_reason: Provider stop reason when exposed.
        refusal_category: Anthropic safety-classifier category, when present.
        refusal_explanation: Anthropic safety-classifier explanation.
        usage: Token counts keyed as the published scripts key them.
    """

    predicted_tools: list[str]
    status: str
    raw_response: str
    stop_reason: str | None = None
    refusal_category: str | None = None
    refusal_explanation: str | None = None
    usage: dict[str, int] = field(default_factory=dict)


class ModelAdapter(Protocol):
    """Scores one frame against one model."""

    name: str
    model_api_id: str

    def score_frame(self, prompt: str, image_bytes: bytes, suffix: str,
                    valid_tools: list[str]) -> FrameOutcome:
        """Send one frame to the model and classify the outcome."""
        ...


# ------------------------------------------------------------------ parsing


def parse_tool_response(raw_text: str, valid_tools: list[str]) -> tuple[list[str], str]:
    """Extract the tool list from a model response.

    Mirrors the published scripts: take the outermost ``{...}`` span, validate
    it against the schema, then reject any name outside the ontology. Anything
    that fails is scored as a wrong (empty) prediction, and refusal-shaped text
    is separated out so refusal rates stay reportable.

    Args:
        raw_text: The model's text response.
        valid_tools: The dataset's instrument vocabulary.

    Returns:
        A ``(predicted_tools, status)`` pair where status is "success",
        "parse_error" or "refusal".
    """
    json_start = raw_text.find("{")
    json_end = raw_text.rfind("}") + 1
    candidate = (
        raw_text[json_start:json_end]
        if json_start != -1 and json_end > json_start
        else raw_text
    )

    try:
        result = ToolDetectionResult.model_validate_json(candidate)
    except Exception:
        status = "refusal" if REFUSAL_TEXT_RE.search(raw_text) else "parse_error"
        return [], status

    invalid = set(result.detected_tools) - set(valid_tools)
    if invalid:
        return [], "parse_error"

    return sorted(set(result.detected_tools)), "success"


def _media_type(suffix: str) -> str:
    """Map a file suffix to its image media type.

    Raises:
        ValueError: If the suffix is not one the datasets use.
    """
    media_type = MEDIA_TYPES.get(suffix.lower())
    if media_type is None:
        raise ValueError(
            f"unsupported frame suffix {suffix!r}; expected one of {sorted(MEDIA_TYPES)}"
        )
    return media_type


# ---------------------------------------------------------------- adapters


class AnthropicAdapter:
    """Calls the Anthropic Messages API directly, following ``s51``."""

    def __init__(self, api_key: str, model_api_id: str) -> None:
        self.name = "anthropic"
        self.model_api_id = model_api_id
        self._client = Anthropic(api_key=api_key)

    def score_frame(self, prompt: str, image_bytes: bytes, suffix: str,
                    valid_tools: list[str]) -> FrameOutcome:
        """Score one frame, classifying refusals and technical skips."""
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": _media_type(suffix),
                            "data": base64.b64encode(image_bytes).decode("utf-8"),
                        },
                    },
                ],
            }
        ]

        response = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self._client.messages.create(
                    model=self.model_api_id,
                    max_tokens=MAX_OUTPUT_TOKENS,
                    temperature=TEMPERATURE,
                    messages=messages,
                )
                break
            except APIError as error:
                if MODERATION_ERROR_RE.search(repr(error)):
                    return FrameOutcome(
                        predicted_tools=[],
                        status="refusal",
                        raw_response=f"Moderation error: {error!r}",
                    )
                if attempt == MAX_RETRIES - 1:
                    return FrameOutcome(
                        predicted_tools=[],
                        status="skip",
                        raw_response=(
                            f"API error after {MAX_RETRIES} retries: {error!r}"
                        ),
                    )
                time.sleep(RETRY_BASE_DELAY * (2 ** attempt))

        usage = {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }

        if response.stop_reason == "refusal":
            stop_details = getattr(response, "stop_details", None)
            return FrameOutcome(
                predicted_tools=[],
                status="refusal",
                raw_response="",
                stop_reason=response.stop_reason,
                refusal_category=getattr(stop_details, "category", None),
                refusal_explanation=getattr(stop_details, "explanation", None),
                usage=usage,
            )

        raw_text = "".join(
            block.text for block in response.content if block.type == "text"
        )
        predicted_tools, status = parse_tool_response(raw_text, valid_tools)
        return FrameOutcome(
            predicted_tools=predicted_tools,
            status=status,
            raw_response=raw_text,
            stop_reason=response.stop_reason,
            usage=usage,
        )


class OpenAICompatibleAdapter:
    """Calls any OpenAI-compatible chat endpoint, following ``s54``/``s55``.

    Covers the native OpenAI API, OpenRouter, and Gemini's OpenAI-compatible
    endpoint. Reasoning models bill their reasoning tokens against the output
    cap, so ``max_completion_tokens`` is used for the native OpenAI API and
    ``max_tokens`` elsewhere, exactly as the published scripts do.
    """

    def __init__(self, name: str, api_key: str, model_api_id: str,
                 base_url: str | None, uses_completion_token_cap: bool) -> None:
        self.name = name
        self.model_api_id = model_api_id
        self._uses_completion_token_cap = uses_completion_token_cap
        self._client = (
            OpenAI(api_key=api_key)
            if base_url is None
            else OpenAI(api_key=api_key, base_url=base_url)
        )

    def _token_cap_kwargs(self) -> dict[str, int]:
        """Output-token cap keyword accepted by this endpoint."""
        if self._uses_completion_token_cap:
            return {"max_completion_tokens": MAX_OUTPUT_TOKENS}
        return {"max_tokens": MAX_OUTPUT_TOKENS}

    def score_frame(self, prompt: str, image_bytes: bytes, suffix: str,
                    valid_tools: list[str]) -> FrameOutcome:
        """Score one frame, classifying refusals and technical skips."""
        data_url = (
            f"data:{_media_type(suffix)};base64,"
            f"{base64.b64encode(image_bytes).decode('utf-8')}"
        )
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ]

        raw_text = ""
        refusal_text = None
        usage: dict[str, int] = {}

        for attempt in range(MAX_RETRIES):
            try:
                response = self._client.chat.completions.create(
                    model=self.model_api_id,
                    messages=messages,
                    temperature=TEMPERATURE,
                    **self._token_cap_kwargs(),
                )
                raw_text = response.choices[0].message.content or ""
                refusal_text = getattr(response.choices[0].message, "refusal", None)
                if response.usage is not None:
                    usage = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }
                break
            except Exception as error:
                if MODERATION_ERROR_RE.search(repr(error)):
                    return FrameOutcome(
                        predicted_tools=[],
                        status="refusal",
                        raw_response=f"Moderation error: {error!r}",
                    )
                if attempt == MAX_RETRIES - 1:
                    return FrameOutcome(
                        predicted_tools=[],
                        status="skip",
                        raw_response=(
                            f"API error after {MAX_RETRIES} retries: {error!r}"
                        ),
                    )
                time.sleep(RETRY_BASE_DELAY * (2 ** attempt))

        if refusal_text:
            return FrameOutcome(
                predicted_tools=[],
                status="refusal",
                raw_response=f"Refusal: {refusal_text}",
                usage=usage,
            )

        predicted_tools, status = parse_tool_response(raw_text, valid_tools)
        return FrameOutcome(
            predicted_tools=predicted_tools,
            status=status,
            raw_response=raw_text,
            usage=usage,
        )


# --------------------------------------------------------------- resolution


@dataclass(frozen=True)
class AdapterChoice:
    """Which provider will actually serve the job, and why.

    Attributes:
        adapter: The constructed adapter.
        requested_provider: ``api_provider`` as submitted.
        effective_provider: Provider actually used, after any fallback.
        effective_model_api_id: Model identifier actually sent on the wire.
        fallback_reason: Why the fallback fired, or None if none did.
    """

    adapter: ModelAdapter
    requested_provider: str
    effective_provider: str
    effective_model_api_id: str
    fallback_reason: str | None


def to_openrouter_slug(model_api_id: str, api_provider: str) -> str:
    """Map a native model identifier onto an OpenRouter slug.

    Args:
        model_api_id: Identifier as submitted.
        api_provider: The originally requested provider.

    Returns:
        An OpenRouter ``vendor/model`` slug.

    Raises:
        ValueError: If no prefix is known for the provider.
    """
    if "/" in model_api_id:
        return model_api_id
    prefix = FAMILY_TO_OPENROUTER_PREFIX.get(api_provider)
    if prefix is None:
        raise ValueError(
            f"cannot build an OpenRouter slug for provider {api_provider!r} "
            f"and model {model_api_id!r}; submit a full vendor/model slug"
        )
    return f"{prefix}/{model_api_id}"


def _native_api_key(api_provider: str, config: ServiceConfig) -> str | None:
    """Return the key for a natively-supported provider, or None if unset."""
    if api_provider == "openai":
        return config.openai_api_key
    if api_provider == "anthropic":
        return config.anthropic_api_key
    if api_provider == "google":
        return config.gemini_api_key
    if api_provider == "openrouter":
        return config.openrouter_api_key
    _never: Never = api_provider
    raise AssertionError(f"unhandled api_provider: {_never}")


def _build_native_adapter(api_provider: str, api_key: str,
                          model_api_id: str) -> ModelAdapter:
    """Construct the adapter for a natively-supported provider."""
    if api_provider == "anthropic":
        return AnthropicAdapter(api_key=api_key, model_api_id=model_api_id)
    if api_provider == "openai":
        return OpenAICompatibleAdapter(
            name="openai", api_key=api_key, model_api_id=model_api_id,
            base_url=None, uses_completion_token_cap=True,
        )
    if api_provider == "google":
        return OpenAICompatibleAdapter(
            name="google", api_key=api_key, model_api_id=model_api_id,
            base_url=GEMINI_OPENAI_BASE_URL, uses_completion_token_cap=False,
        )
    if api_provider == "openrouter":
        return OpenAICompatibleAdapter(
            name="openrouter", api_key=api_key, model_api_id=model_api_id,
            base_url=OPENROUTER_BASE_URL, uses_completion_token_cap=False,
        )
    _never: Never = api_provider
    raise AssertionError(f"unhandled api_provider: {_never}")


_OPENROUTER_MODEL_IDS: frozenset[str] | None = None


def _openrouter_model_ids(api_key: str) -> frozenset[str]:
    """Fetch the OpenRouter catalogue once per process.

    OpenRouter has no per-model retrieve endpoint that works, so existence is
    checked against the catalogue. The catalogue is cached for the life of the
    process: a newly listed model mid-day needs a worker restart to be seen,
    which is acceptable for an intake gate.
    """
    global _OPENROUTER_MODEL_IDS
    if _OPENROUTER_MODEL_IDS is None:
        client = OpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)
        _OPENROUTER_MODEL_IDS = frozenset(model.id for model in client.models.list())
    return _OPENROUTER_MODEL_IDS


def verify_model_available(
    api_provider: str, model_api_id: str, config: ServiceConfig
) -> AdapterChoice:
    """Confirm the requested model is callable before a multi-hour eval starts.

    Resolves the same adapter the worker will use (including OpenRouter
    fallback), then asks the provider whether that model id exists. A typo that
    would otherwise burn a night of retries is rejected here with a clear error.

    Args:
        api_provider: Requested provider.
        model_api_id: Requested model identifier.
        config: Resolved service configuration.

    Returns:
        The resolved adapter choice, so callers can log what will actually run.

    Raises:
        ValueError: If the model is unknown to the provider that would serve it.
        RuntimeError: If no API key is configured for the request.
    """
    choice = resolve_adapter(api_provider, model_api_id, config)
    effective = choice.effective_provider
    model_id = choice.effective_model_api_id

    if effective == "openrouter":
        known = _openrouter_model_ids(config.openrouter_api_key or "")
        if model_id not in known:
            raise ValueError(
                f"OpenRouter has no model {model_id!r}. Check the id against "
                f"https://openrouter.ai/models (typos are not queued)."
            )
        return choice

    if effective in ("openai", "google"):
        key = _native_api_key(effective, config)
        if key is None:
            raise RuntimeError(f"No API key configured for {effective!r}")
        base_url = None if effective == "openai" else GEMINI_OPENAI_BASE_URL
        client = OpenAI(api_key=key, base_url=base_url)
        try:
            client.models.retrieve(model_id)
        except Exception as error:
            raise ValueError(
                f"{effective} does not recognise model {model_id!r}: {error}"
            ) from error
        return choice

    if effective == "anthropic":
        key = config.anthropic_api_key
        if key is None:
            raise RuntimeError("No API key configured for anthropic")
        client = Anthropic(api_key=key)
        try:
            known = {model.id for model in client.models.list()}
        except Exception as error:
            raise ValueError(
                f"Could not list Anthropic models to verify {model_id!r}: {error}"
            ) from error
        if model_id not in known:
            raise ValueError(
                f"Anthropic has no model {model_id!r}. Check the id and try again."
            )
        return choice

    raise AssertionError(f"unhandled effective provider: {effective!r}")


def resolve_adapter(api_provider: str, model_api_id: str,
                    config: ServiceConfig) -> AdapterChoice:
    """Pick the adapter for a job, falling back to OpenRouter when needed.

    The choice is made once per job rather than per request: a run that silently
    switched providers halfway through would produce numbers that are not
    attributable to either endpoint.

    Args:
        api_provider: Requested provider.
        model_api_id: Requested model identifier.
        config: Resolved service configuration.

    Returns:
        The adapter together with a record of any fallback.

    Raises:
        RuntimeError: If neither the requested provider nor OpenRouter has a key.
    """
    native_key = _native_api_key(api_provider, config)
    if native_key is not None:
        return AdapterChoice(
            adapter=_build_native_adapter(api_provider, native_key, model_api_id),
            requested_provider=api_provider,
            effective_provider=api_provider,
            effective_model_api_id=model_api_id,
            fallback_reason=None,
        )

    if config.openrouter_api_key is None:
        raise RuntimeError(
            f"No API key for provider {api_provider!r} and no OPENROUTER_API_KEY "
            f"to fall back to. Populate /etc/svc-eval/.env and restart the worker."
        )

    slug = to_openrouter_slug(model_api_id, api_provider)
    return AdapterChoice(
        adapter=OpenAICompatibleAdapter(
            name="openrouter", api_key=config.openrouter_api_key,
            model_api_id=slug, base_url=OPENROUTER_BASE_URL,
            uses_completion_token_cap=False,
        ),
        requested_provider=api_provider,
        effective_provider="openrouter",
        effective_model_api_id=slug,
        fallback_reason=(
            f"no API key configured for {api_provider!r}; served via OpenRouter"
        ),
    )
