import { supabase } from "@/integrations/supabase/client";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function monthPrefix(date: Date = new Date()): string {
  return `${MONTHS[date.getMonth()]}${date.getFullYear()}`;
}

export function parseEntryNo(entry: string): { prefix: string; num: number } | null {
  const m = /^([A-Za-z]{3}\d{4})_(\d+)$/.exec(entry.trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

/** Get list of used numbers for the given month prefix in a table + column. */
async function usedNumbers(table: "purchases" | "sales", column: "entry_no" | "sale_no", prefix: string): Promise<Set<number>> {
  const { data } = await supabase
    .from(table)
    .select(column)
    .ilike(column, `${prefix}\\_%`);
  const used = new Set<number>();
  (data ?? []).forEach((row: Record<string, unknown>) => {
    const val = row[column];
    if (typeof val === "string") {
      const p = parseEntryNo(val);
      if (p && p.prefix === prefix) used.add(p.num);
    }
  });
  return used;
}

/** Find the smallest positive integer not present in `used`. */
export function nextGap(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export async function nextEntryNo(
  table: "purchases" | "sales",
  column: "entry_no" | "sale_no",
  date: Date = new Date(),
): Promise<string> {
  const prefix = monthPrefix(date);
  const used = await usedNumbers(table, column, prefix);
  return `${prefix}_${nextGap(used)}`;
}

export async function entryNoExists(
  table: "purchases" | "sales",
  column: "entry_no" | "sale_no",
  value: string,
): Promise<boolean> {
  const { data } = await supabase.from(table).select("id").eq(column, value).limit(1);
  return (data?.length ?? 0) > 0;
}
