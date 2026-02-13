export function fmtUSD(n: number | string) {
  const num = Number(n);
  if (!Number.isFinite(num) || Number.isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}
