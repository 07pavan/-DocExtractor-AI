"""Unit tests for the resilient multi-provider LLM client.
"""

from unittest.mock import patch, MagicMock
import pytest
from extraction.llm_client import ResilientLLMClient


def test_llm_client_availability():
    """Verify is_available returns True when keys are present."""
    client = ResilientLLMClient()
    client.groq_api_key = "gsk-mock-key"
    client.openrouter_api_key = ""
    assert client.is_available() is True

    client.groq_api_key = ""
    client.openrouter_api_key = "sk-or-mock-key"
    assert client.is_available() is True

    client.groq_api_key = ""
    client.openrouter_api_key = ""
    assert client.is_available() is False


def test_groq_primary_success():
    """Verify primary call goes to Groq when available."""
    client = ResilientLLMClient()
    client.groq_api_key = "gsk-test"

    mock_groq = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"summary": "Test overview"}'
    mock_groq.chat.completions.create.return_value = MagicMock(choices=[mock_choice])

    client._get_groq_client = MagicMock(return_value=mock_groq)

    result = client.generate_chat_completion([{"role": "user", "content": "Hi"}])
    assert result == '{"summary": "Test overview"}'
    mock_groq.chat.completions.create.assert_called_once()


def test_groq_failure_automatic_fallback_to_openrouter():
    """Verify that when Groq raises an error (e.g. rate limit), it automatically switches to OpenRouter."""
    client = ResilientLLMClient()
    client.groq_api_key = "gsk-test"
    client.openrouter_api_key = "sk-or-test"

    # Mock Groq to fail with RateLimitError
    mock_groq = MagicMock()
    mock_groq.chat.completions.create.side_effect = Exception("Rate limit reached on Groq (429)")

    # Mock OpenRouter to succeed
    mock_openrouter = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '{"summary": "Fallback from OpenRouter"}'
    mock_openrouter.chat.completions.create.return_value = MagicMock(choices=[mock_choice])

    client._get_groq_client = MagicMock(return_value=mock_groq)
    client._get_openrouter_client = MagicMock(return_value=mock_openrouter)

    result = client.generate_chat_completion([{"role": "user", "content": "Parse this table"}])

    assert result == '{"summary": "Fallback from OpenRouter"}'
    mock_groq.chat.completions.create.assert_called_once()
    mock_openrouter.chat.completions.create.assert_called_once()
