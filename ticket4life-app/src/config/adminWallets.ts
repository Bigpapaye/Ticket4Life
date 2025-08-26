export const adminWallets: `0x${string}`[] = [
  // Add admin wallet addresses here (checksummed).
  "0x4999BCb319C604FF5Dc5dFE29159fEb4A091f7dE",
  "0x587AF9a70AE339C47848Da88748ce537C724d1b2",
];

export function isAdmin(address?: `0x${string}` | null): boolean {
  if (!address) return false;
  return adminWallets.map((a) => a.toLowerCase()).includes(address.toLowerCase());
}
