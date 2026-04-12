import Image from "next/image";
import { redirect } from "next/navigation";

import PublicProfileActions from "@/components/public-profile-actions";
import PublicProfilePostsClient from "@/components/public-profile-posts-client";
import TopNav from "@/components/top-nav";
import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Post from "@/models/Post";
import User from "@/models/User";

type PublicMedia = {
  url: string;
  type: "image" | "pdf";
  name?: string;
};

type PublicPost = {
  _id: string;
  content: string;
  createdAt: string;
  textStyle?: {
    backgroundColor?: string;
    textAlign?: "left" | "center" | "right";
  };
  media?: PublicMedia[];
  reactions: {
    user: { _id: string };
    type: "love" | "care" | "celebrate" | "insightful" | "support";
  }[];
  comments: {
    user: { _id: string; firstName: string; lastName: string };
    text: string;
    createdAt: string;
  }[];
  author: {
    _id: string;
    firstName: string;
    lastName: string;
  };
};

function calculateAgeFromBirthDate(birthDate: string | undefined) {
  if (!birthDate) return null;

  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function hasRelation(ids: string[] | undefined, targetId: string) {
  return Boolean(ids?.includes(targetId));
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  const { id } = await params;

  if (id === session.user.id) {
    redirect("/profile");
  }

  await connectDB();

  const userRaw = await User.findById(id)
    .select("firstName lastName email avatar phone age birthDate gender bio")
    .lean();

  const meRaw = await User.findById(session.user.id)
    .select("connections pendingSent pendingReceived")
    .lean();

  if (!userRaw || !meRaw) {
    redirect("/");
  }

  const postsRaw = await Post.find({ author: id, isHidden: { $ne: true } })
    .sort({ createdAt: -1 })
    .populate("author", "firstName lastName avatar")
    .populate("comments.user", "firstName lastName avatar")
    .populate("reactions.user", "firstName lastName avatar")
    .lean();

  const user = JSON.parse(JSON.stringify(userRaw));
  const me = JSON.parse(JSON.stringify(meRaw)) as {
    connections?: string[];
    pendingSent?: string[];
    pendingReceived?: string[];
  };
  const posts = JSON.parse(JSON.stringify(postsRaw));
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const isConnected = hasRelation(me.connections, id);
  const hasPendingSent = hasRelation(me.pendingSent, id);
  const hasPendingReceived = hasRelation(me.pendingReceived, id);

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} isAdmin={session.user.role === "admin"} />

      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <section className="card-panel mb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={`${user.firstName} ${user.lastName}`}
                  width={72}
                  height={72}
                  unoptimized
                  className="h-16 w-16 rounded-full border border-slate-700 object-cover"
                />
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-lg font-semibold text-slate-200">
                  {initials || "U"}
                </span>
              )}

              <div>
                <h1 className="font-display text-3xl text-slate-100">{user.firstName} {user.lastName}</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">{user.bio || "This member has not added a bio yet."}</p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <PublicProfileActions
                targetUserId={id}
                isConnected={isConnected}
                hasPendingSent={hasPendingSent}
                hasPendingReceived={hasPendingReceived}
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/40 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Profile Details</p>
            <div className="mt-2 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
              <p><span className="text-slate-500">Name:</span> {user.firstName} {user.lastName}</p>
              <p><span className="text-slate-500">Email:</span> {user.email || "Not set"}</p>
              <p><span className="text-slate-500">Mobile:</span> {user.phone || "Not set"}</p>
              <p><span className="text-slate-500">Birth date:</span> {user.birthDate ? new Date(user.birthDate).toLocaleDateString() : "Not set"}</p>
              <p><span className="text-slate-500">Age:</span> {calculateAgeFromBirthDate(user.birthDate) ?? (user.age && user.age > 0 ? user.age : null) ?? "Not set"}</p>
              <p><span className="text-slate-500">Gender:</span> {user.gender || "Not set"}</p>
              <p className="sm:col-span-2"><span className="text-slate-500">Bio:</span> {user.bio || "Not set"}</p>
            </div>
          </div>
        </section>

        <PublicProfilePostsClient initialPosts={posts as PublicPost[]} currentUserId={session.user.id} />
      </div>
    </main>
  );
}
