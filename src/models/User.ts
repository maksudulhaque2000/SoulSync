import { InferSchemaType, model, models, Schema, Types } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    phone: { type: String, default: "" },
    age: { type: Number, default: 0 },
    birthDate: { type: Date, default: null },
    gender: {
      type: String,
      enum: ["male", "female", "non-binary", "prefer-not-to-say"],
      default: "prefer-not-to-say",
    },
    connections: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pendingSent: [{ type: Schema.Types.ObjectId, ref: "User" }],
    pendingReceived: [{ type: Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export type IUser = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };

const User = models.User || model("User", userSchema);
export default User;
