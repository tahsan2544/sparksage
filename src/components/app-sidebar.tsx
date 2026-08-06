// Collapsible app sidebar. Collapse state is persisted by the shadcn
// SidebarProvider cookie, so it is remembered between visits.
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  MessagesSquare,
  CalendarDays,
  LineChart,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Gauge,
  Megaphone,
  Inbox,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export type NavTarget =
  | "/dashboard"
  | "/documents"
  | "/chat"
  | "/planner"
  | "/progress"
  | "/settings"
  | "/admin"
  | "/owner"
  | "/owner/announcements"
  | "/owner/feedback"
  | "/site-settings";

const studyItems: { title: string; url: NavTarget; icon: typeof FileText }[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Chat with AI", url: "/chat", icon: MessagesSquare },
  { title: "Study planner", url: "/planner", icon: CalendarDays },
  { title: "Progress", url: "/progress", icon: LineChart },
];

const accountItems: { title: string; url: NavTarget; icon: typeof FileText }[] = [
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

const ownerItems: { title: string; url: NavTarget; icon: typeof FileText }[] = [
  { title: "Overview", url: "/owner", icon: Gauge },
  { title: "Announcements", url: "/owner/announcements", icon: Megaphone },
  { title: "Feedback", url: "/owner/feedback", icon: Inbox },
  { title: "Members", url: "/admin", icon: ShieldCheck },
  { title: "Site settings", url: "/site-settings", icon: SlidersHorizontal },
];

export function AppSidebar({ isOwner, appName }: { isOwner: boolean; appName: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5 font-semibold">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          {!collapsed && <span className="truncate">{appName}</span>}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Study</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studyItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" aria-hidden />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" aria-hidden />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel>Owner</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ownerItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" aria-hidden />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
