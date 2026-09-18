import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Bell, BellOff, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/config/features";

interface Notification {
  id: string;
  title: string;
  title_ar: string | null;
  message: string;
  message_ar: string | null;
  type: string;
  created_at: string;
}

const NotificationBell = () => {
  const portableMode = isFeatureEnabled("portableAuth");
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user || portableMode) return;

    const [{ data: notifs }, { data: reads }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", user.id),
    ]);

    setNotifications(notifs || []);
    setReadIds(new Set((reads || []).map((r) => r.notification_id)));
  }, [portableMode, user]);

  useEffect(() => {
    if (portableMode) return;
    fetchNotifications();

    const channel = supabase
      .channel(`notifications-bell-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, portableMode]);

  const markAsRead = async (notificationId: string) => {
    if (!user || readIds.has(notificationId)) return;
    await supabase.from("notification_reads").insert({
      notification_id: notificationId,
      user_id: user.id,
    });
    setReadIds((prev) => new Set([...prev, notificationId]));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !readIds.has(n.id));
    if (unread.length === 0) return;

    const inserts = unread.map((n) => ({
      notification_id: n.id,
      user_id: user.id,
    }));

    await supabase.from("notification_reads").insert(inserts);
    setReadIds((prev) => {
      const next = new Set(prev);
      unread.forEach((n) => next.add(n.id));
      return next;
    });
  };

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const getTitle = (n: Notification) => (locale === "ar" && n.title_ar) ? n.title_ar : n.title;
  const getMessage = (n: Notification) => (locale === "ar" && n.message_ar) ? n.message_ar : n.message;

  const typeColor = (type: string) => {
    switch (type) {
      case "alert": return "text-destructive";
      case "update": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  if (!user) return null;
  if (portableMode) {
    return (
      <Button variant="ghost" size="icon" asChild>
        <Link to="/notifications" aria-label="Notifications" className="text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
        </Link>
      </Button>
    );
  }

  const hasNotifications = notifications.length > 0;
  const hasUnread = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className={cn(
            "relative transition-colors",
            hasUnread
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : hasNotifications
                ? "bg-muted/60 text-foreground hover:bg-muted"
                : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 flex items-center justify-center text-[10px] leading-none rounded-full ring-2 ring-background"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "p-0 border border-border/80 shadow-2xl rounded-xl overflow-hidden",
          hasNotifications ? "w-[380px]" : "w-[320px]"
        )}
        style={{
          zIndex: 100,
          backgroundColor: "#0F0F11",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div dir={locale === "ar" ? "rtl" : "ltr"} className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="text-sm font-semibold">{t("notifications.title")}</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        {hasNotifications ? (
          <ScrollArea className="max-h-[420px]">
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    dir={locale === "ar" ? "rtl" : "ltr"}
                    className={`w-full text-start px-4 py-3 hover:bg-accent/50 transition-colors ${
                      !isRead ? "bg-primary/5" : ""
                    }`}
                    onClick={() => markAsRead(n.id)}
                  >
                    <div className="flex items-start gap-2">
                      {!isRead && (
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <div className={!isRead ? "" : "ms-4"}>
                        <p className="text-sm font-medium leading-tight">{getTitle(n)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{getMessage(n)}</p>
                        <p className={`text-[10px] mt-1 ${typeColor(n.type)}`}>
                          {new Date(n.created_at).toLocaleDateString()} · {n.type}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div
            dir={locale === "ar" ? "rtl" : "ltr"}
            className="flex flex-col items-center justify-center text-center px-6 py-7 gap-2"
            style={{ minHeight: 140 }}
          >
            <div className="h-9 w-9 rounded-full bg-muted/60 flex items-center justify-center">
              <BellOff className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{locale === "ar" ? "ما عندك إشعارات للحين" : "No notifications yet"}</p>
            <p className="text-xs text-muted-foreground leading-snug">
              {locale === "ar" ? "راح نبلغك لما يكتمل التوليد أو التصدير أو يصير تحديث على حسابك." : "We’ll let you know when a generation or export completes, or when your account needs attention."}
            </p>
          </div>
        )}
        <div
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="flex items-center justify-between px-3 py-2 border-t border-border"
        >
          <Link
            to="/notifications"
            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            aria-label="Notification settings"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" />
          </Link>
          {hasNotifications && (
            <Link
              to="/notifications"
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
