const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');
const crypto = require('crypto'); // Fix crypto error

// 🌐 Render web page
const PORT = process.env.PORT || 3000;
let currentPairingCode = "Waiting for code...";

const server = http.createServer((req,res)=>{
    res.writeHead(200,{'Content-Type':'text/html'});
    res.end(`
        <html style="font-family:sans-serif;text-align:center;padding-top:50px;">
            <h2>NeverHide WhatsApp Bot</h2>
            <div style="font-size:40px;font-weight:bold;background:#eee;padding:20px;display:inline-block;">
                ${currentPairingCode}
            </div>
            <p>Refresh this page to see updates</p>
        </html>
    `);
});
server.listen(PORT,()=>console.log(`🌐 Web server running on port ${PORT}`));

// Bot variables
let currentBotName = config.botName;

// Start the bot
async function startBot(){
    console.log(`🟢 Starting: ${currentBotName}...`);
    const sessionFolder = 'bot_session';
    if(!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const sock = makeWASocket({
        logger: pino({level:'silent'}),
        printQRInTerminal: false,
        auth: state,
        browser: ["NeverHide", "Bot", "1.0"],
        markOnlineOnConnect: true
    });

    // Connection handling
    sock.ev.on('connection.update',(update)=>{
        const { connection, lastDisconnect } = update;
        if(connection==='close'){
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            console.log(`⚠️ Connection Closed! Reason: ${reason||"Unknown"}`);
            setTimeout(startBot,5000); // auto-reconnect
        } else if(connection==='open'){
            console.log("✅ BOT CONNECTED TO WHATSAPP!");
            currentPairingCode = "Connected! ✅";
        }
    });

    sock.ev.on('creds.update',saveCreds);

    // Message handler
    sock.ev.on('messages.upsert', async (m)=>{
        try{
            const msg = m.messages[0];
            if(!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const type = Object.keys(msg.message)[0];
            const body = (type==='conversation') ? msg.message.conversation :
                         (type==='extendedTextMessage') ? msg.message.extendedTextMessage.text : '';
            const senderName = msg.pushName || "User";

            if(!body.startsWith(config.prefix)) return;

            const args = body.slice(config.prefix.length).trim().split(' ');
            const command = args.shift().toLowerCase();
            const textArg = args.join(' ');

            // Menu template
            const menuText = `
╔════ 🤖 *${currentBotName.toUpperCase()}* ════╗
║ 👋 Hello, *${senderName}*!
║ 👑 Developer: *${config.ownerName}*
╚════════════════════════╝

*🛠️ TOOLS*
▸ *${config.prefix}setname [name]* - Rename bot
▸ *${config.prefix}ping* - Check speed
▸ *${config.prefix}info* - Bot info

*👥 GROUP COMMANDS*
▸ *${config.prefix}hidetag [text]* - Notify all
▸ *${config.prefix}kick @user* - Remove
▸ *${config.prefix}promote @user* - Admin
▸ *${config.prefix}demote @user* - Remove admin
▸ *${config.prefix}groupinfo* - Group details

*🎮 FUN*
▸ *${config.prefix}joke* - Random joke
▸ *${config.prefix}fact* - Random fact
▸ *${config.prefix}flip* - Coin flip
▸ *${config.prefix}roll* - Dice roll
▸ *${config.prefix}rps [rock|paper|scissors]* - Play game
`;

            switch(command){
                case 'menu': await sock.sendMessage(from,{text:menuText}); break;
                case 'setname':
                    if(!textArg) return await sock.sendMessage(from,{text:`❌ Example: *${config.prefix}setname AlphaBot*`});
                    currentBotName = textArg;
                    await sock.sendMessage(from,{text:`✅ Name changed to *${currentBotName}*`});
                    break;
                case 'ping': await sock.sendMessage(from,{text:'Pong! 🏓 Bot running perfectly.'}); break;
                case 'info': await sock.sendMessage(from,{text:`ℹ️ Bot Info\nDeveloper: ${config.ownerName}\nName: ${currentBotName}\nStatus: Online 🟢`}); break;
                case 'joke':
                    const jokes = ["Why programmers prefer dark mode? Light attracts bugs. 🐛","I invented a new word! Plagiarism! 😂"];
                    await sock.sendMessage(from,{text:jokes[Math.floor(Math.random()*jokes.length)]}); break;
                case 'fact':
                    const facts = ["Water covers 71% of Earth's surface 🌍","Sun rises in east, sets in west 🌅"];
                    await sock.sendMessage(from,{text:facts[Math.floor(Math.random()*facts.length)]}); break;
                case 'flip':
                    await sock.sendMessage(from,{text:`🪙 Coin: *${Math.random()<0.5?"Heads":"Tails"}*`}); break;
                case 'roll':
                    await sock.sendMessage(from,{text:`🎲 Dice: *${Math.floor(Math.random()*6)+1}*`}); break;
                case 'rps':
                    if(!textArg) return await sock.sendMessage(from,{text:"❌ Choose rock, paper, or scissors"});
                    const choices=['rock','paper','scissors'];
                    const botChoice=choices[Math.floor(Math.random()*3)];
                    const result=(textArg===botChoice)?"Draw!":(textArg==='rock'&&botChoice==='scissors')||(textArg==='paper'&&botChoice==='rock')||(textArg==='scissors'&&botChoice==='paper')?"You win!":"Bot wins!";
                    await sock.sendMessage(from,{text:`🎮 You: ${textArg}\n🤖 Bot: ${botChoice}\nResult: ${result}`}); break;
            }
        } catch(err){
            console.log("Message Error:",err);
        }
    });
}

startBot();
