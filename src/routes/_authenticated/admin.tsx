/**
 * Owner-only admin console: the member directory.
 * Non-owners are redirected back to their dashboard.
 */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { listMembers } from "@/lib/access.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    // Route-level gate: only the single Owner may reach /admin.
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: isOwner } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "owner",
    });
    if (!isOwner) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Admin console — SparkSage" },
      { name: "description", content: "Owner console for the SparkSage member directory." },
      { property: "og:title", content: "Admin console — SparkSage" },
      { property: "og:description", content: "Manage members on SparkSage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-8"
    >
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Admin console</h1>
        <p className="text-muted-foreground">Everyone who has signed up for SparkSage.</p>
      </header>
      <MembersPanel />
    </motion.div>
  );
}

function MembersPanel() {
  const membersFn = useServerFn(listMembers);
  const members = useQuery({ queryKey: ["admin-members"], queryFn: () => membersFn({}) });

  if (members.isLoading) return <Skeleton className="h-64 w-full rounded-3xl" />;
  if (members.isError)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load members</CardTitle>
          <CardDescription>Please try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => members.refetch()}>Retry</Button>
        </CardContent>
      </Card>
    );

  if (members.data!.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No members yet</CardTitle>
          <CardDescription>Invite students and they'll appear here.</CardDescription>
        </CardHeader>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>{members.data!.length} account(s)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.data!.map((m) => (
          <div
            key={m.userId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{m.displayName ?? m.email ?? "Unnamed"}</p>
              <p className="truncate text-sm text-muted-foreground">{m.email}</p>
            </div>
            <Badge variant={m.role === "owner" ? "default" : "secondary"}>{m.role}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
