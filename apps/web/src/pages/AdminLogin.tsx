import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingRole, setCheckingRole] = useState(false);
  const [notAdmin, setNotAdmin] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (authLoading || !user) {
      setNotAdmin(false);
      return;
    }

    setCheckingRole(true);
    const checkRole = async () => {
      const { data } = await supabase.rpc("has_role", { _role: "admin" });
      if (data) {
        navigate("/admin", { replace: true });
      } else {
        setNotAdmin(true);
        toast({
          title: t("admin.accessDenied"),
          description: t("admin.noPrivileges"),
          variant: "destructive",
        });
      }
      setCheckingRole(false);
    };
    checkRole();
  }, [user, authLoading, navigate, toast, t]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotAdmin(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: t("admin.signInFailed"), description: error.message, variant: "destructive" });
    }
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[250px] bg-accent/4 rounded-full blur-[100px]" />
      </div>

      <Card className="w-full max-w-sm border-border/40 bg-card/80 backdrop-blur shadow-lg shadow-black/20 relative z-10">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-xl font-display text-foreground">{t("admin.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {notAdmin && user ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("admin.signedInAs")} <span className="text-foreground font-medium">{user.email}</span>
              </p>
              <p className="text-sm text-destructive">{t("admin.noPrivileges")}</p>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setNotAdmin(false);
                }}
              >
                {t("admin.signOutTry")}
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-11 hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t("auth.signIn")}
                </Button>
              </form>
              <button
                onClick={() => navigate("/auth")}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
              >
                {t("auth.forgotPassword")}
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
