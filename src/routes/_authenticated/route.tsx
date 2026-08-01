// Gate + app shell for every protected route. `ssr: false` because the Supabase
// session lives in localStorage and cannot be read on the server; without this,
// a hard refresh on a protected page would loop through /auth.
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { FeedbackDialog } from "@/components/feedback-dialog";

import { getPublicSiteData } from "@/lib/settings.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const siteFn = useServerFn(getPublicSiteData);

  // Owners get extra nav entries; students never see admin tools.
  const { data: isOwner } = useQuery({
    queryKey: ["is-owner", user.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "owner" });
      return Boolean(data);
    },
  });

  // Branding + announcement come from the Owner-managed settings table.
  const { data: site } = useQuery({ queryKey: ["site-data"], queryFn: () => siteFn() });
  const appName = site?.settings.app_name || "SparkSage";
  const announcement = site?.settings.announcement?.trim();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar isOwner={Boolean(isOwner)} appName={appName} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border sticky top-0 z-40 bg-background/80 backdrop-blur">
            <div className="h-full px-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger aria-label="Toggle sidebar" />
                <span className="font-semibold truncate hidden sm:inline">{appName}</span>
              </div>
              <div className="flex items-center gap-2">
                <GlobalSearch />
                <FeedbackDialog />

                <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Sign out</span>
                </Button>
              </div>
            </div>
          </header>

          {announcement && (
            <div role="status" className="bg-accent/40 border-b border-border px-4 py-2 text-sm text-center">
              {announcement}
            </div>
          )}

          <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
