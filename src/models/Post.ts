import { InferSchemaType, model, models, Schema, Types } from "mongoose";

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    media: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["image", "pdf"], required: true },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        name: { type: String, default: "" },
      },
    ],
    reactions: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        type: {
          type: String,
          enum: ["love", "care", "celebrate", "insightful", "support"],
          required: true,
        },
      },
    ],
    comments: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    shareCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type IPost = InferSchemaType<typeof postSchema> & { _id: Types.ObjectId };

const Post = models.Post || model("Post", postSchema);
export default Post;
