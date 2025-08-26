🧾 White Paper : Ticket for Life  
Version : 1.4  
Date : 7 août 2025  
Réseau : Base Sepolia (testnet)  
Monnaie : ETH  

📜 Résumé exécutif  
Ticket for Life est une plateforme Web3 gamifiée basée sur Base Sepolia, combinant quiz éducatif, tirage au sort hebdomadaire et gestion NFT. Chaque utilisateur peut acheter 1 seul ticket (ERC-721) par wallet pour participer à un quiz hebdomadaire. En répondant correctement, le ticket devient éligible à un tirage au sort transparent via Chainlink VRF.

La plateforme comporte une marketplace intégrée où les utilisateurs peuvent soit revendre leur ticket à la plateforme à 90 % de son prix initial, soit le proposer librement à la communauté. Toutes les statistiques sont accessibles publiquement (sans wallet connecté), garantissant une transparence totale.

Les fonds sont gérés **manuellement** par l’admin dans trois pools distinctes :  

- **Pool de vente de tickets**  
- **Pool de prize money (tirages)**  
- **Pool de rachat (buyback)**  

👉 Aucun protocole DeFi externe (AAVE, Compound, etc.) n’est utilisé dans cette version.  

🎨 UI/UX - Design & expérience  
L’interface utilisateur est inspirée de l’univers visuel d’**Opus_infinity** sur Twitter : une ambiance cosmique, lumineuse et onirique. Le site se distingue par ses **couleurs claires**, ses **dégradés célestes**, sa **joie de vivre visuelle** et une **harmonie pure** qui enveloppe toute l’expérience utilisateur. Chaque page est pensée pour être simple, magique, et parfaitement fluide, même sans wallet connecté. Le design vise la **féérie épurée** et l’**accessibilité universelle**, dans une esthétique Web3 poétique et joyeuse.

---

🎯 Vision et mission  
Ticket for Life offre une expérience blockchain simple, éducative, et équitable. L’objectif est de récompenser la régularité, la mémoire et l’engagement communautaire, tout en garantissant la **confidentialité totale** des participants (aucun KYC, aucun cookie). L’expérience est centrée sur un design élégant, une interface épurée, et des règles claires.

---

🧩 Fonctionnalités clés  

🎟️ 1. Achat de ticket (NFT ERC-721)  
- Prix : 0.001 ETH  
- Limite : 1 seul ticket par wallet  
- Mint uniquement via wallet connecté (WalletConnect / RainbowKit)  
- Le ticket reste valide à vie : tant que le joueur participe au quiz hebdomadaire, il reste éligible aux tirages  

🧠 2. Quiz hebdomadaire  
- Chaque semaine, un quiz QCM est publié  
- Les bonnes réponses valident le ticket pour le tirage  
- Si le ticket n’est pas utilisé une semaine, il reste valide, mais non éligible tant qu’il n’y a pas de bonne réponse  

🎰 3. Tirage au sort  
- Tirage effectué via Chainlink VRF pour garantir l’équité  
- Seuls les tickets validés par réponse correcte participent  
- Les tickets de l’admin (issus du buyback) peuvent être validés automatiquement via un widget admin  

🛒 4. Marketplace intégrée  
Deux options pour le détenteur :  
- **Revente directe à la plateforme** : à 90 % du prix initial (soit 0.0009 ETH), si les fonds sont disponibles dans la Buyback Pool  
- **Revente libre** : le joueur choisit son prix, visible sur la marketplace (système d’enchères ou listing simple)  

🔸 Les reventes entre utilisateurs incluent une **commission de 10 %**, versée intégralement dans la **Pool de vente**  
🔸 Le NFT reste transférable vers des plateformes externes compatibles (ex : OpenSea sur Base Sepolia)  

🔁 5. Répartition des fonds et pools manuelles  
Les fonds sont gérés **manuellement** par l’administrateur dans trois pools séparées :  

| Pool           | Rôle |
|----------------|------|
| **Pool Vente** | Reçoit 80 % du prix de vente de chaque ticket (0.0008 ETH), **et** 100 % des commissions de 10 % sur les reventes entre utilisateurs |
| **Pool Buyback** | Reçoit 20 % du prix de chaque ticket (0.0002 ETH). Sert au rachat des tickets à 90 % du prix initial |
| **Pool Prize** | Reçoit les montants déterminés manuellement par l’admin depuis la pool Vente, utilisés pour les gains hebdomadaires |

👉 Aucun automatisme, aucun protocole DeFi n’est utilisé. Tout est géré via un **back-office admin** manuel.  

📊 6. Statistiques publiques  
Données disponibles à tous sans connexion de wallet :  
- Nombre total de tickets mintés  
- Résultats des quiz  
- Gagnants du tirage  
- Soldes des trois pools  
Présentées dans une **section Historique** pour une transparence maximale  

🛠️ 7. Admin Dashboard  
Accès restreint aux wallets définis dans le fichier `adminWallets.ts`  

Fonctionnalités principales :  
- Gestion des quiz : publication, édition, validation  
- Validation automatique des tickets possédés par l'admin  
- Contrôle des tirages au sort automatique avec distribution des prize money  automatique   
- Rachats de tickets (Buyback) manuels  
- Mouvements entre les pools  
- Statistiques détaillées  

🔐 8. Confidentialité & Sécurité  
- Aucun KYC, aucun cookie, aucun tracker  
- Toutes les interactions passent par le wallet connecté  
- Contrats intelligents sécurisés (basés sur OpenZeppelin)  
- Randomisation assurée par Chainlink VRF  
- Audit prévu avant passage en mainnet  

---

💡 Règles et limitations  

| Élément | Règle |
|--------|--------|
| Achat de ticket | 1 par wallet maximum |
| Participation au quiz | Obligatoire pour être éligible au tirage |
| Revente à la plateforme | 90 % du prix initial, selon fonds disponibles |
| Revente à la communauté | Prix libre, avec commission de 10 % |
| Wallet non connecté | Peut accéder à l’historique et aux statistiques |
| Validité du ticket | À vie, tant qu’il n’est pas revendu |
| Ticket admin | Peut être validé automatiquement pour le tirage |

---

📌 Conclusion  
Ticket for Life est une plateforme Web3 innovante, transparente et simple d’utilisation. Sans DeFi complexe, sans KYC, et avec une approche manuelle claire, elle permet aux joueurs de vivre une expérience ludique, équitable et minimaliste. Son système de pools, son quiz hebdomadaire, son UI magique, et sa marketplace intégrée créent un **cycle complet de jeu, d’engagement et de récompense**, dans un univers visuel enchanteur.
