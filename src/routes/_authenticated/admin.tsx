import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminListUsers } from "@/lib/backups.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Row = {
  id: string; full_name: string | null; email: string; created_at: string;
  roles: string[]; company: string; village: string;
  counts: { purchases: number; sales: number; vendors: number; customers: number; workers: number };
};

function AdminPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const listFn = useServerFn(adminListUsers);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAllowed(false); return; }
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      setAllowed(!!data);
      if (data) {
        try { setRows(await listFn() as never); } catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
      }
      setLoading(false);
    })();
  }, [listFn]);

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  if (!allowed) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Shield className="h-10 w-10 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Access denied</h2>
      <p className="text-muted-foreground">This page is only for the system admin.</p>
      <Button onClick={() => navigate({ to: "/" })}>Back to Dashboard</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Button variant="secondary" size="icon" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-5 w-5" />
          <h1 className="text-xl font-bold">Admin — All Businesses</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Card className="overflow-x-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="text-right">Vendors</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Workers</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">Sales</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.full_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.email}</TableCell>
                  <TableCell>
                    <div className="font-medium">{r.company || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.village}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.roles.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{r.counts.vendors}</TableCell>
                  <TableCell className="text-right">{r.counts.customers}</TableCell>
                  <TableCell className="text-right">{r.counts.workers}</TableCell>
                  <TableCell className="text-right">{r.counts.purchases}</TableCell>
                  <TableCell className="text-right">{r.counts.sales}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No users yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
