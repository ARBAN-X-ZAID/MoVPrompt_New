import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, BarChart3, Users, Megaphone, Bot, Film } from "lucide-react";
import AnalyticsTab, { type Stats } from "@/components/admin/AnalyticsTab";
import UsersTab from "@/components/admin/UsersTab";
import AnnouncementsSection from "@/components/admin/AnnouncementsSection";
import NotificationsSection from "@/components/admin/NotificationsSection";
import EmailTracker from "@/components/admin/EmailTracker";
import WelcomePopupSection from "@/components/admin/WelcomePopupSection";
import AgentProfilesSection from "@/components/admin/AgentProfilesSection";
import PresetPreviewsSection from "@/components/admin/PresetPreviewsSection";
import { useLanguage } from "@/i18n/LanguageContext";

const Analytics = () => {
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [visitsRes, gensRes, visitsTodayRes, gensTodayRes, uniqueRes] = await Promise.all([
        supabase.from("page_visits").select("*", { count: "exact", head: true }),
        supabase.from("generation_events").select("*", { count: "exact", head: true }),
        supabase.from("page_visits").select("*", { count: "exact", head: true }).gte("visited_at", todayStart),
        supabase.from("generation_events").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("page_visits").select("session_id"),
      ]);

      const { data: genData } = await supabase.from("generation_events").select("workflow_type, target_model");

      const workflowCounts: Record<string, number> = {};
      const modelCounts: Record<string, number> = {};
      (genData || []).forEach((e) => {
        workflowCounts[e.workflow_type] = (workflowCounts[e.workflow_type] || 0) + 1;
        modelCounts[e.target_model] = (modelCounts[e.target_model] || 0) + 1;
      });

      const { data: recentVisits } = await supabase.from("page_visits").select("visited_at").gte("visited_at", thirtyDaysAgo);
      const { data: recentGens } = await supabase.from("generation_events").select("created_at").gte("created_at", thirtyDaysAgo);

      const dailyMap: Record<string, { visits: number; generations: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split("T")[0];
        dailyMap[key] = { visits: 0, generations: 0 };
      }
      (recentVisits || []).forEach((v) => {
        const key = v.visited_at.split("T")[0];
        if (dailyMap[key]) dailyMap[key].visits++;
      });
      (recentGens || []).forEach((g) => {
        const key = g.created_at.split("T")[0];
        if (dailyMap[key]) dailyMap[key].generations++;
      });

      const uniqueSessionIds = new Set((uniqueRes.data || []).map((r) => r.session_id));

      setStats({
        totalVisits: visitsRes.count || 0,
        uniqueSessions: uniqueSessionIds.size,
        totalGenerations: gensRes.count || 0,
        visitsToday: visitsTodayRes.count || 0,
        generationsToday: gensTodayRes.count || 0,
        workflowBreakdown: Object.entries(workflowCounts).map(([name, value]) => ({ name, value })),
        modelBreakdown: Object.entries(modelCounts).map(([name, value]) => ({ name, value })),
        dailyTrend: Object.entries(dailyMap).map(([date, d]) => ({ date, ...d })),
      });
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="MovPrompt" className="w-10 h-10" />
            <div>
              <h1 className="text-3xl font-mono font-bold mb-1">
                Admin <span className="text-primary">Dashboard</span>
              </h1>
              <p className="text-muted-foreground">MovPrompt admin panel</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/admin/login", { replace: true });
            }}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-2">
              <Megaphone className="w-4 h-4" />
              Ads
            </TabsTrigger>
            <TabsTrigger value="previews" className="gap-2">
              <Film className="w-4 h-4" />
              Previews
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="w-4 h-4" />
              Agents
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            {stats && <AnalyticsTab stats={stats} />}
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          <TabsContent value="marketing">
            <div className="space-y-6">
              <NotificationsSection />
              <AnnouncementsSection />
              <WelcomePopupSection />
              <EmailTracker />
            </div>
          </TabsContent>

          <TabsContent value="previews">
            <PresetPreviewsSection />
          </TabsContent>

          <TabsContent value="agents">
            <AgentProfilesSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
