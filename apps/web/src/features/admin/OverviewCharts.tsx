import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCount, formatKwd } from "./adminData";

export type OverviewDay = { day: string; completed: number; failed: number; cancelled: number; active: number; cashMinor: number | null };
export type BarItem = { label: string; value: number | null; display: string; to?: string };
type Series = { key: "completed" | "failed" | "active" | "cancelled"; en: string; ar: string; color: string; to: string };

// A colour stays with its outcome in both charts, so the legend reads for each of them.
const VIDEO_SERIES: Series[] = [
  { key: "completed", en: "Completed", ar: "مكتملة", color: "var(--a-chart-done)", to: "/admin/generations?status=completed" },
  { key: "failed", en: "Failed", ar: "فاشلة", color: "var(--a-chart-failed)", to: "/admin/generations?status=failed" },
  { key: "active", en: "In progress", ar: "قيد التنفيذ", color: "var(--a-chart-active)", to: "/admin/generations?status=processing" },
  { key: "cancelled", en: "Cancelled", ar: "ملغاة", color: "var(--a-chart-idle)", to: "/admin/generations?status=cancelled" },
];

const formatDay = (day: string, ar: boolean) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString(ar ? "ar-KW-u-nu-latn" : "en-KW", { month: "short", day: "numeric", timeZone: "UTC" });

const AXIS_TICK = { fill: "var(--a-text-3)", fontSize: 11 };
const HOVER_BAND = { fill: "var(--a-hover)" };

function ChartTip({ title, rows, empty }: { title: string; rows: { label: string; value: string; color: string }[]; empty?: string }) {
  return <div className="admin-chart-tip">
    <strong dir="auto">{title}</strong>
    {rows.length ? rows.map(row => <p key={row.label}><i aria-hidden="true" style={{ background: row.color }} /><span>{row.label}</span>{" "}<b>{row.value}</b></p>) : <p>{empty}</p>}
  </div>;
}

const dayAxis = (ar: boolean) => <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "var(--a-line)" }} minTickGap={28} tickFormatter={day => formatDay(String(day), ar)} />;

export function VideoCharts({ days, ar }: { days: OverviewDay[]; ar: boolean }) {
  const name = (series: Series) => (ar ? series.ar : series.en);
  const totals = VIDEO_SERIES.map(series => ({ ...series, label: name(series), value: days.reduce((sum, day) => sum + day[series.key], 0) }));
  const total = totals.reduce((sum, item) => sum + item.value, 0);
  const slices = totals.filter(item => item.value > 0);
  const summary = totals.map(item => `${item.label}: ${formatCount(item.value, ar)}`).join(", ");
  return <div className="admin-video-charts">
    <div className="admin-chart-plot" dir="ltr" role="img" aria-label={`${ar ? "الفيديوهات يومياً" : "Videos per day"}. ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--a-line)" />
          {dayAxis(ar)}
          <YAxis width={28} allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <Tooltip cursor={HOVER_BAND} content={({ active, payload }) => {
            const day = payload?.[0]?.payload as OverviewDay | undefined;
            if (!active || !day) return null;
            return <ChartTip
              title={formatDay(day.day, ar)}
              rows={VIDEO_SERIES.filter(series => day[series.key] > 0).map(series => ({ label: name(series), value: formatCount(day[series.key], ar), color: series.color }))}
              empty={ar ? "لا توجد فيديوهات" : "No videos"}
            />;
          }} />
          {VIDEO_SERIES.map(series => <Bar key={series.key} dataKey={series.key} name={name(series)} stackId="videos" fill={series.color} stroke="var(--a-surface)" strokeWidth={1} radius={2} maxBarSize={24} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div>
      <div className="admin-donut" dir="ltr" role="img" aria-label={`${ar ? "نتائج الفيديوهات" : "Video results"}. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="72%" outerRadius="98%" startAngle={90} endAngle={-270} paddingAngle={slices.length > 1 ? 2 : 0} cornerRadius={4} stroke="none" isAnimationActive={false}>
              {slices.map(item => <Cell key={item.key} fill={item.color} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              const slice = payload?.[0]?.payload as (typeof slices)[number] | undefined;
              if (!active || !slice) return null;
              return <ChartTip title={slice.label} rows={[{ label: ar ? "فيديوهات" : "Videos", value: formatCount(slice.value, ar), color: slice.color }]} />;
            }} />
          </PieChart>
        </ResponsiveContainer>
        <p className="admin-donut-total"><strong>{formatCount(total, ar)}</strong><span>{ar ? "فيديو" : "videos"}</span></p>
      </div>
      <div className="admin-chart-legend">
        {totals.map(item => <Link key={item.key} to={item.to}>
          <i aria-hidden="true" style={{ background: item.color }} />
          <span>{item.label}</span>{" "}
          <strong>{formatCount(item.value, ar)}</strong>
        </Link>)}
      </div>
    </div>
  </div>;
}

export function CashChart({ days, ar }: { days: OverviewDay[]; ar: boolean }) {
  const rows = days.map(day => ({ day: day.day, cash: (day.cashMinor ?? 0) / 1000 }));
  return <div className="admin-chart-plot" data-size="small" dir="ltr" role="img" aria-label={ar ? "المبالغ المحصلة يومياً" : "Cash collected per day"}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        {dayAxis(ar)}
        <YAxis hide />
        <Tooltip cursor={HOVER_BAND} content={({ active, payload }) => {
          const row = payload?.[0]?.payload as (typeof rows)[number] | undefined;
          if (!active || !row) return null;
          return <ChartTip title={formatDay(row.day, ar)} rows={[{ label: ar ? "المحصل" : "Collected", value: formatKwd(row.cash * 1000), color: "var(--a-chart-bar)" }]} />;
        }} />
        <Bar dataKey="cash" fill="var(--a-chart-bar)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function BarList({ items, tone }: { items: BarItem[]; tone?: "failed" }) {
  const max = Math.max(1, ...items.map(item => item.value ?? 0));
  return <div className="admin-bar-list">
    {items.map(item => {
      const content = <>
        <span><span dir="auto">{item.label}</span>{" "}<strong dir="auto">{item.display}</strong></span>
        <span className="admin-bar-track" aria-hidden="true">{item.value ? <i data-tone={tone} style={{ width: `${(item.value / max) * 100}%` }} /> : null}</span>
      </>;
      return item.to
        ? <Link key={item.label} to={item.to} className="admin-bar-row">{content}</Link>
        : <div key={item.label} className="admin-bar-row">{content}</div>;
    })}
  </div>;
}

export function DailyTable({ days, ar }: { days: OverviewDay[]; ar: boolean }) {
  const busy = days.filter(day => VIDEO_SERIES.some(series => day[series.key] > 0) || day.cashMinor);
  if (!busy.length) return null;
  return <div className="sr-only"><table>
    <caption>{ar ? "النشاط اليومي" : "Daily activity"}</caption>
    <thead><tr>
      <th scope="col">{ar ? "اليوم" : "Day"}</th>
      {VIDEO_SERIES.map(series => <th key={series.key} scope="col">{ar ? series.ar : series.en}</th>)}
      <th scope="col">{ar ? "المحصل" : "Collected"}</th>
    </tr></thead>
    <tbody>{busy.map(day => <tr key={day.day}>
      <th scope="row">{formatDay(day.day, ar)}</th>
      {VIDEO_SERIES.map(series => <td key={series.key}>{day[series.key]}</td>)}
      <td>{formatKwd(day.cashMinor)}</td>
    </tr>)}</tbody>
  </table></div>;
}
