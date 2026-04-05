import { redirect } from "next/navigation";

import FeedClient from "@/components/feed-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

export default async function FeedPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  await connectDB();

  const postsRaw = await Post.find({})
    .sort({ createdAt: -1 })
    .populate("author", "firstName lastName avatar")
    .populate("comments.user", "firstName lastName avatar")
    .populate("reactions.user", "firstName lastName avatar")
    .lean();

  const usersRaw = await User.find({ _id: { $ne: session.user.id } })
    .select("firstName lastName bio")
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  const posts = JSON.parse(JSON.stringify(postsRaw));
  const users = JSON.parse(JSON.stringify(usersRaw));

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} />
      <FeedClient initialPosts={posts} suggestedUsers={users} currentUserId={session.user.id} />
    </main>
  );
}
