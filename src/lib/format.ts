import { format, parseISO, formatDistanceToNowStrict } from 'date-fns';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n: number | null | undefined, opts: { pennies?: boolean } = {}) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return (opts.pennies ? gbp2 : gbp).format(Number(n));
};

export const signedMoney = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const v = Number(n);
  return (v > 0 ? '+' : '') + money(v);
};

export const pct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? '—' : `${(Number(n) * 100).toFixed(digits)}%`;

export const dateShort = (d: string | null | undefined) => (d ? format(parseISO(d), 'd MMM yyyy') : '—');
export const dateTiny = (d: string | null | undefined) => (d ? format(parseISO(d), 'd MMM') : '—');
export const ago = (d: string | null | undefined) => (d ? formatDistanceToNowStrict(parseISO(d), { addSuffix: true }) : '—');
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

export const vehicleTitle = (v: { make?: string | null; model?: string | null; registration?: string | null }) =>
  [v.make, v.model].filter(Boolean).join(' ') || v.registration || 'Vehicle';

export const statusLabel: Record<string, string> = {
  for_sale: 'For sale',
  awaiting_prep: 'In prep',
  sold: 'Sold',
  reserved: 'Reserved',
};

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd');
