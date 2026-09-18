import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Eye, Sparkles, Users, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(190, 90%, 50%)", "hsl(35, 90%, 55%)", "hsl(280, 70%, 60%)", "hsl(140, 70%, 50%)", "hsl(350, 70%, 55%)"];

interface Stats {
  totalVisits: number;
  uniqueSessions: number;
  totalGenerations: number;
  visitsToday: number;
  generationsToday: number;
  workflowBreakdown: { name: string; value: number }[];
  modelBreakdown: { name: string; value: number }[];
  dailyTrend: { date: string; visits: number; generations: number }[];
}

const chartConfig = {
  visits: { label: "Visits", color: "hsl(190, 90%, 50%)" },
  generations: { label: "Generations", color: "hsl(35, 90%, 55%)" },
};

const downloadCSV = (stats: Stats) => {
  const convRate = stats.totalVisits ? ((stats.totalGenerations / stats.totalVisits) * 100).toFixed(1) + "%" : "0%";
  const lines: string[] = [
    "=== MovPrompt Analytics Report ===","",
    "Metric,Value",
    `Total Visits,${stats.totalVisits}`,
    `Unique Visitors,${stats.uniqueSessions}`,
    `Total Generations,${stats.totalGenerations}`,
    `Visits Today,${stats.visitsToday}`,
    `Generations Today,${stats.generationsToday}`,
    `Conversion Rate,${convRate}`,
    "","=== Daily Trend (30 Days) ===","",
    "Date,Visits,Generations",
    ...stats.dailyTrend.map((d) => `${d.date},${d.visits},${d.generations}`),
    "","=== Workflow Breakdown ===","",
    "Workflow,Count",
    ...stats.workflowBreakdown.map((w) => `${w.name},${w.value}`),
    "","=== Model Breakdown ===","",
    "Model,Count",
    ...stats.modelBreakdown.map((m) => `${m.name},${m.value}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `movprompt-analytics-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const AnalyticsTab = ({ stats }: { stats: Stats }) => {
  const statCards = [
    { label: "Total Visits", value: stats.totalVisits, icon: Eye, sub: `${stats.visitsToday} today` },
    { label: "Unique Visitors", value: stats.uniqueSessions, icon: Users, sub: "approximate" },
    { label: "Total Generations", value: stats.totalGenerations, icon: Sparkles, sub: `${stats.generationsToday} today` },
    { label: "Conversion Rate", value: stats.totalVisits ? `${((stats.totalGenerations / stats.totalVisits) * 100).toFixed(1)}%` : "0%", icon: TrendingUp, sub: "visits → generations" },
  ];

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button variant="outline" size="sm" onClick={() => downloadCSV(stats)} className="gap-2">
          <Download className="w-4 h-4" />
          Download Report
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border mb-8">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={stats.dailyTrend}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="visits" stroke="hsl(190, 90%, 50%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="generations" stroke="hsl(35, 90%, 55%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">By Workflow Type</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.workflowBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={stats.workflowBreakdown}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(190, 90%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium">By Target Model</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.modelBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <PieChart>
                  <Pie data={stats.modelBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => e.name}>
                    {stats.modelBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AnalyticsTab;
export type { Stats };
