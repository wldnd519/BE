const cron = require("node-cron");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Senior = require("./models/Senior");
const ChatLog = require("./models/ChatLog");
const sendSMS = require("./sendSMS");
const sendDailyChatSummary = require("./utils/emailSender");
const { OpenAI } = require("openai");

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB 연결됨"))
  .catch((err) => console.error("❌ MongoDB 연결 실패:", err));

// ✅ 1. 체크인 안한 노인 보호자에게 문자 전송
cron.schedule("0 9 * * *", async () => {
  console.log("🔍 24시간 이상 체크인 안 한 노인 확인 중...");

  const now = new Date();
  const limit = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const seniors = await Senior.find();

  for (const senior of seniors) {
    if (!senior.lastCheckIn || senior.lastCheckIn < limit) {
      console.log(`⚠️ ${senior.name}님이 24시간 넘게 체크인하지 않았습니다.`);
      console.log(`📱 보호자 연락처: ${senior.guardianContact}`);

      const message = `${senior.name}님이 24시간 넘게 체크인하지 않았습니다. 확인이 필요합니다.`;
      const phoneNumber = senior.guardianContact.replace(/^0/, "+82");

      try {
        await sendSMS(phoneNumber, message);
        console.log("📤 문자 전송 완료");
      } catch (error) {
        console.error("❌ 문자 전송 실패:", error.message);
      }
    }
  }
});

// ✅ 2. 매일 대화 요약 이메일 전송
cron.schedule("0 9 * * *", async () => {
  console.log("📨 보호자에게 대화 요약 이메일 전송 시작...");

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const todayEnd = new Date(now.setHours(23, 59, 59, 999));

  const seniors = await Senior.find();

  for (const senior of seniors) {
    const chats = await ChatLog.find({
      userId: senior._id,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    }).sort({ createdAt: 1 });

    if (chats.length === 0) continue;

    // ➤ 1. 대화 요약 프롬프트
    const summaryPrompt = [
      {
        role: "system",
        content: "다음은 노인 사용자와 AI 챗봇 간의 대화입니다. 해당 대화를 요약하여 보호자에게 전달할 수 있도록 간결하게 정리해 주세요.",
      },
      ...chats.flatMap(chat => [
        { role: "user", content: chat.userMessage },
        { role: "assistant", content: chat.botReply },
      ]),
    ];

    // ➤ 2. 감정 분석 프롬프트
    const emotionPrompt = [
      {
        role: "system",
        content: "다음은 노인 사용자와 AI 챗봇의 대화입니다. 사용자의 감정을 분석하여 보호자에게 전달할 수 있도록 정리해 주세요. 예시: '전반적으로 불안감을 보였으며, 외로움과 건강에 대한 걱정을 나타냈습니다.'",
      },
      ...chats.flatMap(chat => [
        { role: "user", content: chat.userMessage },
        { role: "assistant", content: chat.botReply },
      ]),
    ];

    try {
      // ➤ GPT-4o로 대화 요약 생성
      const summaryRes = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: summaryPrompt,
      });
      const summary = summaryRes.choices?.[0]?.message?.content?.trim() || "대화 요약 생성 실패";

      // ➤ GPT-4o로 감정 분석 생성
      const emotionRes = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: emotionPrompt,
      });
      const emotion = emotionRes.choices?.[0]?.message?.content?.trim() || "감정 분석 생성 실패";

      // ➤ 사용자 메시지 모음
      const userMessages = chats.map(chat => `- ${chat.userMessage}`).join("\n");

      // ➤ 이메일 본문 구성
      const fullEmailContent = `
📌 오늘의 대화 요약
${summary}

🗣️ 오늘 사용자가 입력한 메시지들:
${userMessages}

💬 감정 분석 결과:
${emotion}
      `.trim();

      // 이메일 발송
      await sendDailyChatSummary(senior.guardianEmail, fullEmailContent);
    } catch (error) {
      console.error(`❌ ${senior.name} 이메일 전송 실패:`, error.message);
    }
  }

  console.log("✅ 모든 보호자 이메일 전송 완료");
});