# Security

- Never commit API keys, Twilio credentials or phone numbers. Alert delivery (`Aditya/api/notify.js`) reads them from environment variables only and is off unless they are set.
- The Anthropic API key is pasted by the user in the browser and kept in that tab only.
- Triage of citizen reports runs on-device; the agent can run on a local Ollama model so police data never leaves the building.

Report a vulnerability by opening a private security advisory on this repository.
