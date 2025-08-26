# Ticket4Life Smart Contracts (Base Sepolia)

Contracts:
- Ticket4LifeTicket (ERC-721, 1 mint par wallet, prix 0.001 ETH)
- Treasury (pools: sale / prize / buyback)
- Marketplace (escrow, 10% fee vers sale pool via Treasury)
- Buyback (rachat 90% prix mint)
- DistributionV1 (distribution manuelle avec seed V1)

## Prérequis
- Node 18+
- `cp .env.example .env` puis remplir `DEPLOYER_KEY`

## Scripts
```bash
pnpm i # ou npm i / yarn
pnpm build
pnpm test
pnpm deploy:base-sepolia
```

## Notes d’archi
- V1: la distribution est manuelle avec seed; passage VRF possible en V2.
- Les fees marketplace (10%) sont envoyées à Treasury (sale pool).
- Buyback paie un prix fixe (90% mint). Il faut provisionner le contrat en ETH.
- Le mint transfère les fonds au Treasury (à router ensuite vers prize/sale selon la règle métier côté off-chain ou via une fonction future).

## TODO
- Éventuelle fonction `routeMintProceeds` dans Treasury pour splitter automatiquement vers prize/sale.
- Tests unitaires Foundry/Hardhat.
- Script d’approvisionnement des pools.
