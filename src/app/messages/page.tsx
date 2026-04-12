import { redirect } from "next/navigation";

import MessagesClient from "@/components/messages-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

type SearchParams = {
  userId?: string;
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  const { userId } = await searchParams;

  await connectDB();

  const usersRaw = await User.find({ _id: { $ne: session.user.id } })
    .select("firstName lastName")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  let users = JSON.parse(JSON.stringify(usersRaw)) as Array<{
    _id: string;
    firstName: string;
    lastName: string;
  }>;

  if (userId && !users.some((user) => user._id === userId)) {
    const selectedUserRaw = await User.findById(userId)
      .select("firstName lastName")
      .lean();

    if (selectedUserRaw) {
      const selectedUser = JSON.parse(JSON.stringify(selectedUserRaw));
      users = [selectedUser, ...users];
    }
  }

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav
        fullName={`${session.user.firstName} ${session.user.lastName}`}
        isAdmin={session.user.role === "admin"}
      />
      <MessagesClient currentUserId={session.user.id} contacts={users} initialSelectedId={userId} />
    </main>
  );
}
