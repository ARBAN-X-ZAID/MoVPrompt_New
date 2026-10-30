import { portableAuthClient } from "@/lib/auth/portableAuthClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { ErrorState, Loading } from "./AdminDisplay";

export default function AdminSettings() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const client = useQueryClient();
  const { toggleTheme } = useTheme();
  const query = useQuery({
    queryKey: ["admin", "identity"],
    queryFn: adminApi.identity,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <section className="admin-panel max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">
        {ar ? "حساب المالك" : "Owner account"}
      </h2>
      <dl className="space-y-4">
        <div>
          <dt className="text-sm text-muted-foreground">
            {ar ? "الاسم" : "Name"}
          </dt>
          <dd>{query.data.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {ar ? "البريد الإلكتروني" : "Email"}
          </dt>
          <dd className="break-all">{query.data.email}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "يبقى تسجيل الدخول صالحاً لمدة ٦٠ يوماً من عدم النشاط. تتطلب الإجراءات الحساسة تأكيد كلمة المرور."
          : "Sign-in remains valid for 60 days of inactivity. Sensitive actions require password confirmation."}
      </p>
      <div className="flex flex-wrap gap-3">
        <LanguageToggle />
        <Button variant="outline" onClick={toggleTheme}>
          {ar ? "تغيير المظهر" : "Toggle theme"}
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await portableAuthClient.signOut({});
            await client.invalidateQueries({ queryKey: ["admin"] });
          }}
        >
          {ar ? "تسجيل الخروج" : "Sign out"}
        </Button>
      </div>
    </section>
  );
}
