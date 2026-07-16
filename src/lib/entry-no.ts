import { supabase } from "@/integrations/supabase/client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthPrefix(type: string, date: Date = new Date()): string {
  return `${date.getFullYear()}-${MONTHS[date.getMonth()]}-${type}`;
}

export function parseEntryNo(entry: string): { prefix: string; num: number } | null {
  const m = /^(\d{4}-[A-Za-z]{3}-[A-Za-z]+)-(\d+)$/.exec(entry.trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

export function nextGap(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

async function usedNumbersFromColumn(table: string, column: string, prefix: string, useLike = true): Promise<Set<number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = useLike
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (supabase.from(table as never) as any).select(column).ilike(column, `${prefix}-%`)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (supabase.from(table as never) as any).select(column);
  const { data } = await q;
  const used = new Set<number>();
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const val = row[column];
    if (typeof val === "string") {
      // Extract our prefix pattern even when embedded in remarks text
      const re = new RegExp(`\\b${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}-(\\d+)\\b`);
      const mm = re.exec(val);
      if (mm) used.add(parseInt(mm[1], 10));
    }
  });
  return used;
}

/** Generic: get next MonthPrefixed sequential ref for any table/column. */
export async function nextRef(opts: {
  table: string;
  column: string;
  type: string; // e.g. "P", "S", "VP", "RP"
  date?: Date;
  scanRemarks?: boolean; // if true, uses substring match instead of ilike prefix
}): Promise<string> {
  const prefix = monthPrefix(opts.type, opts.date ?? new Date());
  const used = await usedNumbersFromColumn(opts.table, opts.column, prefix, !opts.scanRemarks);
  return `${prefix}-${nextGap(used)}`;
}

// Back-compat helpers used by purchases/sales
type EntryTable = "purchases" | "sales";
type EntryColumn = "entry_no" | "sale_no";
export async function nextEntryNo(table: EntryTable, column: EntryColumn, date: Date = new Date()): Promise<string> {
  const type = table === "purchases" ? "P" : "S";
  return nextRef({ table, column, type, date });
}
export async function entryNoExists(table: EntryTable, column: EntryColumn, value: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = (supabase.from(table as never) as any).select("id").eq(column, value).limit(1);
  const { data } = await q;
  return (data?.length ?? 0) > 0;
}
