"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

const COLORS = {
  CREAM: "#F6EADA",
  PANEL: "#FAF0E3",
  PANEL_HOVER: "#F3E9D7",
  BORDER: "#E6D8C6",
  TEXT: "#111111",
  SUBTEXT: "#6B6B6B",
  CTA: "#27E7C5",
} as const;

type QA = { q: string; a: React.ReactNode };
type Section = { title: string; items: QA[] };

function Item({ qa, open, onToggle, id }: { qa: QA; open: boolean; onToggle: () => void; id: string }) {
  return (
    <div className="rounded-lg" style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}`, color: COLORS.TEXT }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--tw-ring-color,#000)]"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        id={`${id}-button`}
      >
        <span className="font-medium">{qa.q}</span>
        <span aria-hidden style={{ color: COLORS.SUBTEXT }}>
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-button`}
          className="px-4 pb-4 text-sm border-t"
          style={{ borderColor: COLORS.BORDER, color: COLORS.SUBTEXT }}
        >
          {qa.a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [query, setQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  const sections: Section[] = useMemo(() => ([
    {
      title: "Général",
      items: [
        {
          q: "Quel est le concept de Ticket4Life ?",
          a: (
            <p>
              Ticket4Life est un système de tickets limités à <b>1 par wallet</b> pour participer à un <b>tirage hebdomadaire</b> après avoir répondu correctement au quiz. Les <b>3 gagnants</b> se partagent la cagnotte: <b>70% / 20% / 10%</b>.
            </p>
          ),
        },
        {
          q: "Sur quel réseau fonctionne l’app ?",
          a: (
            <p>
              Le site fonctionne sur le réseau <b>Base (mainnet)</b>. Toutes les actions sont on‑chain et consomment du gas. Assure‑toi d’être connecté à <b>Base</b> dans ton wallet.
            </p>
          ),
        },
      ],
    },
    {
      title: "Tickets",
      items: [
        { q: "Combien de tickets puis‑je posséder ?", a: <p><b>1 ticket</b> par wallet (limite stricte), valable pour le mint <i>et</i> la marketplace.</p> },
        { q: "À quoi sert mon ticket ?", a: <p>Il donne le droit de participer au quiz de la semaine et donc au tirage si la réponse est correcte.</p> },
      ],
    },
    {
      title: "Quiz & éligibilité",
      items: [
        {
          q: "Comment devenir éligible au tirage ?",
          a: <p>Réponds correctement au quiz hebdomadaire. Après le tirage, <b>l’éligibilité est réinitialisée</b> pour la semaine suivante.</p>,
        },
        {
          q: "Puis‑je rejouer si je me trompe ?",
          a: <p>L’éligibilité est binaire par semaine. Si tu n’as pas la bonne réponse, tu pourras retenter <b>la semaine suivante</b>.</p>,
        },
      ],
    },
    {
      title: "Tirage & récompenses",
      items: [
        { q: "Le tirage est‑il aléatoire ?", a: <p>Oui, le contrat sélectionne aléatoirement jusqu’à <b>3 wallets éligibles</b> (bonne réponse) pour répartir la cagnotte <b>70/20/10</b>.</p> },
        { q: "Quand a lieu le tirage ?", a: <p>À la fin de chaque période hebdomadaire. Les historiques sont consultables dans l’admin (si habilité).</p> },
      ],
    },
    {
      title: "Marketplace",
      items: [
        { q: "Comment fonctionne la marketplace ?", a: <p>Liste ton ticket à la revente, d’autres utilisateurs peuvent l’acheter. Une <b>commission</b> peut s’appliquer et alimente la Sale Pool.</p> },
        { q: "La limite 1 ticket s’applique‑t‑elle à l’achat ?", a: <p>Oui, la contrainte est vérifiée par le contrat NFT pour le mint comme pour l’achat.</p> },
      ],
    },
    {
      title: "Rachat (Buyback)",
      items: [
        { q: "Qu’est‑ce que le buyback ?", a: <p>Un <b>rachat admin</b> de tickets listés à un prix prédéfini. Il est financé par la <b>Buyback Pool</b> de la Treasury.</p> },
        { q: "Comment se passe le rachat ?", a: <p>Le contrat <b>Treasury</b> exécute un <b>achat atomique</b>: il paie le listing via la buyback pool (<code>buyFromMarketplace</code>), puis le NFT est transféré au wallet admin <b>dans la même transaction</b>.</p> },
        { q: "Quel est le prix de buyback ?", a: <p>Pour les listings éligibles, le prix de rachat utilisé côté admin est <b>90% du prix de mint</b> (selon la configuration actuelle exposée dans l’UI).</p> },
      ],
    },
    {
      title: "Pools & frais",
      items: [
        { q: "À quoi servent les pools (Sale / Prize / Buyback) ?", a: <p><b>Sale</b>: collecte des commissions. <b>Prize</b>: cagnotte distribuée 70/20/10. <b>Buyback</b>: réserve de rachat admin.</p> },
        { q: "Puis‑je déposer ou retirer des fonds ?", a: <p>Oui via la Treasury (selon les droits). Les dépôts/rachats sont visibles en temps réel dans l’interface.</p> },
      ],
    },
    {
      title: "Wallet & réseau",
      items: [
        { q: "De quoi ai‑je besoin pour jouer ?", a: <p>Un <b>wallet</b> (ex: Rainbow, MetaMask) connecté à <b>Base</b> avec un peu d’ETH pour le gas.</p> },
        { q: "Pourquoi mes actions échouent‑elles parfois ?", a: <p>Souvent à cause du réseau (RPC), d’un <b>manque de gas</b>, ou d’une <b>mauvaise chaîne</b>. Vérifie l’erreur affichée dans l’UI.</p> },
      ],
    },
    {
      title: "Sécurité & transparence",
      items: [
        { q: "Mon ticket est‑il un vrai NFT ?", a: <p>Oui, un <b>ERC‑721</b> détenu dans ton wallet. Tu peux lister, transférer ou le conserver.</p> },
        { q: "Où voir les transactions ?", a: <p>Sur l’explorateur <b>Basescan</b> (réseau Base) via les liens intégrés à l’interface (ex: après une transaction).</p> },
      ],
    },
    {
      title: "Support & problèmes fréquents",
      items: [
        { q: "Je ne vois pas mon ticket après achat.", a: <p>Attends quelques secondes puis rafraîchis. Les événements on‑chain sont écoutés et synchronisent l’UI automatiquement.</p> },
        { q: "Hydration error dans le navigateur.", a: <p>Vide le cache et recharge. Si le souci persiste, signale la page concernée pour un correctif côté rendu client.</p> },
      ],
    },
  ]), []);

  const flatList = useMemo(() => {
    const all: Array<{ key: string; section: string; qa: QA }> = [];
    sections.forEach((sec, si) => {
      sec.items.forEach((qa, qi) => all.push({ key: `${si}-${qi}`, section: sec.title, qa }));
    });
    return all;
  }, [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flatList;
    return flatList.filter(({ qa }) => qa.q.toLowerCase().includes(q) || String(qa.a).toLowerCase().includes(q));
  }, [query, flatList]);

  return (
    <div className={`${manrope.className} w-full`} style={{ backgroundColor: COLORS.CREAM, minHeight: "100vh" }}>
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight uppercase mt-2" style={{ color: COLORS.TEXT }}>
          FAQ{" "}Ticket<span style={{ color: COLORS.CTA }}>4</span>Life
        </h1>
        <p className="text-sm mb-4" style={{ color: COLORS.SUBTEXT }}>Retrouve ici les questions les plus fréquentes sur les tickets, le quiz, le tirage, la marketplace et le buyback.</p>

        <div className="flex items-center gap-2 mb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une question…"
            className="border rounded px-3 py-2 w-full max-w-md"
            aria-label="Rechercher dans la FAQ"
            style={{ border: `1px solid ${COLORS.BORDER}`, backgroundColor: COLORS.PANEL, color: COLORS.TEXT }}
          />
          <Button
            onClick={() => setQuery("")}
            className="px-3 py-2 text-sm rounded border"
            title="Effacer"
            style={{ backgroundColor: COLORS.PANEL, border: `1px solid ${COLORS.BORDER}`, color: COLORS.TEXT }}
          >
            Effacer
          </Button>
        </div>
      {/* Live region announcing results count */}
      <div className="sr-only" role="status" aria-live="polite">
        {filtered.length} résultat{filtered.length > 1 ? 's' : ''} dans la FAQ
      </div>

      {/* Listing filtré – regroupé par section */}
      <div className="space-y-8">
        {sections.map((sec, si) => {
          const entries = filtered.filter((f) => f.section === sec.title);
          if (!entries.length) return null;
          return (
            <section key={sec.title} className="space-y-2">
              <h2 className="font-semibold" style={{ color: COLORS.TEXT }}>{sec.title}</h2>
              {entries.map(({ key, qa }, idx) => (
                <Item
                  key={key}
                  qa={qa}
                  open={openIndex === key}
                  onToggle={() => setOpenIndex(openIndex === key ? null : key)}
                  id={`faq-${si}-${idx}`}
                />
              ))}
            </section>
          );
        })}
      </div>
      </div>
    </div>
  );
}
