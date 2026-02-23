"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Notification } from "@/lib/types/database";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const supabase = createClient();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const visibleNotifications = showUnreadOnly
    ? notifications.filter((n) => !n.read)
    : notifications;

  useEffect(() => {
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setNotifications(data as Notification[]);
    };

    fetchNotifications();

    // Subscribe to realtime notifications
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const dismissNotification = async (
    e: React.MouseEvent,
    id: string
  ) => {
    e.stopPropagation();
    // Mark as read and remove from local state
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            <Button
              variant={showUnreadOnly ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              title={showUnreadOnly ? "Show all" : "Show unread only"}
            >
              <Filter className="mr-1 h-3 w-3" />
              {showUnreadOnly ? "Unread" : "All"}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={markAllRead}
              >
                <Check className="mr-1 h-3 w-3" />
                Read all
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[320px]">
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">
                {showUnreadOnly
                  ? "No unread notifications"
                  : "No notifications yet"}
              </p>
              {showUnreadOnly && notifications.length > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 text-xs"
                  onClick={() => setShowUnreadOnly(false)}
                >
                  View all notifications
                </Button>
              )}
            </div>
          ) : (
            visibleNotifications.map((n) => (
              <div
                key={n.id}
                className={`group flex items-start gap-3 border-b px-4 py-3 cursor-pointer hover:bg-accent transition-colors ${
                  !n.read ? "bg-accent/50" : ""
                }`}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <div
                  className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                    !n.read ? "bg-primary" : "bg-transparent"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => dismissNotification(e, n.id)}
                  title="Dismiss"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
