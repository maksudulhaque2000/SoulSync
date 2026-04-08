import AuthShell from "@/components/auth-shell";
import FeedClient from "@/components/feed-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

export default async function Home() {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return <AuthShell />;
  }

  await connectDB();

  const postsRaw = await Post.find({ isHidden: { $ne: true } })
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
    <main className="relative min-h-svh overflow-x-hidden overflow-y-visible bg-site-gradient pb-8">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute -right-28 top-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />
      </div>

      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} />
      <FeedClient initialPosts={posts} suggestedUsers={users} currentUserId={session.user.id} />
    </main>
  );
}
