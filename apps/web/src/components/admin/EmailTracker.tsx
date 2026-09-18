import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

const EmailTracker = () => {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    checkTable();
  }, []);

  const checkTable = async () => {
    // Try querying email_send_log — if it doesn't exist, we'll get an error
    const { error } = await supabase.from("email_send_log" as any).select("id", { count: "exact", head: true });
    setAvailable(!error);
  };

  if (available === null) {
    return <p className="text-muted-foreground animate-pulse">Checking email tracking...</p>;
  }

  if (!available) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5 text-primary" /> Email Campaign Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-3">
            <Mail className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Email tracking is not yet configured for this project.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Set up email infrastructure to start tracking delivery stats, open rates, and campaign performance.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="w-5 h-5 text-primary" /> Email Campaign Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Email tracking data will appear here.</p>
      </CardContent>
    </Card>
  );
};

export default EmailTracker;
