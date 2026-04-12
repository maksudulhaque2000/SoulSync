import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Message from "@/models/Message";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  try {
    // Get all conversations with unread message counts
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { to: session.user.id },
            { from: session.user.id },
          ],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      // Group by conversation (either from or to the current user)
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$from", session.user.id] },
              "$to",
              "$from",
            ],
          },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$to", session.user.id] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
          lastMessage: { $first: "$createdAt" },
        },
      },
      {
        $sort: { lastMessage: -1 },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      {
        $unwind: "$userInfo",
      },
      {
        $project: {
          userId: "$_id",
          firstName: "$userInfo.firstName",
          lastName: "$userInfo.lastName",
          unreadCount: 1,
          _id: 0,
        },
      },
    ]);

    const totalUnread = await Message.countDocuments({
      to: session.user.id,
      read: false,
    });

    return NextResponse.json({
      conversations,
      totalUnread,
    });
  } catch (err) {
    console.error("[CONVERSATIONS] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
