"use client";

import { Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], display: "swap", weight: ["400", "600", "700"] });

export default function HelpPage() {
  return (
    <div className={`${manrope.className} mx-auto max-w-3xl p-4 sm:p-6 prose prose-sm`}>
      <h1 className="text-2xl font-semibold uppercase tracking-wide">Guide rapide</h1>
      <p>Ticket4Life est une plateforme on-chain (Base Sepolia) avec 1 ticket NFT par wallet, un quiz hebdomadaire et un tirage au sort.</p>
      <h2>Cycle hebdomadaire</h2>
      <ol>
        <li>Mint 1 ticket (prix défini par le contrat). Limite: 1 ticket par wallet.</li>
        <li>Réponds au quiz de la semaine. Si bonne réponse → tu es éligible au tirage.</li>
        <li>Après le tirage (admin), la semaine suivante commence et l’éligibilité est réinitialisée.</li>
      </ol>
      <h2>Marketplace</h2>
      <ul>
        <li>Listing libre: fixe un prix. Commission 10% va à la Pool Vente. Net vendeur: 90%.</li>
        <li>Buyback: rachat à 90% du prix mint, sous réserve de solde de la Pool Buyback.</li>
        <li>1 ticket par wallet: tu ne peux pas acheter si tu en possèdes déjà un.</li>
      </ul>
      <h2>Pools</h2>
      <ul>
        <li>Vente (Sale): reçoit 80% du mint + 10% des commissions de vente.</li>
        <li>Buyback: reçoit 20% du mint; utilisée pour les rachats à 90%.</li>
        <li>Prize: utilisée pour les gains du tirage. Transferts administrables.</li>
      </ul>
      <h2>Admin</h2>
      <ul>
        <li>Tirage + distribution depuis la Prize Pool (montant auto ou saisi).</li>
        <li>Mouvements entre pools (Vente ↔ Buyback ↔ Prize).</li>
        <li>Validation auto des tickets admin pour éligibilité.</li>
        <li>Gestion quiz on-chain (création, question/options, activation).</li>
      </ul>
      <p>Les interactions nécessitent une connexion wallet et consomment du gas (testnet Base Sepolia).</p>
    </div>
  );
}
