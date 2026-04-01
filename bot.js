require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBAPP_URL = process.env.WEBAPP_URL;
const PORT = process.env.PORT || 3000;

// ===== DEBUG =====
console.log("WEBHOOK:", WEBHOOK_URL);
console.log("WEBAPP:", WEBAPP_URL);

// ===== DB =====
mongoose.connect(MONGODB_URI)
.then(()=> console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ DB Error:", err));

// ===== MODEL =====
const User = mongoose.model('User', new mongoose.Schema({
  user_id:Number,
  coins:{type:Number,default:100}
}));

// ===== BOT =====
const bot = new Telegraf(BOT_TOKEN);

// ===== START BUTTON (FIXED) =====
bot.start((ctx)=>{
  if (!WEBAPP_URL) {
    return ctx.reply("❌ WEBAPP_URL not set");
  }

  ctx.reply("🎰 Open Casino", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🎰 PLAY",
            web_app: { url: WEBAPP_URL }
          }
        ]
      ]
    }
  });
});

// ===== API =====

// GET USER
app.get('/user/:id', async (req,res)=>{
  let user = await User.findOne({ user_id:req.params.id });
  if(!user) user = await User.create({ user_id:req.params.id });
  res.json(user);
});

// SPIN
app.post('/spin', async (req,res)=>{
  const { user_id } = req.body;

  let user = await User.findOne({ user_id });
  if(!user) user = await User.create({ user_id });

  const items = ["🍎","🍊","🍇","🍒","🍉"];
  const r = [
    items[Math.floor(Math.random()*items.length)],
    items[Math.floor(Math.random()*items.length)],
    items[Math.floor(Math.random()*items.length)]
  ];

  let win = 0;
  if(r[0]==r[1] && r[1]==r[2]) win = 50;
  else if(r[0]==r[1] || r[1]==r[2]) win = 10;

  user.coins += win;
  await user.save();

  res.json({ result:r, win, coins:user.coins });
});

// WITHDRAW
app.post('/withdraw', async (req,res)=>{
  const { user_id } = req.body;

  let user = await User.findOne({ user_id });

  if(user.coins < 500){
    return res.json({ ok:false, msg:"Not enough coins" });
  }

  user.coins -= 500;
  await user.save();

  res.json({ ok:true });
});

// ===== SERVER START =====
app.listen(PORT, ()=> console.log("🌐 Server running"));

// ===== WEBHOOK =====
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
app.use(bot.webhookCallback('/webhook'));

console.log("🤖 Bot running...");
