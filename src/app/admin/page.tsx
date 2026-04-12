import { redirect } from "next/navigation";

import AdminDashboardClient from "@/components/admin-dashboard-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";

export default async function AdminPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  if (session.user.role !== "admin") {
    redirect("/feed");
  }

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} isAdmin />
      <AdminDashboardClient currentUserId={session.user.id} />
    </main>
  );
}
