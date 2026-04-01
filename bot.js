require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const mongoose = require('mongoose');

// ENV
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGO_URI = process.env.MONGO_URI;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// DB CONNECT
mongoose.connect(MONGO_URI);
console.log("MongoDB Connected");

// USER MODEL
const userSchema = new mongoose.Schema({
  user_id: Number,
  name: String,
  coins: { type: Number, default: 100 },
  spins: { type: Number, default: 5 },
  last_daily: { type: Date, default: null },
  referrals: { type: Number, default: 0 },
  referred_by: { type: Number, default: null }
});
const User = mongoose.model('User', userSchema);

// BOT
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// SLOT ITEMS
const items = ["🍎","🍊","🍇","🍒","🍉","🥝","🍍"];

// RANDOM RESULT
function spinResult() {
  return [
    items[Math.floor(Math.random()*items.length)],
    items[Math.floor(Math.random()*items.length)],
    items[Math.floor(Math.random()*items.length)]
  ];
}

// WIN CALC
function calcWin(r) {
  if (r[0] === r[1] && r[1] === r[2]) return 50;
  if (r[0] === r[1] || r[1] === r[2]) return 10;
  return 0;
}

// GET USER
async function getUser(id, name) {
  let user = await User.findOne({ user_id: id });
  if (!user) {
    user = await User.create({ user_id: id, name });
  }
  return user;
}

// START
bot.start(async (ctx) => {
  const id = ctx.from.id;
  const name = ctx.from.first_name;

  let user = await getUser(id, name);

  await ctx.reply(
`🎰 Welcome ${name}

💰 Coins: ${user.coins}
🎟 Spins: ${user.spins}

👇 Choose option`,
Markup.keyboard([
['🎰 Spin','🎁 Daily'],
['👥 Referral','💰 Balance'],
['🏆 Leaderboard','💸 Withdraw']
]).resize()
);
});

// SPIN
bot.hears('🎰 Spin', async (ctx) => {
  const user = await getUser(ctx.from.id);

  if (user.spins <= 0) {
    return ctx.reply("❌ No spins left");
  }

  user.spins -= 1;
  await user.save();

  let msg = await ctx.reply("🎰 Spinning...\n🍒 | 🍋 | 🍊");

  // FAKE ANIMATION
  for (let i=0; i<5; i++) {
    let r = spinResult();
    await new Promise(r => setTimeout(r, 500));
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `🎰 Spinning...\n${r.join(" | ")}`
    );
  }

  const result = spinResult();
  const win = calcWin(result);

  user.coins += win;
  await user.save();

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    msg.message_id,
    null,
`🎉 Result: ${result.join(" | ")}

💰 Won: ${win} coins
💵 Total: ${user.coins}
🎟 Spins left: ${user.spins}`
  );
});

// DAILY BONUS
bot.hears('🎁 Daily', async (ctx) => {
  const user = await getUser(ctx.from.id);

  const now = Date.now();
  if (user.last_daily && now - user.last_daily < 86400000) {
    return ctx.reply("⏳ Already claimed today");
  }

  user.coins += 20;
  user.spins += 2;
  user.last_daily = now;

  await user.save();

  ctx.reply("🎁 Daily bonus claimed!\n+20 coins\n+2 spins");
});

// BALANCE
bot.hears('💰 Balance', async (ctx) => {
  const u = await getUser(ctx.from.id);
  ctx.reply(`💰 Coins: ${u.coins}\n🎟 Spins: ${u.spins}`);
});

// REFERRAL
bot.hears('👥 Referral', async (ctx) => {
  const botInfo = await bot.telegram.getMe();
  const link = `https://t.me/${botInfo.username}?start=${ctx.from.id}`;

  ctx.reply(`👥 Invite friends:\n${link}\n\n🎁 Get 2 spins per join`);
});

// LEADERBOARD
bot.hears('🏆 Leaderboard', async (ctx) => {
  const top = await User.find().sort({ coins: -1 }).limit(5);

  let text = "🏆 Top Players\n\n";
  top.forEach((u,i)=>{
    text += `${i+1}. ${u.name} - ${u.coins}\n`;
  });

  ctx.reply(text);
});

// WITHDRAW
bot.hears('💸 Withdraw', async (ctx) => {
  const user = await getUser(ctx.from.id);

  if (user.coins < 500) {
    return ctx.reply("❌ Minimum 500 coins required");
  }

  user.coins -= 500;
  await user.save();

  ctx.reply("✅ Withdraw request sent (demo)");
});

// WEBHOOK
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
bot.startWebhook('/webhook', null, PORT);

console.log("Bot Running...");
