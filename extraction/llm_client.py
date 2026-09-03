"""Resilient Multi-Provider LLM Client.
Attempts primary calls via Groq, automatically falling back to OpenRouter upon errors/rate limits.
Always reads environment variables dynamically to ensure fresh keys are loaded.
"""

from __future__ import annotations
import os
import json
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("extraction.llm_client")


class ResilientLLMClient:
    """Multi-provider LLM client with automatic failure recovery.
    Primary: Groq (high-speed inference)
    Fallback: OpenRouter (Qwen / Claude / Llama)
    """

    @property
    def groq_api_key(self) -> str:
        return os.getenv("GROQ_API_KEY", "").strip()

    @property
    def groq_model(self) -> str:
        return os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()

    @property
    def openrouter_api_key(self) -> str:
        return os.getenv("OPENROUTER_API_KEY", "").strip()

    @property
    def openrouter_model(self) -> str:
        return os.getenv("OPENROUTER_MODEL", "qwen/qwen-2.5-72b-instruct").strip()

    def is_available(self) -> bool:
        """Returns True if at least one LLM provider is configured."""
        return bool(self.groq_api_key or self.openrouter_api_key)

    def _get_groq_client(self):
        key = self.groq_api_key
        if key:
            try:
                from groq import Groq
                return Groq(api_key=key)
            except Exception as e:
                logger.warning("Failed to initialize Groq client: %s", str(e))
        return None

    def _get_openrouter_client(self):
        key = self.openrouter_api_key
        if key:
            try:
                from openai import OpenAI
                return OpenAI(
                    base_url="https://openrouter.ai/api/v1",
                    api_key=key,
                )
            except Exception as e:
                logger.warning("Failed to initialize OpenRouter client: %s", str(e))
        return None

    def generate_chat_completion(
        self,
        messages: List[Dict[str, str]],
        json_mode: bool = True,
        temperature: float = 0.1,
        max_tokens: int = 4096,
    ) -> str:
        """Executes a chat completion with automatic provider fallback:
        1. Tries Groq
        2. On error / rate limit, catches exception, logs warning, and retries with OpenRouter
        """
        last_error = None

        # 1. Try Primary: Groq
        groq_client = self._get_groq_client()
        if groq_client:
            try:
                logger.info("Executing LLM completion with primary provider: Groq (%s)", self.groq_model)
                kwargs: Dict[str, Any] = {
                    "model": self.groq_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                completion = groq_client.chat.completions.create(**kwargs)
                content = completion.choices[0].message.content or ""
                if content:
                    return content
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Groq request failed (%s: %s). Automatically falling back to OpenRouter...",
                    type(exc).__name__,
                    str(exc),
                )

        # 2. Try Fallback: OpenRouter
        openrouter_client = self._get_openrouter_client()
        if openrouter_client:
            try:
                logger.info(
                    "Executing fallback LLM completion with OpenRouter (%s)",
                    self.openrouter_model,
                )
                kwargs = {
                    "model": self.openrouter_model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}

                completion = openrouter_client.chat.completions.create(**kwargs)
                content = completion.choices[0].message.content or ""
                if content:
                    return content
            except Exception as exc:
                last_error = exc
                logger.error("OpenRouter fallback request also failed (%s: %s)", type(exc).__name__, str(exc))

        error_msg = "No available LLM provider could fulfill the request."
        if last_error:
            error_msg += f" Last error: {str(last_error)}"
        raise RuntimeError(error_msg)


# Global singleton client
llm_client = ResilientLLMClient()
