const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendDailyChatSummary = async (toEmail, summaryContent) => {
  const mailOptions = {
    from: `"노인 말벗 서비스" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "오늘의 말벗 대화 요약",
    text: summaryContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 이메일 전송 성공 → ${toEmail}`);
  } catch (error) {
    console.error("❌ 이메일 전송 실패:", error);
  }
};

module.exports = sendDailyChatSummary;