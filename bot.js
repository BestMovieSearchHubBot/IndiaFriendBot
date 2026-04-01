require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO = process.env.MONGODB_URI;

// DB
mongoose.connect(MONGO);
console.log("DB Connected");

// MODEL
const User = mongoose.model('User', new mongoose.Schema({
  user_id:Number,
  coins:{type:Number,default:100}
}));

// BOT
const bot = new Telegraf(BOT_TOKEN);

// START → OPEN MINI APP
bot.start((ctx)=>{
  ctx.reply("🎰 Open Casino", {
    reply_markup:{
      inline_keyboard:[
        [{ text:"🎰 PLAY", web_app:{ url: process.env.WEBAPP_URL } }]
      ]
    }
  });
});

// ===== API =====

// GET USER
app.get('/user/:id', async (req,res)=>{
  let u = await User.findOne({ user_id:req.params.id });
  if(!u) u = await User.create({ user_id:req.params.id });
  res.json(u);
});

// SPIN
app.post('/spin', async (req,res)=>{
  const { user_id } = req.body;

  let u = await User.findOne({ user_id });
  if(!u) u = await User.create({ user_id });

  const items = ["🍎","🍊","🍇","🍒"];
  const r = [
    items[Math.floor(Math.random()*4)],
    items[Math.floor(Math.random()*4)],
    items[Math.floor(Math.random()*4)]
  ];

  let win = 0;
  if(r[0]==r[1] && r[1]==r[2]) win = 50;
  else if(r[0]==r[1] || r[1]==r[2]) win = 10;

  u.coins += win;
  await u.save();

  res.json({ result:r, win, coins:u.coins });
});

// WITHDRAW
app.post('/withdraw', async (req,res)=>{
  const { user_id } = req.body;

  let u = await User.findOne({ user_id });
  if(u.coins < 500) return res.json({ ok:false });

  u.coins -= 500;
  await u.save();

  res.json({ ok:true });
});

// ADMIN PANEL DATA
app.get('/admin/users', async (req,res)=>{
  const users = await User.find().sort({ coins:-1 }).limit(50);
  res.json(users);
});

// START SERVER
app.listen(3000, ()=> console.log("Server Running"));
bot.launch();
