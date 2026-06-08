import { Header } from "@/components/Header";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 gap-8">
        <div className="text-center max-w-lg">
          <h1 className="font-serif text-5xl text-foreground mb-4">Elenchus</h1>
          <p className="text-muted text-lg leading-relaxed">
            A multiplayer Claude workspace. Multiple collaborators, one shared thread,
            each using their own API key.
          </p>
        </div>
        <Card className="w-full max-w-sm text-center" padding="lg">
          <p className="text-sm text-muted mb-4">Scaffold ready. Features coming soon.</p>
          <Button variant="primary">Get started</Button>
        </Card>
      </main>
    </div>
  );
}
