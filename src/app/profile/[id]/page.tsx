import { formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  author: {
    firstName: string;
    lastName: string;
  };
};

function normalizeHexColor(value: string | undefined) {
  if (!value) return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function getReadableTextColor(hexColor: string) {
  const normalized = normalizeHexColor(hexColor);
  if (!normalized) return "#e2e8f0";

  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? "#0f172a" : "#e2e8f0";
}

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

  if (!userRaw) {
    redirect("/");
  }

  const postsRaw = await Post.find({ author: id, isHidden: { $ne: true } })
    .sort({ createdAt: -1 })
    .populate("author", "firstName lastName avatar")
    .populate("comments.user", "firstName lastName avatar")
    .populate("reactions.user", "firstName lastName avatar")
    .lean();

  const user = JSON.parse(JSON.stringify(userRaw));
  const posts = JSON.parse(JSON.stringify(postsRaw));
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <main className="min-h-svh bg-site-gradient pb-8">
      <TopNav fullName={`${session.user.firstName} ${session.user.lastName}`} />

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

            <Link
              href="/"
              className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              Back to home
            </Link>
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

        <section className="space-y-4">
          {posts.length ? (
            posts.map((post: PublicPost) => {
              const postBackgroundColor = normalizeHexColor(post.textStyle?.backgroundColor) ?? "#1e293b";
              const postTextColor = getReadableTextColor(postBackgroundColor);

              return (
                <article key={post._id} className="card-panel">
                  <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                    <p>{post.author.firstName} {post.author.lastName}</p>
                    <p>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</p>
                  </div>

                  <div
                    className="prose max-w-none rounded-xl px-4 py-3 shadow-inner **:text-inherit"
                    style={{
                      backgroundColor: postBackgroundColor,
                      color: postTextColor,
                      textAlign: post.textStyle?.textAlign ?? "left",
                    }}
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />

                  {post.media?.length ? (
                    <div className="mt-4 space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {post.media
                          .filter((media) => media.type === "image")
                          .map((media) => (
                            <Image
                              key={media.url}
                              src={media.url}
                              alt={media.name ?? "post image"}
                              width={1400}
                              height={900}
                              unoptimized
                              className="h-auto max-h-136 w-full rounded-xl bg-slate-950/70 object-contain"
                            />
                          ))}
                      </div>

                      {post.media
                        .filter((media) => media.type === "pdf")
                        .map((media) => (
                          <a
                            key={media.url}
                            href={media.url}
                            target="_blank"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
                          >
                            <FileText className="h-4 w-4" />
                            {media.name ?? "PDF attachment"}
                          </a>
                        ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="card-panel text-sm text-slate-400">No public posts from this user yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}
