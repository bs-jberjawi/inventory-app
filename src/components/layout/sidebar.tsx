"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Bot,
  Settings,
  Boxes,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Movements", href: "/movements", icon: ArrowLeftRight },
  { name: "AI Assistant", href: "/ai-assistant", icon: Bot },
];

const adminNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();

  const allNav = [
    ...navigation,
    ...(role === "admin" ? adminNavigation : []),
  ];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Boxes className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">InvenTrack</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {allNav.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground text-center">
          InvenTrack v1.0
        </p>
      </div>
    </aside>
  );
}
