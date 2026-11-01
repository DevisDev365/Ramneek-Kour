import logging
from typing import List, Dict
import httpx
from config import INCEPTION_API_KEY, INCEPTION_BASE_URL, INCEPTION_MODEL

logger = logging.getLogger(__name__)

class InceptionLLMClient:
    def __init__(self, api_key: str = INCEPTION_API_KEY, base_url: str = INCEPTION_BASE_URL, model: str = INCEPTION_MODEL):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    async def generate_response(self, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
        """
        Sends chat completion request to Inception Labs API (mercury-3).
        """
        if not self.api_key:
            return (
                "⚠️ Inception Labs API key is missing. Please set `INCEPTION_API_KEY` in your `.env` file."
            )

        endpoint = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(endpoint, json=payload, headers=headers)
                
                if response.status_code != 200:
                    logger.error(f"Inception API returned error {response.status_code}: {response.text}")
                    return f"Sorry Ramneek, I ran into an error connecting to my AI core ({response.status_code}): {response.text}"

                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    return "Sorry, I received an empty response from the AI core."
                
                content = choices[0].get("message", {}).get("content", "")
                return content.strip()

        except httpx.TimeoutException:
            logger.error("Timeout while calling Inception API.")
            return "Sorry Ramneek, the request timed out while generating a response. Please try again in a moment."
        except Exception as e:
            logger.error(f"Unexpected error in InceptionLLMClient: {e}", exc_info=True)
            return f"An unexpected error occurred: {str(e)}"
