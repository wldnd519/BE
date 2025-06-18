const mongoose = require("mongoose");

const chatLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Senior",
      required: true,
    },
    userMessage: {
      type: String,
      required: true,
    },
    botReply: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // ✅ createdAt, updatedAt 자동 추가
  }
);

module.exports = mongoose.model("ChatLog", chatLogSchema);