const STROOPS_PER_XLM = 10_000_000n;

export function stroopsToXlm(stroops: string | bigint): string {
  const value = typeof stroops === "string" ? BigInt(stroops) : stroops;
  const whole = value / STROOPS_PER_XLM;
  const frac = value % STROOPS_PER_XLM;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function xlmToStroops(xlm: string): bigint {
  const [whole, frac = ""] = xlm.trim().split(".");
  const paddedFrac = (frac + "0000000").slice(0, 7);
  const wholePart = BigInt(whole || "0") * STROOPS_PER_XLM;
  const fracPart = BigInt(paddedFrac || "0");
  return wholePart + fracPart;
}

export function formatAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatRelativeTime(unixSeconds: number): string {
  const deltaMs = Date.now() - unixSeconds * 1000;
  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec < 5) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const deltaMin = Math.floor(deltaSec / 60);
  if (deltaMin < 60) return `${deltaMin}m ago`;
  const deltaHr = Math.floor(deltaMin / 60);
  if (deltaHr < 24) return `${deltaHr}h ago`;
  const deltaDay = Math.floor(deltaHr / 24);
  return `${deltaDay}d ago`;
}
