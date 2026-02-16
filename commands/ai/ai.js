const { reply, getText } = require("../../core/utils");
const axios = require("axios");

module.exports = {
  name: "ai",
  alias: ["ask", "gpt"],
  description: "Ask a question to the AI assistant (Free version)",
  execute: async (sock, msg, args) => {
    try {
      if (!args.length)
        return reply(sock, msg, "❌ Please provide a question. Example: `.ai Hello!`");

      const question = args.join(" ");

      // Call free AI endpoint (Simsimi style)
      const { data } = await axios.get(
        `https://api.affiliateplus.xyz/api/chatbot?message=${encodeURIComponent(
          question
        )}&botname=NEVER%20HIDE%20SUPER%20BOT&ownername=Suleiman`
      );

      if (!data || !data.message)
        return reply(sock, msg, "❌ Failed to get AI response. Try again later.");

      await reply(sock, msg, `🤖 AI Answer:\n${data.message}`);
    } catch (err) {
      console.error(err);
      await reply(sock, msg, "❌ Failed to get AI response. Try again later.");
    }
  }
};
