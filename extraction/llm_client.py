"""Resilient Multi-Provider LLM Client.
Supports high-performance Groq models with automatic fallback recovery.
Default primary: openai/gpt-oss-120b (Flagship 120B parameter reasoning model on Groq)
Secondary: qwen/qwen3.8-27b on Groq
Fallback: OpenRouter (Qwen / Claude / Llama)
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
    Primary: Groq Flagship (openai/gpt-oss-120b / qwen/qwen3.8-27b)
    Fallback: OpenRouter (Qwen / Claude / Llama)
    """

    @property
    def groq_api_key(self) -> str:
        return os.getenv("GROQ_API_KEY", "").strip()

    @property
    def groq_model(self) -> str:
        # Default to the most powerful 120B parameter model hosted on Groq
        return os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()

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
        """Executes a chat completion with automatic model and provider fallback:
        1. Tries primary Groq model (openai/gpt-oss-120b)
        2. Tries secondary Groq model (qwen/qwen3.8-27b)
        3. On rate limit / error, catches exception and retries with OpenRouter
        """
        last_error = None
        groq_client = self._get_groq_client()

        if groq_client:
            # Try primary (gpt-oss-120b) then fallback model on Groq (qwen3.8-27b)
            candidate_models = [self.groq_model, "qwen/qwen3.8-27b"]
            # Deduplicate candidate models while preserving order
            unique_models = list(dict.fromkeys(candidate_models))

            for model_name in unique_models:
                try:
                    logger.info("Executing LLM completion with Groq model: %s", model_name)
                    kwargs: Dict[str, Any] = {
                        "model": model_name,
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
                        "Groq model %s failed (%s: %s). Trying next candidate...",
                        model_name,
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
