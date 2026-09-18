import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface Announcement {
  id: string;
  title: string;
  title_ar: string | null;
  message: string;
  message_ar: string | null;
  link_url: string | null;
  link_text: string | null;
  link_text_ar: string | null;
  type: string;
}

const DISMISSED_KEY = "dismissed_announcements";

const getDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
};

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { locale, t } = useLanguage();

  useEffect(() => {
    const fetch = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("announcements_public")
        .select("id, title, title_ar, message, message_ar, link_url, link_text, link_text_ar, type")
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("created_at", { ascending: false });

      const dismissed = getDismissed();
      setAnnouncements((data || []).filter((a) => !dismissed.includes(a.id)));
    };
    fetch();
  }, []);

  const dismiss = (id: string) => {
    const dismissed = getDismissed();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, id]));
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  if (announcements.length === 0) return null;

  const typeStyles: Record<string, string> = {
    info: "bg-primary/10 border-primary/30 text-primary",
    warning: "bg-accent/10 border-accent/30 text-accent",
    promo: "bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 text-foreground",
  };

  const getTitle = (a: Announcement) => (locale === "ar" && a.title_ar) ? a.title_ar : a.title;
  const getMessage = (a: Announcement) => (locale === "ar" && a.message_ar) ? a.message_ar : a.message;
  const getLinkText = (a: Announcement) => (locale === "ar" && a.link_text_ar) ? a.link_text_ar : (a.link_text || t("announcement.learnMore"));

  return (
    <div className="space-y-2 mb-6">
      {announcements.map((a) => (
        <div key={a.id} dir={locale === "ar" ? "rtl" : "ltr"} className={`relative rounded-lg border px-4 py-3 text-sm flex items-center gap-3 ${typeStyles[a.type] || typeStyles.info}`}>
          <div className="flex-1 min-w-0">
            <span className="font-semibold me-1.5">{getTitle(a)}</span>
            <span className="text-muted-foreground">{getMessage(a)}</span>
            {a.link_url && (
              <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="ms-2 underline font-medium hover:text-primary">
                {getLinkText(a)}
              </a>
            )}
          </div>
          <button onClick={() => dismiss(a.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
