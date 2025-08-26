export const CONTRACTS = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532),
  ticket: process.env.NEXT_PUBLIC_TICKET_ADDRESS as `0x${string}` | undefined,
  marketplace: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}` | undefined,
  marketplaceV2: process.env.NEXT_PUBLIC_MARKETPLACEV2_ADDRESS as `0x${string}` | undefined,
  buyback: process.env.NEXT_PUBLIC_BUYBACK_ADDRESS as `0x${string}` | undefined,
  treasury: process.env.NEXT_PUBLIC_TREASURY_ADDRESS as `0x${string}` | undefined,
  distribution: process.env.NEXT_PUBLIC_DISTRIBUTION_ADDRESS as `0x${string}` | undefined,
  quiz: process.env.NEXT_PUBLIC_QUIZ_ADDRESS as `0x${string}` | undefined,
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}` | undefined,
};

// Minimal ABIs
export const ABI = {
  ticket: [
    { inputs: [], stateMutability: "payable", type: "function", name: "mint", outputs: [] },
    { inputs: [], name: "MINT_PRICE", outputs: [ { name: "", type: "uint256" } ], stateMutability: "view", type: "function" },
    { inputs: [], name: "treasury", outputs: [ { name: "", type: "address" } ], stateMutability: "view", type: "function" },
    { inputs: [], name: "owner", outputs: [ { name: "", type: "address" } ], stateMutability: "view", type: "function" },
    { inputs: [ { name: "operator", type: "address" }, { name: "approved", type: "bool" } ], name: "setApprovalForAll", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [ { name: "owner", type: "address" } ], name: "balanceOf", outputs: [ { name: "", type: "uint256" } ], stateMutability: "view", type: "function" },
    { inputs: [ { name: "tokenId", type: "uint256" } ], name: "ownerOf", outputs: [ { name: "", type: "address" } ], stateMutability: "view", type: "function" },
    { inputs: [], name: "nextId", outputs: [ { name: "", type: "uint256" } ], stateMutability: "view", type: "function" },
    { type: "event", name: "Minted", inputs: [ { name: "minter", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }, { name: "value", type: "uint256", indexed: false } ] },
  ] as const,
  marketplaceV2: [
    { name: "list", type: "function", stateMutability: "nonpayable", inputs: [ { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" } ], outputs: [] },
    { name: "cancel", type: "function", stateMutability: "nonpayable", inputs: [ { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" } ], outputs: [] },
    { name: "buy", type: "function", stateMutability: "payable", inputs: [ { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "seller", type: "address" } ], outputs: [] },
    { name: "listings", type: "function", stateMutability: "view", inputs: [ { name: "id", type: "bytes32" } ], outputs: [
      { name: "seller", type: "address" },
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" }
    ] },
    { type: "event", name: "Listed", inputs: [ { name: "id", type: "bytes32", indexed: false }, { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false } ] },
    { type: "event", name: "Cancelled", inputs: [ { name: "id", type: "bytes32", indexed: false } ] },
    { type: "event", name: "Bought", inputs: [ { name: "id", type: "bytes32", indexed: false }, { name: "buyer", type: "address", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false } ] },
    { type: "event", name: "SaleSettled", inputs: [ { name: "id", type: "bytes32", indexed: false }, { name: "buyer", type: "address", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }, { name: "payout", type: "uint256", indexed: false } ] },
  ] as const,
  erc721: [
    { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [ { name: "owner", type: "address" }, { name: "operator", type: "address" } ], name: "isApprovedForAll", outputs: [ { name: "", type: "bool" } ], stateMutability: "view", type: "function" },
    { inputs: [ { name: "operator", type: "address" }, { name: "approved", type: "bool" } ], name: "setApprovalForAll", outputs: [], stateMutability: "nonpayable", type: "function" },
    { type: "event", name: "Transfer", inputs: [ { name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: true } ] },
  ] as const,
  marketplace: [
    { name: "list", type: "function", stateMutability: "nonpayable", inputs: [ { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" } ], outputs: [] },
    { name: "cancel", type: "function", stateMutability: "nonpayable", inputs: [ { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" } ], outputs: [] },
    { name: "buy", type: "function", stateMutability: "payable", inputs: [ { name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "seller", type: "address" } ], outputs: [] },
    { name: "listings", type: "function", stateMutability: "view", inputs: [ { name: "id", type: "bytes32" } ], outputs: [
      { name: "seller", type: "address" },
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "active", type: "bool" }
    ] },
    { type: "event", name: "Listed", inputs: [ { name: "id", type: "bytes32", indexed: false }, { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false } ] },
    { type: "event", name: "Cancelled", inputs: [ { name: "id", type: "bytes32", indexed: false } ] },
    { type: "event", name: "Bought", inputs: [ { name: "id", type: "bytes32", indexed: false }, { name: "buyer", type: "address", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false } ] },
    { type: "event", name: "SaleSettled", inputs: [ { name: "id", type: "bytes32", indexed: false }, { name: "buyer", type: "address", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "nft", type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: false }, { name: "price", type: "uint256", indexed: false }, { name: "fee", type: "uint256", indexed: false }, { name: "payout", type: "uint256", indexed: false } ] },
  ] as const,
  treasury: [
    { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { name: "salePool", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "prizePool", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "buybackPool", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "depositToPrize", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
    { name: "depositToSale", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
    { name: "depositToBuyback", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
    { name: "spendPrize", type: "function", stateMutability: "nonpayable", inputs: [ { name: "to", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [] },
    { name: "spendSale", type: "function", stateMutability: "nonpayable", inputs: [ { name: "to", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [] },
    { name: "spendBuyback", type: "function", stateMutability: "nonpayable", inputs: [ { name: "to", type: "address" }, { name: "amount", type: "uint256" } ], outputs: [] },
    { name: "buyFromMarketplace", type: "function", stateMutability: "nonpayable", inputs: [
      { name: "market", type: "address" },
      { name: "nft", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "to", type: "address" },
      { name: "price", type: "uint256" }
    ], outputs: [] },
    { type: "event", name: "Received", inputs: [ { name: "from", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false } ] },
    { type: "event", name: "PoolMoved", inputs: [ { name: "pool", type: "string", indexed: true }, { name: "amount", type: "int256", indexed: false } ] },
  ] as const,
  buyback: [
    { name: "priceWei", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
    { name: "sell", type: "function", stateMutability: "nonpayable", inputs: [ { name: "tokenId", type: "uint256" } ], outputs: [] },
  ] as const,
  distribution: [
    { name: "distribute", type: "function", stateMutability: "payable", inputs: [ { name: "w1", type: "address" }, { name: "w2", type: "address" }, { name: "w3", type: "address" }, { name: "seed", type: "bytes32" } ], outputs: [] },
  ] as const,
  quiz: [
    { name: "setRegistry", type: "function", stateMutability: "nonpayable", inputs: [ { name: "r", type: "address" } ], outputs: [] },
    { name: "registry", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { name: "quizId", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
    { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
    { name: "hasQuiz", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
    { name: "get", type: "function", stateMutability: "view", inputs: [], outputs: [
      { name: "title", type: "string" },
      { name: "question", type: "string" },
      { name: "options", type: "string[]" },
      { name: "active", type: "bool" }
    ] },
    { name: "correctIndex", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
    { name: "hasSubmitted", type: "function", stateMutability: "view", inputs: [ { name: "", type: "address" } ], outputs: [ { name: "", type: "bool" } ] },
    { name: "getStats", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "participants", type: "uint256" }, { name: "correct", type: "uint256" } ] },
    { name: "historyLength", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
    { name: "getHistory", type: "function", stateMutability: "view", inputs: [ { name: "index", type: "uint256" } ], outputs: [
      { name: "id", type: "uint256" },
      { name: "title", type: "string" },
      { name: "question", type: "string" },
      { name: "options", type: "string[]" },
      { name: "correctIdx", type: "uint8" },
      { name: "participants", type: "uint256" },
      { name: "correct", type: "uint256" },
      { name: "endedAt", type: "uint256" }
    ] },
    { name: "create", type: "function", stateMutability: "nonpayable", inputs: [ { name: "title", type: "string" } ], outputs: [] },
    { name: "setActive", type: "function", stateMutability: "nonpayable", inputs: [ { name: "active_", type: "bool" } ], outputs: [] },
    { name: "setQA", type: "function", stateMutability: "nonpayable", inputs: [ { name: "question", type: "string" }, { name: "options", type: "string[]" }, { name: "correctIndex", type: "uint8" } ], outputs: [] },
    { name: "endQuiz", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
    { name: "submit", type: "function", stateMutability: "nonpayable", inputs: [ { name: "answer", type: "uint8" } ], outputs: [] },
    { name: "eligibleCount", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
    { name: "isEligible", type: "function", stateMutability: "view", inputs: [ { name: "a", type: "address" } ], outputs: [ { name: "", type: "bool" } ] },
    { name: "getLastWinners", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "w1", type: "address" }, { name: "w2", type: "address" }, { name: "w3", type: "address" }, { name: "seed", type: "bytes32" } ] },
    { name: "drawWinners", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
    { name: "adminMarkOwnedTicketsEligible", type: "function", stateMutability: "nonpayable", inputs: [ { name: "who", type: "address" }, { name: "cap", type: "uint256" } ], outputs: [] },
    { type: "event", name: "QuizCreated", inputs: [ { name: "id", type: "uint256", indexed: true }, { name: "title", type: "string", indexed: false } ] },
    { type: "event", name: "QuizUpdated", inputs: [ { name: "title", type: "string", indexed: false }, { name: "question", type: "string", indexed: false }, { name: "options", type: "string[]", indexed: false }, { name: "correctIndex", type: "uint8", indexed: false }, { name: "active", type: "bool", indexed: false } ] },
    { type: "event", name: "QuizActivationChanged", inputs: [ { name: "active", type: "bool", indexed: false } ] },
    { type: "event", name: "AnswerSubmitted", inputs: [ { name: "player", type: "address", indexed: true }, { name: "answer", type: "uint8", indexed: false }, { name: "correct", type: "bool", indexed: false } ] },
    { type: "event", name: "WinnersDrawn", inputs: [ { name: "id", type: "uint256", indexed: true }, { name: "w1", type: "address", indexed: false }, { name: "w2", type: "address", indexed: false }, { name: "w3", type: "address", indexed: false }, { name: "seed", type: "bytes32", indexed: false } ] },
    { type: "event", name: "QuizEnded", inputs: [ { name: "id", type: "uint256", indexed: true }, { name: "title", type: "string", indexed: false }, { name: "participants", type: "uint256", indexed: false }, { name: "correct", type: "uint256", indexed: false } ] },
    { type: "event", name: "VRFRequested", inputs: [ { name: "id", type: "uint256", indexed: true }, { name: "requestId", type: "uint256", indexed: false } ] },
    { type: "event", name: "RegistrySet", inputs: [ { name: "registry", type: "address", indexed: true } ] },
    { type: "event", name: "AdminTicketsMarked", inputs: [ { name: "who", type: "address", indexed: true }, { name: "count", type: "uint256", indexed: false } ] },
  ] as const,
  registry: [
    { name: "setAuthorized", type: "function", stateMutability: "nonpayable", inputs: [ { name: "who", type: "address" }, { name: "auth", type: "bool" } ], outputs: [] },
    { name: "recordDistribution", type: "function", stateMutability: "nonpayable", inputs: [
      { name: "w1", type: "address" },
      { name: "w2", type: "address" },
      { name: "w3", type: "address" },
      { name: "a1", type: "uint256" },
      { name: "a2", type: "uint256" },
      { name: "a3", type: "uint256" },
      { name: "t1", type: "bytes32" },
      { name: "t2", type: "bytes32" },
      { name: "t3", type: "bytes32" },
      { name: "seed", type: "bytes32" },
      { name: "at", type: "uint256" },
      { name: "source", type: "address" },
    ], outputs: [] },
    { name: "quizEndsLength", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
    { name: "distributionsLength", type: "function", stateMutability: "view", inputs: [], outputs: [ { name: "", type: "uint256" } ] },
    { name: "getQuizEnd", type: "function", stateMutability: "view", inputs: [ { name: "index", type: "uint256" } ], outputs: [
      { name: "id", type: "uint256" },
      { name: "title", type: "string" },
      { name: "question", type: "string" },
      { name: "options", type: "string[]" },
      { name: "correctIdx", type: "uint8" },
      { name: "participants", type: "uint256" },
      { name: "correct", type: "uint256" },
      { name: "w1", type: "address" },
      { name: "w2", type: "address" },
      { name: "w3", type: "address" },
      { name: "seed", type: "bytes32" },
      { name: "endedAt", type: "uint256" },
      { name: "source", type: "address" },
    ] },
    { name: "getDistribution", type: "function", stateMutability: "view", inputs: [ { name: "index", type: "uint256" } ], outputs: [
      { name: "w1", type: "address" },
      { name: "w2", type: "address" },
      { name: "w3", type: "address" },
      { name: "a1", type: "uint256" },
      { name: "a2", type: "uint256" },
      { name: "a3", type: "uint256" },
      { name: "t1", type: "bytes32" },
      { name: "t2", type: "bytes32" },
      { name: "t3", type: "bytes32" },
      { name: "seed", type: "bytes32" },
      { name: "at", type: "uint256" },
      { name: "source", type: "address" },
    ] },
  ] as const,
};

// Parsed deploy block numbers (optional). Use to bound getLogs scans.
function parseBlock(v?: string): bigint {
  try {
    if (!v) return 0n;
    const t = v.trim();
    if (!t) return 0n;
    const n = BigInt(t);
    return n >= 0n ? n : 0n;
  } catch { return 0n; }
}

export const DEPLOY_BLOCKS = {
  ticket: parseBlock(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_TICKET),
  marketplace: parseBlock(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_MARKETPLACE),
  marketplaceV2: parseBlock(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_MARKETPLACEV2),
  registry: parseBlock(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_REGISTRY),
  treasury: parseBlock(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_TREASURY),
  buyback: parseBlock(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_BUYBACK),
} as const;
