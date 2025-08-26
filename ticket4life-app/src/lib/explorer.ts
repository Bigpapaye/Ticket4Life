const BASE_SEPOLIA = "https://sepolia.basescan.org";

export function txUrl(hash: string): string {
  return `${BASE_SEPOLIA}/tx/${hash}`;
}

export function addrUrl(addr: string): string {
  return `${BASE_SEPOLIA}/address/${addr}`;
}

export function tokenUrl(addr: string, tokenId: string | number | bigint): string {
  return `${BASE_SEPOLIA}/token/${addr}?a=${tokenId.toString()}`;
}
