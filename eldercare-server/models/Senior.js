const mongoose = require("mongoose");

const seniorSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // 👈 비밀번호 추가
  guardianContact: { type: String, required: true },
  guardianEmail: { type: String, required: true },
  lastCheckIn: { type: Date, default: null },
  region: {
    type: String,
    required: true,
    enum: ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'],
  },
});

module.exports = mongoose.model("Senior", seniorSchema);