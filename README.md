# 🤖 WhatsApp Bot - Dynamic Menu System

A free, open-source WhatsApp bot with automatic menu updates. No rescanning needed!

## ✨ Features

✅ **Dynamic Menu Management** - Edit `menu.json` and changes apply instantly  
✅ **No QR Code Rescanning** - Bot stays connected  
✅ **Lightweight & Free** - Uses Venom Bot (Selenium-based)  
✅ **Easy to Setup** - Simple configuration  
✅ **Auto-reload** - Menu updates without restarting  

## 📋 Prerequisites

- Node.js (v14+)
- npm or yarn
- Chrome/Chromium browser installed
- Active WhatsApp account

## 🚀 Installation

1. **Clone and Setup:**
```bash
git clone https://github.com/sulimanalhassan123as-code/Never-hide-bot.git
cd Never-hide-bot
npm install
```

2. **Configure Environment:**
```bash
# Edit .env file
BOT_NUMBER=233248503631
BOT_NAME=WhatsApp Bot
```

3. **Start the Bot:**
```bash
npm start
```

4. **Scan QR Code:**
- On first run, a browser will open
- Scan the QR code with your WhatsApp phone
- Bot will start automatically

## 📝 Customizing the Menu

Edit `menu.json` to add/modify menu options:

```json
{
  "mainMenu": {
    "text": "Welcome! Choose an option:\n\n1️⃣ Help\n2️⃣ About\n3️⃣ Contact",
    "options": [
      {
        "number": "1",
        "label": "Help",
        "response": "Your custom response here"
      },
      {
        "number": "2",
        "label": "About",
        "response": "About your service"
      }
    ]
  }
}
```

**Changes apply automatically - no bot restart needed!**

## 🎮 Bot Commands

| Command | Action |
|---------|--------|
| `/start` | Start the bot |
| `menu` | Return to main menu |
| `back` | Go back to menu |
| `1-9` | Select menu option |

## 📂 Project Structure

```
Never-hide-bot/
├── app.js              # Main application
├── whatsapp-service.js # Bot service logic
├── menu.json           # Menu configuration (EDIT THIS!))
├── .env                # Environment variables
├── package.json        # Dependencies
└── README.md           # This file
```

## 🔧 File Descriptions

### `menu.json`
Contains all bot responses and menu structure. Edit this file to update bot behavior instantly.

### `whatsapp-service.js`
Handles bot initialization, message processing, and menu management.

### `app.js`
Express server and bot startup logic.

### `.env`
Configuration variables (bot number, name, etc.)

## 🐛 Troubleshooting

**Bot won't connect:**
- Ensure Chrome is installed
- Check internet connection
- Clear `session` folder if exists

**Menu not updating:**
- Verify `menu.json` syntax is valid JSON
- Check file permissions
- Ensure proper line breaks in responses

**Message not sending:**
- Verify WhatsApp number format (with country code)
- Check bot has proper permissions
- Ensure message doesn't exceed WhatsApp limits

## 📦 Dependencies

- **venom-bot** - WhatsApp automation library
- **express** - Web server framework
- **dotenv** - Environment variable management
- **nodemon** - Auto-restart during development

## ⚖️ License

This project is open source and free to use.

## 📞 Support

For issues or questions, create a GitHub issue in this repository.

---

**Happy Botting! 🎉**