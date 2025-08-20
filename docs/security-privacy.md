# Security & Privacy

We take the security and privacy of your data seriously.  This document outlines how CodeCap handles your information.

## Local by default

All captures are stored locally on your device in a SQLite database.  By default, CodeCap does **not** send your captured text, images or AI results to any external server.  The only outbound requests are to AI providers (if you enable AI features) and to send invitation emails when you share a capture with a collaborator.

## Encryption

* **At-rest encryption:** Snippet bodies are encrypted in the database using a key derived from your device.  Raw image files (if you choose to retain them) are also encrypted.
* **In-transit encryption:** When you do enable AI features, any requests to third‑party AI providers are made over HTTPS.  We recommend reviewing the privacy policy of your chosen provider.

## AI Providers

If you choose to use AI summarisation or tagging, you will be asked to supply an API key for your preferred provider (e.g. OpenAI).  The key is stored securely in your OS keychain and is not transmitted anywhere other than to the AI provider’s API.  You can remove or change your key at any time via the Settings panel.

## Sharing

Sharing a capture sends the decrypted text and associated metadata to the specified recipient.  Comments on captures are stored in the local database of each participant.  Future versions may support optional end‑to‑end encryption for shared items.

## Telemetry

The MVP of CodeCap collects anonymous crash reports and minimal usage statistics to improve the product.  No captured content is included in telemetry.  You can opt out of telemetry in the Settings panel.