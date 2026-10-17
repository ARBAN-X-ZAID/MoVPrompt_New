import { useEffect, useState } from "react";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useLanguage } from "@/i18n/LanguageContext";
import { LibraryWorkspace } from "@/features/assets/LibraryWorkspace";
import { libraryApi } from "@/features/assets/libraryApi";
import type { LibraryKind } from "@movprompt/contracts";

export default function MyAssets() {
  const { locale } = useLanguage(); const ar = locale === "ar";
  const [kind, setKind] = useState<LibraryKind>("product"); const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => { void libraryApi.status().then(setEnabled).catch(() => setEnabled(false)); }, []);
  return <CreatorShell><div className="creator-page assets-page" dir={ar ? "rtl" : "ltr"}><header className="assets-page-heading"><p>{ar ? "مكتبتك الخاصة" : "Your private library"}</p><h1>{ar ? "أصولي" : "My assets"}</h1><p>{ar ? "احفظ صور المنتجات والشخصيات المعتمدة لحملاتك القادمة. الصور المرجعية تدعم الاتساق، دون ضمان تطابق النتائج." : "Keep approved product and presenter photos ready for your next campaign. References guide consistency. Generated results can vary."}</p></header>{enabled === null ? <p role="status">{ar ? "جارٍ التحميل…" : "Loading…"}</p> : !enabled ? <p role="status">{ar ? "أصولي غير متاحة بعد." : "My assets is not available yet."}</p> : <><div role="tablist" className="assets-tabs" aria-label={ar ? "نوع الأصل" : "Asset type"}>{(["product", "presenter"] as const).map((item, index) => <button key={item} id={`assets-tab-${item}`} role="tab" aria-selected={kind === item} aria-controls="assets-panel" tabIndex={kind === item ? 0 : -1} onKeyDown={event => { if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "product" : event.key === "End" ? "presenter" : index ? "product" : "presenter"; setKind(next); document.getElementById(`assets-tab-${next}`)?.focus(); } }} onClick={() => setKind(item)}>{item === "product" ? ar ? "المنتجات" : "Products" : ar ? "الشخصيات" : "Presenters"}</button>)}</div><section id="assets-panel" role="tabpanel" aria-labelledby={`assets-tab-${kind}`}><LibraryWorkspace key={kind} kind={kind} ar={ar} /></section></>}</div></CreatorShell>;
}
