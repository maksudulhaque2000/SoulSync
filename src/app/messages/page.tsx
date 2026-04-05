import { redirect } from "next/navigation";

import MessagesClient from "@/components/messages-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export default async function MessagesPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  await connectDB();

  const usersRaw = await User.find({ _id: { $ne: session.user.id } })
    .select("firstName lastName")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const users = JSON.parse(JSON.stringify(usersRaw));

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} />
      <MessagesClient currentUserId={session.user.id} contacts={users} />
    </main>
  );
}
