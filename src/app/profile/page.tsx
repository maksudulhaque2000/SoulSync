import { redirect } from "next/navigation";

import ProfileClient from "@/components/profile-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
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

  const postsRaw = await Post.find({ author: session.user.id })
    .sort({ createdAt: -1 })
    .populate("author", "firstName lastName avatar")
    .populate("comments.user", "firstName lastName avatar")
    .populate("reactions.user", "firstName lastName avatar")
    .lean();

  if (!userRaw) {
    redirect("/");
  }

  const user = JSON.parse(JSON.stringify(userRaw));
  const posts = JSON.parse(JSON.stringify(postsRaw));

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} />
      <ProfileClient initialUser={user} initialPosts={posts} />
    </main>
  );
}
