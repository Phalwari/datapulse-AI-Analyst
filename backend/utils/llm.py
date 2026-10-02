"""
Unified LLM API Helper for DataPulse AI.

Supports both Groq and OpenRouter API providers through a single interface.
Provider is selected automatically based on which environment variable is set.

Priority order:
  1. OPENROUTER_API_KEY → OpenRouter API
  2. GROQ_API_KEY       → Groq API

Usage:
    from backend.utils.llm import call_llm
    response = call_llm(prompt="Analyze this data", system_instruction="You are an analyst", json_mode=True)
"""

import os
import requests


def call_llm(prompt: str, system_instruction: str = "", json_mode: bool = False) -> str:
    """
    Send a prompt to the configured LLM provider and return the response text.

    Args:
        prompt: The user message to send to the LLM.
        system_instruction: Optional system-level instruction to guide the model.
        json_mode: If True, requests structured JSON output from the model.

    Returns:
        The model's response text as a string.

    Raises:
        ValueError: If neither OPENROUTER_API_KEY nor GROQ_API_KEY is set.
        Exception: If the API request fails.
    """
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")

    if openrouter_key:
        model = os.getenv("OPENROUTER_MODEL", "openrouter/free")
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "HTTP-Referer": os.getenv("APP_URL", "http://localhost:5173"),
            "X-Title": "DataPulse AI Analyst",
            "Content-Type": "application/json",
        }
        url = "https://openrouter.ai/api/v1/chat/completions"
    elif groq_key:
        model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
        headers = {
            "Authorization": f"Bearer {groq_key}",
            "Content-Type": "application/json",
        }
        url = "https://api.groq.com/openai/v1/chat/completions"
    else:
        raise ValueError(
            "No LLM API key configured. "
            "Set either OPENROUTER_API_KEY or GROQ_API_KEY in your .env file."
        )

    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    res = requests.post(url, headers=headers, json=payload)
    if res.status_code != 200:
        raise Exception(f"LLM API Error ({url}): {res.text}")

    return res.json()["choices"][0]["message"]["content"]
