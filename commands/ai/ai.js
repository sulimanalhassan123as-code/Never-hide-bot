const { reply, getText } = require("../../core/utils");
const axios = require("axios");

// Keep conversation memory per chat
const memory = {};

module.exports = {
  name: "ai",
  alias: ["ask", "gpt"],
  description: "Ask a question to the AI assistant with memory",
  execute: async (sock, msg, args) => {
    try {
      const chatId = msg.key.remoteJid;
      if (!args.length)
        return reply(sock, msg, "❌ Please provide a question. Example: `.ai Hello!`");

      const question = args.join(" ");

      // Initialize memory for this chat
      if (!memory[chatId]) memory[chatId] = [];

      // Add the new question to memory
      memory[chatId].push(`User: ${question}`);

      // Keep last 5 messages only
      const context = memory[chatId].slice(-5).join("\n");

      // Call free AI endpoint
      const { data } = await axios.get(
        `https://api.affiliateplus.xyz/api/chatbot?message=${encodeURIComponent(
          context
        )}&botname=NEVER%20HIDE%20SUPER%20BOT&ownername=Suleiman`
      );

      if (!data || !data.message)
        return reply(sock, msg, "❌ Failed to get AI response. Try again later.");

      // Add AI reply to memory
      memory[chatId].push(`Bot: ${data.message}`);

      // Send AI reply
      await reply(sock, msg, `🤖 AI Answer:\n${data.message}`);
    } catch (err) {
      console.error(err);
      await reply(sock, msg, "❌ Failed to get AI response. Try again later.");
    }
  }
};
