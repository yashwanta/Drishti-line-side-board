# LLM API configuration

`llm-config.json` contains the non-secret settings for the OpenAI-compatible
LLM endpoint used by the Go backend.

Set `LLM_API_KEY` in `config/.env`. Never add credentials to this directory or
commit them to source control.
