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

async function usedNumbers(table: string, column: string, prefix: string): Promise<Set<number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = supabase.from(table as never).select(column).ilike(column, `${prefix}\\_%`);
  const { data } = await q;
  const used = new Set<number>();
  ((data ?? []) as Array<Record<string, unknown>>).forEach((row) => {
    const val = row[column];
    if (typeof val === "string") {
      const p = parseEntryNo(val);
      if (p && p.prefix === prefix) used.add(p.num);
    }
  });
  return used;
}

export function nextGap(used: Set<number>): number {
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export async function nextEntryNo(table: "purchases" | "sales", column: "entry_no" | "sale_no", date: Date = new Date()): Promise<string> {
  const prefix = monthPrefix(date);
  const used = await usedNumbers(table, column, prefix);
  return `${prefix}_${nextGap(used)}`;
}

export async function entryNoExists(table: "purchases" | "sales", column: "entry_no" | "sale_no", value: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = supabase.from(table as never).select("id").eq(column, value).limit(1);
  const { data } = await q;
  return (data?.length ?? 0) > 0;
}
