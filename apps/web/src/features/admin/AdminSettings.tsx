import { portableAuthClient } from "@/lib/auth/portableAuthClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard, AdminFacts } from "./AdminChrome";

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
    <div className="admin-stack max-w-2xl">
      <AdminCard title={ar ? "حساب المالك" : "Owner account"}>
        <AdminFacts items={[
          { label: ar ? "الاسم" : "Name", value: query.data.name },
          { label: ar ? "البريد الإلكتروني" : "Email", value: query.data.email },
        ]} />
        <p className="admin-hint mt-4">
          {ar
            ? "يبقى تسجيل الدخول صالحاً لمدة ٦٠ يوماً من عدم النشاط. تتطلب الإجراءات الحساسة تأكيد كلمة المرور."
            : "Sign-in stays valid for 60 days of inactivity. Sensitive actions ask you to confirm your password."}
        </p>
      </AdminCard>
      <AdminCard title={ar ? "التفضيلات" : "Preferences"}>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageToggle />
          <Button variant="outline" onClick={toggleTheme}>{ar ? "تغيير المظهر" : "Toggle theme"}</Button>
          <Button variant="outline" onClick={async () => {
            await portableAuthClient.signOut({});
            await client.invalidateQueries({ queryKey: ["admin"] });
          }}>{ar ? "تسجيل الخروج" : "Sign out"}</Button>
        </div>
      </AdminCard>
    </div>
  );
}
