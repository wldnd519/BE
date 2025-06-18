const mongoose = require("mongoose");

const regionMessageSchema = new mongoose.Schema({
  region: {
    type: String,
    required: true,
    enum: ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'],
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Senior",
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("RegionMessage", regionMessageSchema);