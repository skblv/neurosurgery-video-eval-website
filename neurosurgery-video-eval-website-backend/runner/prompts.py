"""The tool-detection prompt and the structured response it asks for.

The wording is byte-identical to the published eval scripts. Changing so much as
the punctuation would make new leaderboard entries incomparable with the numbers
already on the site, so this module has no configuration knobs.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ToolDetectionResult(BaseModel):
    """Structured output for tool detection."""

    detected_tools: list[str] = Field(
        description="List of surgical tool names visible in the frame"
    )


def create_prompt(valid_tools: list[str]) -> str:
    """Create the tool detection prompt.

    Args:
        valid_tools: The dataset's instrument vocabulary, in ontology order.

    Returns:
        The prompt string sent with every frame.
    """
    tools_list = "\n".join([f"- {tool}" for tool in valid_tools])

    prompt = f"""Identify all surgical tools visible in this surgical video frame.

Valid tool names:
{tools_list}

Return your answer as a JSON object with this exact format:
{{"detected_tools": ["Tool Name 1", "Tool Name 2"]}}

Use ONLY the exact tool names from the list above.
If a tool appears multiple times, list it only once.
If no tools are visible, return: {{"detected_tools": []}}

Return ONLY valid JSON, nothing else."""

    return prompt
