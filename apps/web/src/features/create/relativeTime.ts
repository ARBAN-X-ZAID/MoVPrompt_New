export function relativeTime(timestamp: string, arabic: boolean) {
  if (!timestamp) return arabic ? "بدون تاريخ" : "No date";
  const ts = Date.parse(timestamp);
  if (!Number.isFinite(ts)) return timestamp;
  const delta = Date.now() - ts;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return arabic ? "الآن" : "just now";
  if (minutes < 60) return arabic ? `قبل ${minutes} دقيقة` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return arabic ? `قبل ${hours} ساعة` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return arabic ? `قبل ${days} يوم` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(arabic ? "ar-KW" : "en-KW", { dateStyle: "medium" });
}
