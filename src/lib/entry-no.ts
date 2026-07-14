import { supabase } from "@/integrations/supabase/client";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type EntryTable = "purchases" | "sales";
type EntryColumn = "entry_no" | "sale_no";

function entryType(table: EntryTable): "P" | "S" {
  return table === "purchases" ? "P" : "S";
}

export function monthPrefix(date: Date = new Date(), type: "P" | "S" = "P"): string {
  return `${date.getFullYear()}-${MONTHS[date.getMonth()]}-${type}`;
}

export function parseEntryNo(entry: string): { prefix: string; num: number } | null {
  const m = /^(\d{4}-[A-Za-z]{3}-[PS])-(\d+)$/.exec(entry.trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

async function usedNumbers(table: string, column: string, prefix: string): Promise<Set<number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = supabase.from(table as never).select(column).ilike(column, `${prefix}-%`);
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

export async function nextEntryNo(table: EntryTable, column: EntryColumn, date: Date = new Date()): Promise<string> {
  const prefix = monthPrefix(date, entryType(table));
  const used = await usedNumbers(table, column, prefix);
  return `${prefix}-${nextGap(used)}`;
}

export async function entryNoExists(table: EntryTable, column: EntryColumn, value: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = supabase.from(table as never).select("id").eq(column, value).limit(1);
  const { data } = await q;
  return (data?.length ?? 0) > 0;
}
