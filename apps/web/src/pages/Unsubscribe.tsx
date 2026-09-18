import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };

    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("error");
      } else if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
    setSubmitting(false);
  };

  const content: Record<Status, { icon: React.ReactNode; title: string; desc: string }> = {
    loading: {
      icon: <Loader2 className="w-8 h-8 animate-spin text-primary" />,
      title: t("unsub.verifying"),
      desc: t("unsub.verifyingDesc"),
    },
    valid: {
      icon: <MailX className="w-8 h-8 text-primary" />,
      title: t("unsub.title"),
      desc: t("unsub.desc"),
    },
    already: {
      icon: <CheckCircle2 className="w-8 h-8 text-muted-foreground" />,
      title: t("unsub.alreadyTitle"),
      desc: t("unsub.alreadyDesc"),
    },
    invalid: {
      icon: <AlertCircle className="w-8 h-8 text-destructive" />,
      title: t("unsub.invalidTitle"),
      desc: t("unsub.invalidDesc"),
    },
    success: {
      icon: <CheckCircle2 className="w-8 h-8 text-green-500" />,
      title: t("unsub.successTitle"),
      desc: t("unsub.successDesc"),
    },
    error: {
      icon: <AlertCircle className="w-8 h-8 text-destructive" />,
      title: t("unsub.errorTitle"),
      desc: t("unsub.errorDesc"),
    },
  };

  const c = content[status];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="bg-card border-border/60 shadow-lg shadow-black/20 max-w-sm w-full">
        <CardContent className="p-8 flex flex-col items-center text-center gap-4">
          {c.icon}
          <h1 className="text-xl font-display font-bold text-foreground">{c.title}</h1>
          <p className="text-sm text-muted-foreground">{c.desc}</p>
          {status === "valid" && (
            <Button
              onClick={handleUnsubscribe}
              disabled={submitting}
              className="w-full mt-2"
              variant="destructive"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {t("unsub.confirm")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
