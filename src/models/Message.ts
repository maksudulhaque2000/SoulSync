import { model, models, Schema } from "mongoose";

const messageSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "" },
    voiceUrl: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Message = models.Message || model("Message", messageSchema);
export default Message;
