/**
 * Owner-only section shell. The single Owner account gets a warm, simple
 * sub-navigation; everyone else is bounced back to their dashboard.
 */
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/owner", label: "Overview" },
  { to: "/owner/announcements", label: "Announcements" },
  { to: "/owner/feedback", label: "Feedback" },
  { to: "/admin", label: "Members" },
  { to: "/site-settings", label: "Settings" },
] as const;


export const Route = createFileRoute("/_authenticated/owner")({
  ssr: false,
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "owner",
    });
    if (!isOwner) throw redirect({ to: "/dashboard" });
  },
  component: OwnerLayout,
});

function OwnerLayout() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="space-y-6">
      <nav aria-label="Owner sections" className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const active = pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "rounded-2xl px-3.5 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
