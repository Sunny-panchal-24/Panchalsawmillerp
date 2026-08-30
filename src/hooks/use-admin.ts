import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Returns true when the signed-in user has the admin role (server-side check).
export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) { if (!cancelled) { setIsAdmin(false); setLoading(false); } return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("is_admin", { _user_id: uid });
      if (!cancelled) { setIsAdmin(!!data); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return { isAdmin, loading };
}
