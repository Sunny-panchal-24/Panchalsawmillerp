import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listExports, getDownloadUrl } from "@/lib/backups.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download, FolderArchive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/recovery")({
  component: RecoveryPage,
});

function RecoveryPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<Array<{ id: string; period_label: string; file_name: string; storage_path: string; size_bytes: number; created_at: string }>>([]);
  const listFn = useServerFn(listExports);
  const dlFn = useServerFn(getDownloadUrl);

  useEffect(() => {
    listFn().then((d) => setFiles(d as never)).catch(() => toast.error("Failed to load"));
  }, [listFn]);

  const handleDownload = async (path: string) => {
    try {
      const { url } = await dlFn({ data: { path } });
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-primary text-primary-foreground shadow-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="secondary" size="icon" onClick={() => navigate({ to: "/" })}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <FolderArchive className="h-5 w-5" />
          <h1 className="text-xl font-bold">Recovery</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Card className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Every monthly export is archived here. Files are never overwritten automatically.
          </p>
          {files.length === 0 ? (
            <p className="text-center text-muted-foreground">No backups yet.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{f.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.period_label} · {new Date(f.created_at).toLocaleString()} · {Math.round(f.size_bytes / 1024)} KB
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(f.storage_path)}>
                    <Download className="mr-1 h-4 w-4" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
