const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');

// --- 🌐 RENDER SERVER ---
const PORT = process.env.PORT || 3000;
let currentPairingCode = "Waiting for code...";

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Group Bot Server</h2>
            <div style="font-size: 40px; font-weight: bold; background: #eee; padding: 20px; display: inline-block;">
                ${currentPairingCode}
            </div>
            <p>Refresh page to see the latest code.</p>
        </html>
    `);
});
server.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// --- 🤖 BOT MEMORY & ENGINE ---
let currentBotName = config.botName; 
const sessionFolder = 'group_bot_session';

async function startBot() {
    console.log(`🟢 STARTING ENGINE: ${currentBotName}...`);

    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Mac OS", "Safari", "10.15.7"], 
        markOnlineOnConnect: true
    });

    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n✅ SEND THIS CODE TO YOUR FRIEND: ${currentPairingCode}\n`);
            } catch (err) {
                console.log("⚠️ Error generating code. Check config.js");
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            console.log(`⚠️ Connection Closed! Reason: ${reason}`);
            
            if (reason === 405 || reason === 401) {
                try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch(e) {}
                setTimeout(startBot, 5000);
            } else if (reason !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 5000);
            } else {
                try { fs.rmSync(sessionFolder, { recursive: true, force: true }); } catch(e) {}
                setTimeout(startBot, 5000);
            }
        } else if (connection === 'open') {
            console.log(`✅ BOT CONNECTED TO WHATSAPP!`);
            currentPairingCode = "Connected! ✅";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- 📱 THE ULTIMATE GROUP MENU ---
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const sender = isGroup ? msg.key.participant : from;
            
            const type = Object.keys(msg.message)[0];
            const body = (type === 'conversation') ? msg.message.conversation :
                         (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';

            const senderName = msg.pushName || "Member";

            if (body.startsWith(config.prefix)) {
                const args = body.slice(config.prefix.length).trim().split(' ');
                const command = args.shift().toLowerCase();
                const textArg = args.join(" ");

                // Permission Checks
                const isOwner = sender.includes(config.ownerNumber);
                let isAdmin = false;
                let isBotAdmin = false;

                if (isGroup) {
                    const groupMetadata = await sock.groupMetadata(from);
                    const participants = groupMetadata.participants;
                    const admins = participants.filter(p => p.admin !== null).map(p => p.id);
                    isAdmin = admins.includes(sender);
                    
                    // Check if bot itself is admin (needs to be to kick/promote/etc)
                    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    isBotAdmin = admins.includes(botId);
                }

                const isAuthorized = isOwner || isAdmin;

                switch (command) {
                    case 'menu':
                        const menuText = `
╔════ 👑 *${currentBotName.toUpperCase()}* 👑 ════╗
║ Welcome to the Group, *${senderName}*!
╚═════════════════════════╝

*🛡️ ADMIN CONTROLS* _(Admins Only)_
▸ *${config.prefix}hidetag [text]* - Ping everyone silently
▸ *${config.prefix}kick @user* - Remove rulebreaker
▸ *${config.prefix}promote @user* - Make Admin
▸ *${config.prefix}demote @user* - Remove Admin
▸ *${config.prefix}mute* - Lock group chat
▸ *${config.prefix}unmute* - Unlock group chat
▸ *${config.prefix}link* - Get group invite link

*🎭 ENTERTAINMENT & GAMES*
▸ *${config.prefix}truth* - Get a truth question
▸ *${config.prefix}dare* - Get a dare challenge
▸ *${config.prefix}roast* - Roast someone
▸ *${config.prefix}rizz* - Drop a smooth pickup line
▸ *${config.prefix}8ball [question]* - See the future

*🧠 COMPANION & ADVICE*
▸ *${config.prefix}advice* - Get daily wisdom
▸ *${config.prefix}joke* - Lighten the mood
▸ *${config.prefix}fact* - Learn something new

*⚙️ UTILITY*
▸ *${config.prefix}ping* - Check bot speed
▸ *${config.prefix}groupinfo* - See group stats
`;
                        await sock.sendMessage(from, { text: menuText.trim() });
                        break;

                    // ------------------------------------
                    // 🛡️ ADMIN COMMANDS
                    // ------------------------------------
                    case 'hidetag':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ This is a group command!` });
                        if (!isAuthorized) return await sock.sendMessage(from, { text: `❌ Only Admins can use this.` });
                        const groupMetadata = await sock.groupMetadata(from);
                        const allJids = groupMetadata.participants.map(p => p.id);
                        await sock.sendMessage(from, { text: textArg || "📢 Attention everyone!", mentions: allJids });
                        break;

                    case 'kick':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ Group only!` });
                        if (!isAuthorized) return await sock.sendMessage(from, { text: `❌ Only Admins can kick.` });
                        if (!isBotAdmin) return await sock.sendMessage(from, { text: `❌ Make me an Admin first so I can kick people!` });
                        const userToKick = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!userToKick) return await sock.sendMessage(from, { text: `❌ Mention the user: *${config.prefix}kick @user*` });
                        await sock.groupParticipantsUpdate(from, [userToKick], "remove");
                        await sock.sendMessage(from, { text: `👢 User has been removed from the group.` });
                        break;

                    case 'promote':
                    case 'demote':
                        if (!isGroup) return await sock.sendMessage(from, { text: `❌ Group only!` });
                        if (!isAuthorized) return await sock.sendMessage(from, { text: `❌ Admins only.` });
                        if (!isBotAdmin) return await sock.sendMessage(from, { text: `❌ I need Admin rights first!` });
                        const targetUser = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                        if (!targetUser) return await sock.sendMessage(from, { text: `❌ Mention the user.` });
                        const action = command === 'promote' ? 'promote' : 'demote';
                        await sock.groupParticipantsUpdate(from, [targetUser], action);
                        await sock.sendMessage(from, { text: `✅ User successfully ${action}d.` });
                        break;

                    case 'mute':
                        if (!isGroup || !isAuthorized) return;
                        if (!isBotAdmin) return await sock.sendMessage(from, { text: `❌ I need Admin rights first!` });
                        await sock.groupSettingUpdate(from, 'announcement');
                        await sock.sendMessage(from, { text: `🔒 *Group Muted* - Only admins can send messages now.` });
                        break;

                    case 'unmute':
                        if (!isGroup || !isAuthorized) return;
                        if (!isBotAdmin) return await sock.sendMessage(from, { text: `❌ I need Admin rights first!` });
                        await sock.groupSettingUpdate(from, 'not_announcement');
                        await sock.sendMessage(from, { text: `🔓 *Group Unmuted* - Everyone can send messages again.` });
                        break;

                    case 'link':
                        if (!isGroup || !isAuthorized) return;
                        if (!isBotAdmin) return await sock.sendMessage(from, { text: `❌ I need Admin rights first!` });
                        const code = await sock.groupInviteCode(from);
                        await sock.sendMessage(from, { text: `🔗 *Group Invite Link:*\nhttps://chat.whatsapp.com/${code}` });
                        break;

                    case 'groupinfo':
                        if (!isGroup) return;
                        const meta = await sock.groupMetadata(from);
                        const infoText = `📊 *${meta.subject}*\n👥 Members: ${meta.participants.length}\n👑 Owner: @${meta.owner?.split('@')[0] || 'Hidden'}`;
                        await sock.sendMessage(from, { text: infoText, mentions: [meta.owner] });
                        break;

                    // ------------------------------------
                    // 🎭 ENTERTAINMENT & GAMES
                    // ------------------------------------
                    case 'truth':
                        const truths = [
                            "What is your most embarrassing moment?",
                            "Who in this group do you text the most?",
                            "What is the biggest lie you ever told?",
                            "Have you ever snooped through someone's phone?",
                            "What is your weirdest habit?"
                        ];
                        await sock.sendMessage(from, { text: `🎯 *TRUTH:* ${truths[Math.floor(Math.random() * truths.length)]}` });
                        break;

                    case 'dare':
                        const dares = [
                            "Send the 5th picture in your camera roll right now.",
                            "Send a voice note singing the chorus of your favorite song.",
                            "Change your WhatsApp profile picture to a monkey for 1 hour.",
                            "Type your next 5 messages using only your nose.",
                            "Confess something funny to the group."
                        ];
                        await sock.sendMessage(from, { text: `🔥 *DARE:* ${dares[Math.floor(Math.random() * dares.length)]}` });
                        break;

                    case 'rizz':
                        const rizzLines = [
                            "Are you a Wi-Fi signal? Because I'm feeling a strong connection. 📶",
                            "Do you have a map? I just keep getting lost in your eyes. 🗺️",
                            "Are you a magician? Because whenever I look at you, everyone else disappears. ✨",
                            "Is your name Google? Because you have everything I’ve been searching for. 🔍"
                        ];
                        await sock.sendMessage(from, { text: `😏 *Rizz:* ${rizzLines[Math.floor(Math.random() * rizzLines.length)]}` });
                        break;

                    case 'roast':
                        const roasts = [
                            "I'd agree with you, but then we’d both be wrong. 🤡",
                            "You bring everyone so much joy... when you leave the room. 🚪",
                            "I’m not insulting you, I’m describing you. 📉",
                            "You are like a cloud. When you disappear, it’s a beautiful day. ☀️"
                        ];
                        await sock.sendMessage(from, { text: `🔥 *Roast:* ${roasts[Math.floor(Math.random() * roasts.length)]}` });
                        break;

                    case '8ball':
                        if (!textArg) return await sock.sendMessage(from, { text: `❌ Ask a question: *${config.prefix}8ball will I be rich?*` });
                        const answers = ["Yes, definitely. 🟢", "Without a doubt. 🟢", "Ask again later. 🟡", "My sources say no. 🔴", "Very doubtful. 🔴"];
                        await sock.sendMessage(from, { text: `🎱 *Magic 8-Ball says:*\n${answers[Math.floor(Math.random() * answers.length)]}` });
                        break;

                    // ------------------------------------
                    // 🧠 COMPANION & ADVICE
                    // ------------------------------------
                    case 'advice':
                        const adviceList = [
                            "Don't make a permanent decision for your temporary emotion. 🌱",
                            "If you want to fly, you have to give up the things that weigh you down. 🦅",
                            "Sometimes the hardest thing and the right thing are the same. ⚖️",
                            "Drink water, mind your business, and keep pushing forward. 💧"
                        ];
                        await sock.sendMessage(from, { text: `💡 *Advice for you:*\n${adviceList[Math.floor(Math.random() * adviceList.length)]}` });
                        break;

                    case 'joke':
                        const jokes = ["Why don't skeletons fight? They don't have the guts. 💀", "What do you call fake spaghetti? An impasta! 🍝"];
                        await sock.sendMessage(from, { text: `😂 *Joke:* ${jokes[Math.floor(Math.random() * jokes.length)]}` });
                        break;

                    case 'fact':
                        const facts = ["Bananas grow towards the sun. 🍌", "A day on Venus is longer than a year on Venus. 🪐"];
                        await sock.sendMessage(from, { text: `🧠 *Fact:* ${facts[Math.floor(Math.random() * facts.length)]}` });
                        break;

                    case 'ping':
                        await sock.sendMessage(from, { text: `Pong! 🏓\nGroup Engine is online and fast.` });
                        break;
                }
            }
        } catch (err) {
            console.log("Message Error:", err);
        }
    });
}

startBot();
