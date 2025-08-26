# Ticket4Life — Quiz Page Full Audit Checklist

Maintain and check off items as you validate functionality across frontend, backend, and smart contracts.

Last updated: 2025-08-24

---

## Frontend (Next.js app)

- [x] Use centralized addresses from `src/config/contracts.ts` only (`CONTRACTS.ticket`, `CONTRACTS.quiz`, etc.).
- [x] Await confirmed receipts for writes with `withTxToasts` in `src/lib/txToasts.ts` to prevent false success UI.
- [x] Fix TDZ bug on `src/app/quiz/page.tsx`: compute `hasTicketEffective` after `eligible` is defined.
- [x] Quiz gating logic in `src/app/quiz/page.tsx`:
  - [x] Require on-chain active quiz (`hasQuiz`/`get().active`) before showing submission.
  - [x] Show mint button if user lacks a ticket; allow submission once user has a ticket or `mintedSuccess` is true.
  - [x] Prevent re-submission if `hasSubmitted(address)` is true.
  - [x] Prevent submission if already eligible (`isEligible(address)` true). Note: eligibility implies submission via contract invariants.
  - [x] Handle and surface revert reasons: `Quiz inactive`, `Already submitted`, `Bad answer`, `NO_TICKET`.
- [x] Ensure `buying` / `submitting` flags correctly disable buttons and show spinners during pending tx.
- [x] Display quiz metadata and options from `quiz.get()` correctly; handle empty state when no quiz exists.
- [x] Confirm answer encoding matches contract (`uint8` index; bounds checked in UI and contract).
- [x] Verify toasts and UI state reset properly after failed tx to allow retry.
- [x] Home page `src/app/page.tsx` uses same mint price and write flow; verified no divergence.
- [ ] Add diagnostics banner if multiple distinct ticket addresses are detected in env or reads (defense-in-depth).
- [x] Cross-page consistency audit: marketplace pages use the same `CONTRACTS.ticket` and show current `MINT_PRICE`.

## Backend / API

- [x] Inventory `src/app/api/` — only `treasury/` present; no quiz-related endpoints. Quiz flows are on-chain via wagmi/viem.
- [x] Verify any planned server actions or edge functions are not required for quiz submission (confirm purely on-chain).

## Environment & Config

- [x] `NEXT_PUBLIC_TICKET_ADDRESS` single source of truth; no hardcoded alternates.
- [x] `EnvGuard` (`src/components/EnvGuard.tsx`) reads on-chain `MINT_PRICE` and warns if not exactly 0.002 ETH.
- [x] Confirm `NEXT_PUBLIC_QUIZ_ADDRESS` is set in env.
- [ ] Verify `NEXT_PUBLIC_QUIZ_ADDRESS` matches the deployed `QuizManager` on the target chain (on-chain check).
- [ ] Confirm `NEXT_PUBLIC_CHAIN_ID` matches connected chain; prompt to switch if not (add guard on `/quiz`).
- [ ] Deployment configs (production/staging) include all required vars and are consistent.

## Smart Contracts

### `contracts/src/Ticket4LifeTicket.sol`
- [x] `MINT_PRICE` constant equals 0.002 ETH.
- [x] Enforces 1 ticket per wallet (`ONE_PER_WALLET`) except contract `owner()`.
- [x] Emits `Minted` event with tokenId and price.
- [x] Sends proceeds to `treasury` and reverts on failed transfer.
- [ ] Verify `treasury` is set to the intended address in deployments.

### `contracts/src/QuizManager.sol`
- [x] Requires active quiz and one submission per quizId (`lastSubmittedQuizId`) in `submit()`.
- [x] Requires holding a ticket (`IERC721(ticket).balanceOf(msg.sender) > 0`).
- [x] Tracks participants and correct counts; marks eligible on correct submissions.
- [x] Admin-only functions: `create`, `setQA`, `setActive`, `endQuiz`, `setVRFParams`, `drawWinners`, `adminMarkOwnedTicketsEligible`, `setTicket`.
- [x] VRF integration for winner selection; emits `VRFRequested` and `WinnersDrawn`.
- [x] `endQuiz()` archives snapshot, optionally records in `QuizRegistry`, clears eligibility state.
- [ ] Review `adminMarkOwnedTicketsEligible` semantics: pushes `count` entries (capped by `MAX_ELIGIBILITY_PUSH`) — confirm policy allows multiple entries per address and intended fairness.
- [ ] Confirm `callbackGasLimit`, `requestConfirmations`, and `numWords` are adequate for target network and list sizes.
- [ ] Verify `setTicket()` is not callable by non-owner; ensure UI surfaces ticket address changes.

### `contracts/src/QuizRegistry.sol`
- [x] Append-only arrays for quiz ends and distributions.
- [x] `onlyAuthorized` gate for recording; `owner` can authorize writers.
- [ ] Ensure `QuizManager` is authorized in deployments if registry is used.

## Events & Indexing

- [ ] Define indexing plan for `QuizCreated`, `QuizUpdated`, `AnswerSubmitted`, `WinnersDrawn`, `QuizEnded`, and `ticket.Minted`.
- [ ] Add optional UI hooks/log scans bounded by `DEPLOY_BLOCKS` in `src/config/contracts.ts`.

## Testing (E2E on testnet)

- [ ] Mint flow: wallet without ticket mints successfully, balance increments, UI updates.
- [ ] Eligibility: cannot submit without ticket; can submit with ticket; submitting correct answer marks as eligible.
- [ ] Prevent duplicates: cannot submit twice for same `quizId`.
- [ ] Failure handling: simulate reverted tx (wrong price, wrong network) — UI shows error, allows retry.
- [ ] Post-mint: `mintedSuccess` path allows immediate submit without page reload.
- [ ] VRF: owner triggers `drawWinners()` when eligible pool non-empty; winners surface in UI via `getLastWinners()`.

