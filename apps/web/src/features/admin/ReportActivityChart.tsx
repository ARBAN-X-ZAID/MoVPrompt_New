import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function ReportActivityChart({
  acquisition,
  activation,
  ar,
}: {
  acquisition: Array<Record<string, unknown>>;
  activation: Array<Record<string, unknown>>;
  ar: boolean;
}) {
  const map = new Map<
    string,
    { day: string; customers: number; firstGenerations: number }
  >();
  for (const row of acquisition) {
    const day = String(row.id);
    map.set(day, {
      day,
      customers: Number(row.customers),
      firstGenerations: 0,
    });
  }
  for (const row of activation) {
    const day = String(row.id);
    const current = map.get(day) ?? { day, customers: 0, firstGenerations: 0 };
    current.firstGenerations = Number(row.firstGenerationCustomers);
    map.set(day, current);
  }
  const data = [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  if (!data.length) return null;
  return (
    <section className="admin-panel">
      <h2 className="font-semibold">
        {ar
          ? "التسجيل ونشاط التوليد الأول"
          : "Signups and first-generation activity"}
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        {ar
          ? "حسب يوم الكويت. هذان عددان مستقلان، وليسا نسبة تحويل لنفس المجموعة."
          : "By Kuwait calendar day. These are independent counts, not a cohort conversion rate."}
      </p>
      <div className="mt-6 h-64 min-w-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10 }}
              tickFormatter={(day) => String(day).slice(5)}
            />
            <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: 10,
                color: "hsl(var(--foreground))",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="customers"
              name={ar ? "عملاء جدد" : "New customers"}
              fill="hsl(var(--primary))"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="firstGenerations"
              name={ar ? "التوليد الأول" : "First generation"}
              fill="hsl(var(--muted-foreground))"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-4 border-t pt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          {ar ? "عرض الأعداد نصياً" : "Read the counts as text"}
        </summary>
        <ul className="mt-3 space-y-2">
          {data.map((row) => (
            <li key={row.day} dir="auto">
              {row.day} ·{" "}
              {ar
                ? `${row.customers} عملاء جدد، ${row.firstGenerations} توليدات أولى`
                : `${row.customers} new customers, ${row.firstGenerations} first generations`}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
