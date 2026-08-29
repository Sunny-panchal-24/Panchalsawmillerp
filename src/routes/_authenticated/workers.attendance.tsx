import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/workers/attendance")({
  component: AttendancePage,
});

type Status = "present" | "half" | "absent" | "weekly_off";
type Worker = { id: string; name: string; daily_wage: number };
type Row = { worker_id: string; status: Status; id?: string };

const STATUSES: { key: Status; label: string; cls: string }[] = [
  { key: "present", label: "P", cls: "bg-emerald-600 text-white border-emerald-700" },
  { key: "half", label: "½", cls: "bg-amber-500 text-white border-amber-600" },
  { key: "absent", label: "A", cls: "bg-rose-600 text-white border-rose-700" },
  { key: "weekly_off", label: "WO", cls: "bg-slate-500 text-white border-slate-600" },
];

function AttendancePage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async (d: string) => {
    setLoading(true);
    const [w, a] = await Promise.all([
      supabase.from("workers").select("id,name,daily_wage").eq("is_active", true).order("name"),
      supabase.from("worker_attendance").select("id,worker_id,status").eq("attendance_date", d),
    ]);
    const ws = (w.data ?? []) as Worker[];
    setWorkers(ws);
    const map: Record<string, Row> = {};
    ws.forEach((x) => (map[x.id] = { worker_id: x.id, status: "present" }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a.data ?? []).forEach((r: any) => (map[r.worker_id] = { worker_id: r.worker_id, status: r.status, id: r.id }));
    setRows(map);
    setLoading(false);
  };

  useEffect(() => { load(date); }, [date]);

  const setStatus = (workerId: string, status: Status) => {
    setRows((prev) => ({ ...prev, [workerId]: { ...prev[workerId], worker_id: workerId, status } }));
  };

  const saveAll = async () => {
    setSaving(true);
    const payload = Object.values(rows).map((r) => ({
      worker_id: r.worker_id,
      attendance_date: date,
      status: r.status,
    }));
    const { error } = await supabase
      .from("worker_attendance")
      .upsert(payload, { onConflict: "worker_id,attendance_date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Attendance saved");
    load(date);
  };

  const markAll = (status: Status) => {
    const next: Record<string, Row> = {};
    workers.forEach((w) => (next[w.id] = { ...rows[w.id], worker_id: w.id, status }));
    setRows(next);
  };

  return (
    <AppShell title="Attendance" backTo="/workers">
      <Tabs defaultValue="day">
        <TabsList className="w-full mb-3">
          <TabsTrigger value="day" className="flex-1">{tt("daily_entry")}</TabsTrigger>
          <TabsTrigger value="cal" className="flex-1">{tt("calendar")}</TabsTrigger>
        </TabsList>
        <TabsContent value="cal">
          <AttendanceCalendar workers={workers} />
        </TabsContent>
        <TabsContent value="day">
      <div className="space-y-4">

        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12" />
        </div>

        <div className="grid grid-cols-4 gap-2">
          {STATUSES.map((s) => (
            <Button key={s.key} variant="outline" size="sm" onClick={() => markAll(s.key)}>All {s.label}</Button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading...</div>
        ) : workers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">No active workers. Add from Masters.</div>
        ) : (
          <div className="space-y-2">
            {workers.map((w) => {
              const cur = rows[w.id]?.status ?? "present";
              return (
                <div key={w.id} className="rounded-lg border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-xs text-muted-foreground">₹{Number(w.daily_wage).toFixed(2)}/day</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {STATUSES.map((s) => {
                      const active = cur === s.key;
                      return (
                        <button
                          key={s.key}
                          type="button"
                          onClick={() => setStatus(w.id, s.key)}
                          className={`h-12 rounded-lg border-2 font-bold text-lg transition ${active ? s.cls : "border-border bg-background text-foreground"}`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button className="w-full h-14 text-lg" disabled={saving || workers.length === 0} onClick={saveAll}>
          {saving ? "Saving..." : "Save Attendance"}
        </Button>
      </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function AttendanceCalendar({ workers }: { workers: Worker[] }) {
  const { t: tt } = useI18n();
  const [workerId, setWorkerId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [map, setMap] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workers.length) return;
    if (!workerId) setWorkerId(workers[0].id);
  }, [workers, workerId]);

  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = first.getDay();

  const load = async () => {
    if (!workerId) return;
    setBusy(true);
    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, "0")}`;
    const { data } = await supabase
      .from("worker_attendance")
      .select("attendance_date,status")
      .eq("worker_id", workerId)
      .gte("attendance_date", from)
      .lte("attendance_date", to);
    const next: Record<string, Status> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).forEach((r: any) => (next[r.attendance_date] = r.status));
    setMap(next);
    setBusy(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workerId, month]);

  const cycle = async (dateStr: string) => {
    if (!workerId) return;
    const order: Status[] = ["present", "half", "absent", "weekly_off"];
    const cur = map[dateStr];
    const next = cur === undefined ? "present" : order[(order.indexOf(cur) + 1) % order.length];
    setMap((p) => ({ ...p, [dateStr]: next }));
    const { error } = await supabase
      .from("worker_attendance")
      .upsert({ worker_id: workerId, attendance_date: dateStr, status: next }, { onConflict: "worker_id,attendance_date" });
    if (error) { toast.error(error.message); load(); }
  };

  const counts = Object.values(map).reduce(
    (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc; },
    {} as Record<Status, number>,
  );

  const cellCls = (s?: Status) => STATUSES.find((x) => x.key === s)?.cls ?? "bg-background text-muted-foreground border-border";

  return (
    <div className="space-y-3">
      <div>
        <Label>{tt("select_worker")}</Label>
        <select
          className="h-12 w-full rounded-md border bg-background px-3"
          value={workerId}
          onChange={(e) => setWorkerId(e.target.value)}
        >
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>
      <div>
        <Label>{tt("month")}</Label>
        <Input type="month" className="h-12" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ds = `${month}-${String(day).padStart(2, "0")}`;
          const s = map[ds];
          return (
            <button
              key={ds}
              type="button"
              disabled={busy}
              onClick={() => cycle(ds)}
              className={`aspect-square rounded-lg border-2 text-sm font-semibold ${cellCls(s)}`}
            >
              <div>{day}</div>
              <div className="text-[10px]">{STATUSES.find((x) => x.key === s)?.label ?? ""}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 pt-2">
        <Sum label={tt("present_days")} v={counts.present ?? 0} />
        <Sum label={tt("half_days")} v={counts.half ?? 0} />
        <Sum label={tt("absent_days")} v={counts.absent ?? 0} />
        <Sum label={tt("off_days")} v={counts.weekly_off ?? 0} />
      </div>
    </div>
  );
}

function Sum({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border bg-card p-2 text-center">
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
      <div className="text-lg font-bold">{v}</div>
    </div>
  );
}

