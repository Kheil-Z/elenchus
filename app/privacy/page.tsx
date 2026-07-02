import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Elenchus",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors mb-8 inline-block"
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-semibold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-10">Last updated: July 2026</p>

        <div className="flex flex-col gap-8 text-sm text-foreground leading-relaxed">

          <section className="flex flex-col gap-2">
            <h2 className="font-medium text-base">What Elenchus is</h2>
            <p className="text-muted">
              Elenchus is a multiplayer AI workspace. You bring your own API key from your chosen AI
              provider (Anthropic, Google, or OpenAI), or configure a custom OpenAI-compatible endpoint
              of your choice. We coordinate shared conversations between your team and your LLMs.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-medium text-base">What we collect</h2>
            <ul className="text-muted flex flex-col gap-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Account information</strong> — your email address and display name, provided at sign-up.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">API keys</strong> — your AI provider API key, encrypted with AES-256-GCM before being stored. We cannot read it in plaintext.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Custom endpoint configuration</strong> — if you use a custom provider: its base URL, your agent&apos;s name, and the model name. These are stored in plaintext; the optional key for a custom endpoint is encrypted like any other API key.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Messages and conversations</strong> — everything typed in shared workspaces, stored so all members can see the thread.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Uploaded files</strong> — documents and images you upload to projects, stored in Supabase Storage.</span>
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-medium text-base">How we use your data</h2>
            <ul className="text-muted flex flex-col gap-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                Your API key is used solely to make AI requests on your behalf when you trigger a response.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                Messages and documents are shared with other members of your project — that is the core function of the product.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                We do not use your data to train AI models.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                We do not sell or share your data with third parties for advertising.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-medium text-base">Third-party services</h2>
            <ul className="text-muted flex flex-col gap-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Supabase</strong> — database, authentication, and file storage. Data is hosted on their infrastructure.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Vercel</strong> — application hosting. Requests pass through their servers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-muted/50" />
                <span><strong className="text-foreground">Your AI provider</strong> — when you trigger an AI response, your message, the conversation history, and any attached documents are sent to the provider you have configured using your own API key: Anthropic, Google, OpenAI, or — if you set up a custom provider — the endpoint URL you chose. Elenchus sends conversation content to a custom endpoint exactly as it would to a commercial provider; you are responsible for trusting the endpoint you configure.</span>
              </li>
            </ul>
          </section>


          <section className="flex flex-col gap-2">
            <h2 className="font-medium text-base">Data retention and deletion</h2>
            <p className="text-muted">
              Your data is retained for as long as your account is active. You can permanently delete
              your account at any time from <strong className="text-foreground">Settings → Danger zone</strong>.
              This removes your profile, all projects you created (including their conversations and files),
              your API key, and your provider configuration. Files you uploaded to other people&apos;s projects
              remain accessible to those teams.
            </p>
          </section>

          

        </div>
      </div>
    </div>
  );
}
