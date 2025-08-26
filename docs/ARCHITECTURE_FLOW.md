# Ticket4Life — Architecture & Flow Log

Purpose: centralize the site architecture and step-by-step flows (frontend + smart contracts), and record test runs/outcomes.

## Environment source
- Frontend loads env from `ticket4life-app/next.config.js` via `require('dotenv').config({ path: path.resolve(__dirname, '../contracts/.env') })`.
- Single source of truth: `contracts/.env`.
- Public vars used in the app (non-exhaustive):
  - `NEXT_PUBLIC_CHAIN_ID`
  - `NEXT_PUBLIC_TICKET_ADDRESS`
  - `NEXT_PUBLIC_MARKETPLACE_ADDRESS`
  - `NEXT_PUBLIC_MARKETPLACEV2_ADDRESS`
  - `NEXT_PUBLIC_TREASURY_ADDRESS`
  - `NEXT_PUBLIC_QUIZ_ADDRESS`
  - `NEXT_PUBLIC_REGISTRY_ADDRESS`
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

## Frontend structure (high-level)
- Home (mint + overview): `ticket4life-app/src/app/page.tsx`
- Marketplace V2 (list/cancel/manage): `ticket4life-app/src/app/marketplaceV2/page.tsx`
- Quiz: `ticket4life-app/src/components/QuizWidget.tsx` (referenced in Home)
- Toasts/UX helpers: `ticket4life-app/src/lib/toast.ts`, `ticket4life-app/src/lib/txToasts.ts`, `ticket4life-app/src/components/SyncProvider.tsx`

## Contracts overview (high-level)
- Chain: Base Sepolia (`NEXT_PUBLIC_CHAIN_ID=84532`)
- Addresses loaded from `contracts/.env`.
- Interactions via wagmi/viem (readContract, writeContract) in the Next.js app.

---

## Step 1 — Mint a ticket (Home)
File: `ticket4life-app/src/app/page.tsx`

- Key state/hooks:
  - `useAccount()` (wallet connection)
  - `useReadContract()` reads: `balanceOf(address)`, `owner()`, `MINT_PRICE`, `nextId`, treasury `prizePool`
  - `useWriteContract()` for `mint()`
- Preconditions (UI gating):
  - If not connected: CTA prompts to connect wallet
  - Ownership loaded via `balanceOf`; if balance > 0, mint disabled (unless wallet is the contract owner for admin bypass in UI)
- Mint action (`handleMint`):
  - Requires `mintPrice` loaded (bigint)
  - Sends `writeContractAsync({ address: CONTRACTS.ticket, abi: ABI.ticket, functionName: 'mint', value: mintPrice })`
  - Wrapped with `withTxToasts` for pending/success toasts
  - On success: `refreshAll()` and redirect to `/quiz?minted=1`
  - On error: toast with `shortMessage`/`message`
- Observability:
  - UI toasts for pending/success/error
  - After success, Home page shows “Vous avez votre ticket” (based on on-chain `balanceOf`)

Notes:
- Home also checks persistent listing hints to reflect state if the user has listed their ticket.
- LocalStorage keys on Home (namespaced with chain and marketplace address):
  - Public V1: `t4l_last_listing:<chainId>:<marketplaceAddress>`
  - Admin V1: `t4l_admin_listing:<chainId>:<marketplaceAddress>`
  - Public V2: `t4l_v2_listing:<chainId>:<marketplaceV2Address>`
- On-chain listing lookup uses id = `keccak256(encodePacked([nftAddress, tokenId, seller]))`.

---

## Step 2 — Weekly Quiz (placeholder)
Files:
- `ticket4life-app/src/components/QuizWidget.tsx`
- Pages under `ticket4life-app/src/app/quiz*` (if any)

Flow (to be detailed during tests):
- Access control: must hold ticket or have valid eligibility
- Submit answers -> on-chain/off-chain checks (tbd)

---

## Step 3 — Marketplace V2 (multi-ticket listings)
File: `ticket4life-app/src/app/marketplaceV2/page.tsx`

- Multi-listing support using array-based listings (per wallet)
- No single-listing states; UI/event handlers rely on array state and localStorage hints
- Actions:
  - List ticket(s), cancel listing(s), navigate to Home CTA
  - Optimistic UI update and clearing of localStorage hints on cancel
- On-chain:
  - Listing record lookup via `marketplaceV2.listings(id)` with `id=keccak256(encodePacked(nft, tokenId, seller))`
  - Escrow check: `ticket.ownerOf(tokenId)` should equal `marketplaceV2`

---

## Test run log
Use this section to record each manual test with exact steps and outcomes.

Template:
- Time: <YYYY-MM-DD HH:mm local>
- Wallet: <addr short> | Chain: <id>
- Step: <Mint / List / Cancel / Buy / Quiz>
- Preconditions: <connected, balanceOf, etc.>
- Actions: <clicks / inputs>
- Expected: <expected UI/tx>
- Observed: <actual UI/tx>
- Tx hash: <0x...> (if any)
- Notes: <console logs, screenshots, anomalies>

Entries:
- (pending)
