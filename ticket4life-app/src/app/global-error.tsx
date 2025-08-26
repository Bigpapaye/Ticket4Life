"use client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  // Minimal global error boundary so Next.js always has required components
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F6EADA" }}>
          <div style={{ maxWidth: 560, padding: 24, border: "1px solid #E6D8C6", borderRadius: 8, background: "#FAF0E3", color: "#111111", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 18 }}>Une erreur est survenue</div>
            <div style={{ fontSize: 14, marginBottom: 16 }}>Merci de réessayer. Si le problème persiste, rafraîchis la page.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => reset()} style={{ background: "#27E7C5", color: "#111111", border: "1px solid #27E7C5", borderRadius: 6, padding: "8px 12px", cursor: "pointer" }}>Réessayer</button>
              <a href="/" style={{ background: "transparent", color: "#111111", border: "1px solid #E6D8C6", borderRadius: 6, padding: "8px 12px", textDecoration: "none" }}>Accueil</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
