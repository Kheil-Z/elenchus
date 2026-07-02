# Privacy Policy

_Last updated: July 2026_

## What Elenchus is

Elenchus is a multiplayer AI workspace. You bring your own API key from your chosen AI provider (Anthropic, Google, or OpenAI), or configure a custom OpenAI-compatible endpoint of your choice. We coordinate shared conversations and store the data that makes that possible.

## What we collect

- **Account information** — your email address and display name, provided at sign-up.
- **API keys** — your AI provider API key, encrypted with AES-256-GCM before being stored. We cannot read it in plaintext.
- **Custom endpoint configuration** — if you use a custom provider: its base URL, your agent's name, and the model name. These are stored in plaintext; the optional key for a custom endpoint is encrypted like any other API key.
- **Messages and conversations** — everything typed in shared workspaces, stored so all members can see the thread.
- **Uploaded files** — documents and images you upload to projects, stored in Supabase Storage.

## How we use your data

- Your API key is used solely to make AI requests on your behalf when you trigger a response.
- Messages and documents are shared with other members of your project — that is the core function of the product.
- We do not use your data to train AI models.
- We do not sell or share your data with third parties for advertising.

## Third-party services

- **Supabase** — database, authentication, and file storage.
- **Vercel** — application hosting.
- **Your AI provider** — when you trigger an AI response, your message, the conversation history, and any attached documents are sent to your configured provider using your own API key: Anthropic, Google, OpenAI, or — if you set up a custom provider — the endpoint URL you chose. Elenchus sends conversation content to a custom endpoint exactly as it would to a commercial provider; you are responsible for trusting the endpoint you configure.

## Admin access

As the operator of this service, we have administrative access to the database and storage, which includes message content and uploaded files. This is standard for any hosted web application. We do not routinely read user content.

## Data retention and deletion

Your data is retained for as long as your account is active. You can permanently delete your account at any time from **Settings → Danger zone**. This removes your profile, all projects you created (including their conversations and files), your API key, and your provider configuration. Files you uploaded to other people's projects remain accessible to those teams.

## Contact

Questions: [ziadishappy@gmail.com](mailto:ziadishappy@gmail.com)
