const axios = require("axios");
const { reply, getText } = require("../../core/utils");
const { aiApiUrl, aiApiKey } = require("../../config");

module.exports = {
  name: "ai",
  alias: ["ask", "bot"],
  description: "Ask the AI anything",
  async execute(client, msg, args) {
    if (!args.length) return reply(client, msg, "❌ Please ask something!");

    const question = args.join(" ");

    try {
      const res = await axios.post(
        aiApiUrl,
        { prompt: question },
        { headers: { "Authorization": `Bearer ${aiApiKey}` } }
      );

      const answer = res.data.response || "❌ No answer found";
      await reply(client, msg, `🤖 AI says:\n${answer}`);
    } catch (err) {
      console.error(err);
      await reply(client, msg, "❌ AI API failed. Try again later.");
    }
  },
};
