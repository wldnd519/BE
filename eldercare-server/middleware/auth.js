// middleware/auth.js
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "인증 토큰이 없습니다." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, "secretKey"); // 토큰 복호화
    req.user = decoded; // 요청 객체에 사용자 정보 추가
    next();
  } catch (err) {
    console.error("토큰 인증 실패:", err);
    return res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
};

module.exports = verifyToken;