export function formatCurrencyAmount(
  amountMinor: number,
  currency: string,
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function formatCashInput(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

export function formatTimestamp(timestamp: string): string {
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
  return `${formatted} UTC`;
}