## Operational Runbook

- [ ] Owner flow: `create(title)` → `setQA(question, options, correctIndex)` → `setActive(true)`.
- [ ] During quiz: monitor `getStats()` for participants/correct; verify UI matches.
- [ ] Ending quiz: call `endQuiz()`; if registry set, verify record in `QuizRegistry`.
- [ ] Prize distribution: optionally record via `QuizRegistry.recordDistribution` with tx hashes.

## Known Fixes Completed

- [x] Fixed ReferenceError on quiz page by reordering variable initialization.
- [x] Added on-chain mint price validation in `EnvGuard` (warn if != 0.002 ETH).
- [x] Enforced success toasts only after confirmed tx receipts in `withTxToasts`.

## Implementation Notes (dev)

* __UI guards and gating__
  - __Diagnostics banner__: at app root or `/quiz` layout, compute distinct addresses observed from: env (`NEXT_PUBLIC_TICKET_ADDRESS`, `NEXT_PUBLIC_QUIZ_ADDRESS`) and client config (`CONTRACTS.ticket`, `CONTRACTS.quiz`). If more than one unique value per contract type, render a non-blocking warning with the list of sources and values. Also read `QuizManager.ticket()` on-chain and verify it equals `CONTRACTS.ticket`.
  - __Chain guard on `/quiz`__: compare connected `chain.id` with `Number(NEXT_PUBLIC_CHAIN_ID)`. If mismatch, show a call-to-action to switch network; disable mint/submit until aligned. Keep UI readable; do not fully block read-only views.
  - __QUIZ address validation__: on mount, read from chain a cheap invariant: `QuizManager.ticket()` and optionally `owner()` if available. If read fails or ticket mismatch, surface error in banner and prevent submission.

* __State and flags__
  - Derive booleans with memoization: `hasTicket`, `hasSubmitted`, `isEligible`, `hasActiveQuiz`. Avoid computing `hasTicketEffective` before the dependencies resolve to prevent TDZ.
  - Ensure `buying`/`submitting` strictly reflect pending writes and reset on error to re-enable actions.

* __Read/write practices__
  - Batch on-chain reads with `useReadContracts` where feasible; set `staleTime` to reduce refetch churn.
  - For writes, await the transaction receipt (1 confirmation minimum) before setting success UI or toasts.

## Verification Steps (how-to)

* __Ticket/Quiz addresses__
  - Compare env vs config: `NEXT_PUBLIC_TICKET_ADDRESS` <-> `CONTRACTS.ticket`, `NEXT_PUBLIC_QUIZ_ADDRESS` <-> `CONTRACTS.quiz`.
  - Read `quiz.ticket()`; must equal `CONTRACTS.ticket`.
  - Confirm `NEXT_PUBLIC_CHAIN_ID` equals the connected chain. If not, verify guard shows and the switch action works.

* __Quiz flow__
  - No ticket: mint visible; submit disabled with clear hint. After mint success (without reload), submit becomes enabled.
  - With ticket: can submit exactly once per `quizId`. Wrong answer reverts with `Bad answer` and keeps UI consistent.
  - Eligible users cannot submit again; UI shows eligibility status and disables submission.

## Events & Indexing Plan

* __Events to observe__
  - Ticket: `Minted(tokenId, price)`
  - QuizManager: `QuizCreated`, `QuizUpdated`, `AnswerSubmitted(address, quizId, correct)`, `WinnersDrawn`, `QuizEnded`, `VRFRequested`

* __Indexing strategy__
  - Add deploy block hints in `src/config/contracts.ts`: `DEPLOY_BLOCK_TICKET`, `DEPLOY_BLOCK_QUIZ`.
  - UI-level light indexing using viem/wagmi watchers, bounded by deploy blocks for performance.
  - Optional: external indexer (The Graph or simple backend) if historical analytics are required.

## Accessibility (a11y)

* __Interactive controls__: disabled states must be perceivable; add `aria-disabled` and `aria-busy` during tx.
* __Toasts and errors__: announce via `aria-live="polite"`; provide dismiss buttons accessible via keyboard.
* __Forms__: associate labels with inputs; ensure focus moves to error summary on failed submit.
* __Contrast__: buttons and banners meet WCAG AA contrast.

## Performance

* __Caching__: set generous `staleTime` for static reads (mint price, current quiz metadata) and shorter for user-specific reads.
* __Batching__: coalesce multiple reads; avoid refetch loops on transient state flips.
* __Defer heavy reads__: fetch winners/history on demand or when panel is opened.

## Env Appendix

* __NEXT_PUBLIC_TICKET_ADDRESS__: 0x… address for `Ticket4LifeTicket` on target chain.
* __NEXT_PUBLIC_QUIZ_ADDRESS__: 0x… address for `QuizManager` on target chain.
* __NEXT_PUBLIC_CHAIN_ID__: numeric chain id (e.g., 1, 11155111).
* __RPC provider key(s)__: e.g., `NEXT_PUBLIC_ALCHEMY_API_KEY` or `NEXT_PUBLIC_INFURA_ID` when used.

## Next Actions

* __Implement Diagnostics Banner__ in `src/components/` and mount on `/quiz` page.
* __Add Chain Guard__: gentle blocker with switch button; integrate with existing gating.
* __Add deploy block hints__ to `src/config/contracts.ts` for bounded event scans.
* __Prepare `.env.template`__ reflecting the Env Appendix for easier setup.

---

Tips:
- Keep all contract addresses and deploy block numbers in `src/config/contracts.ts` and env vars.
- Prefer on-chain reads (wagmi/viem) over backend for quiz flow — backend currently not involved.
