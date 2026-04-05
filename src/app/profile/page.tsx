import { redirect } from "next/navigation";

import ProfileClient from "@/components/profile-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export default async function ProfilePage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  await connectDB();

  const userRaw = await User.findById(session.user.id)
    .select("firstName lastName email avatar phone age gender bio pendingReceived connections")
    .lean();

  if (!userRaw) {
    redirect("/");
  }

  const user = JSON.parse(JSON.stringify(userRaw));

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} />
      <ProfileClient initialUser={user} />
    </main>
  );
}
