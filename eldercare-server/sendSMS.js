// sendSMS.js
const dotenv = require("dotenv");
dotenv.config();

const twilio = require("twilio");
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE;

const client = twilio(accountSid, authToken);

const sendSMS = (to, message) => {
  return client.messages.create({
    body: message,
    from: fromPhone,
    to: to, // 한국 번호는 "+82"로 시작해야 함
  });
};

module.exports = sendSMS;