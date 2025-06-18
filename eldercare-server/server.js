// server.js
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const verifyToken = require("./middleware/auth"); // 상단에 추가
const Senior = require("./models/Senior");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ChatLog = require("./models/ChatLog");
const app = express();
const PORT = process.env.PORT || 5000;
const sendDailyChatSummary = require("./utils/emailSender");
const RegionMessage = require("./models/RegionMessage");

app.use(cors());
app.use(express.json());

// 기본 라우트
app.get("/", (req, res) => {
  res.send("서버가 잘 작동 중입니다!");
});

// MongoDB 연결
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB에 연결됨"))
  .catch((err) => console.error("❌ MongoDB 연결 실패:", err));

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);


});

app.post("/api/checkin", verifyToken, async (req, res) => {
    const userId = req.user.id;
  
    try {
      const senior = await Senior.findByIdAndUpdate(
        userId,
        { lastCheckIn: new Date() },
        { new: true }
      );
  
      if (!senior) {
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
      }
  
      res.json({ message: "체크인 완료", data: senior });
    } catch (err) {
      console.error("체크인 오류:", err);
      res.status(500).json({ error: "서버 오류" });
    }
  });

app.post("/api/register", async (req, res) => {
    const { name, password, guardianContact, guardianEmail, region } = req.body;
  
    try {
      const existing = await Senior.findOne({ name });
      if (existing) return res.status(400).json({ error: "이미 존재하는 사용자입니다." });
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const newSenior = new Senior({
        name,
        password: hashedPassword,
        guardianContact,
        guardianEmail,
        region,
      });
  
      await newSenior.save();
  
      res.status(201).json({ message: "회원가입 성공" });
    } catch (err) {
      console.error("회원가입 오류:", err);
      res.status(500).json({ error: "서버 오류" });
    }
});

// 노인 로그인
app.post("/api/login", async (req, res) => {
    const { name, password } = req.body;
  
    try {
      const senior = await Senior.findOne({ name });
      if (!senior) return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  
      const isMatch = await bcrypt.compare(password, senior.password);
      if (!isMatch) return res.status(401).json({ error: "비밀번호가 일치하지 않습니다." });
  
      const token = jwt.sign({ id: senior._id, name: senior.name }, "secretKey", { expiresIn: "1d" });
  
      res.json({ message: "로그인 성공", token });
    } catch (err) {
      console.error("로그인 오류:", err);
      res.status(500).json({ error: "서버 오류" });
    }
});

app.post("/api/chat", verifyToken, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "메시지를 입력해주세요." });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: message }],
    });

    const reply = response.choices?.[0]?.message?.content?.trim();

    // ✅ 대화 내용 저장
    const chatLog = new ChatLog({
      userId,
      userMessage: message,
      botReply: reply,
    });
    await chatLog.save();

    res.json({ reply });
  } catch (error) {
    console.error("OpenAI 응답 오류:", error);
    res.status(500).json({ error: "AI 챗봇 응답 실패" });
  }
});


app.get("/api/analyze", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // 최근 대화 10개 불러오기 (최신순 정렬)
    const recentChats = await ChatLog.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);

    if (recentChats.length === 0) {
      return res.status(400).json({ error: "대화 기록이 없습니다." });
    }

    // GPT에게 보낼 메시지 배열 구성
    const messages = [
      {
        role: "system",
        content:
          "당신은 감정 분석가입니다. 다음 대화를 보고 사용자의 현재 감정 상태를 추론하세요. 감정 키워드와 이유를 간결하게 설명해주세요.",
      },
      ...recentChats
        .reverse() // 오래된 대화부터 순서대로
        .flatMap((chat) => [
          { role: "user", content: chat.userMessage },
          { role: "assistant", content: chat.botReply },
        ]),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
    });

    const analysis = response.choices?.[0]?.message?.content?.trim();
    res.json({ emotionAnalysis: analysis });
  } catch (error) {
    console.error("감정 분석 오류:", error);
    res.status(500).json({ error: "감정 분석 실패" });
  }
});

app.post("/api/test-email", async (req, res) => {
  const { toEmail, content } = req.body;
  try {
    await sendDailyChatSummary(toEmail, content);
    res.json({ message: "테스트 이메일 전송 성공" });
  } catch (err) {
    res.status(500).json({ error: "이메일 전송 실패" });
  }
});

app.post("/api/region-chat", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { message } = req.body;

  try {
    const senior = await Senior.findById(userId);
    if (!senior) return res.status(404).json({ error: "사용자 없음" });

    const newMessage = new RegionMessage({
      region: senior.region,
      userId: senior._id,
      userName: senior.name,
      message,
    });

    await newMessage.save();
    res.status(201).json({ message: "메시지 전송 완료" });
  } catch (err) {
    console.error("메시지 저장 오류:", err);
    res.status(500).json({ error: "서버 오류" });
  }
});

app.get("/api/region-chat", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const senior = await Senior.findById(userId);
    if (!senior) return res.status(404).json({ error: "사용자 없음" });

    const messages = await RegionMessage.find({ region: senior.region })
      .sort({ timestamp: 1 }); // 오래된 순

    res.json({ region: senior.region, messages });
  } catch (err) {
    console.error("메시지 불러오기 오류:", err);
    res.status(500).json({ error: "서버 오류" });
  }
});