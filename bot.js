require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const mongoose = require('mongoose');

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 3000;

// ===== DB CONNECT =====
mongoose.connect(MONGODB_URI)
.then(()=> console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ DB Error:", err));

// ===== USER MODEL =====
const userSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true },
  name: String,
  coins: { type: Number, default: 100 },
  spins: { type: Number, default: 5 },
  referrals: { type: Number, default: 0 },
  referred_by: { type: Number, default: null },
  last_daily: { type: Date, default: null }
});

const User = mongoose.model('User', userSchema);

// ===== BOT =====
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ===== SLOT ITEMS =====
const items = ["🍎","🍊","🍇","🍒","🍉","🥝","🍍"];

// RANDOM RESULT
function spinRoll() {
  return items[Math.floor(Math.random()*items.length)];
}

// RESULT CALC
function calculateWin(a,b,c){
  if(a===b && b===c) return 50;
  if(a===b || b===c || a===c) return 10;
  return 0;
}

// GET USER
async function getUser(id, name="User"){
  let user = await User.findOne({ user_id:id });
  if(!user){
    user = await User.create({
      user_id:id,
      name
    });
  }
  return user;
}

// ===== MENU =====
function menu(){
  return Markup.keyboard([
    ['🎰 Spin','🎁 Daily'],
    ['👥 Referral','💰 Balance'],
    ['🏆 Leaderboard','💸 Withdraw']
  ]).resize();
}

// ===== START =====
bot.start(async (ctx)=>{
  const id = ctx.from.id;
  const name = ctx.from.first_name;

  const args = ctx.message.text.split(" ");
  let ref = null;

  if(args[1]) ref = parseInt(args[1]);

  let user = await getUser(id, name);

  // referral
  if(ref && ref !== id && !user.referred_by){
    user.referred_by = ref;
    await user.save();

    let refUser = await User.findOne({ user_id: ref });
    if(refUser){
      refUser.spins += 2;
      refUser.referrals += 1;
      await refUser.save();
    }
  }

  ctx.reply(
`🎰 Welcome ${name}

💰 Coins: ${user.coins}
🎟 Spins: ${user.spins}`,
menu()
  );
});

// ===== SPIN =====
bot.hears('🎰 Spin', async (ctx)=>{
  const user = await getUser(ctx.from.id);

  if(user.spins <= 0){
    return ctx.reply("❌ No spins left");
  }

  user.spins -= 1;
  await user.save();

  let msg = await ctx.reply("🎰 Spinning...\n🍒 | 🍋 | 🍊");

  let a,b,c;

  // animation (fast → slow)
  for(let i=0;i<8;i++){
    a = spinRoll();
    b = spinRoll();
    c = spinRoll();

    await new Promise(r=>setTimeout(r, 200 + i*80));

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg.message_id,
      null,
      `🎰 Spinning...\n${a} | ${b} | ${c}`
    );
  }

  const win = calculateWin(a,b,c);
  user.coins += win;
  await user.save();

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    msg.message_id,
    null,
`🎉 Result: ${a} | ${b} | ${c}

💰 Won: ${win}
💵 Total Coins: ${user.coins}
🎟 Spins Left: ${user.spins}`
  );
});

// ===== DAILY =====
bot.hears('🎁 Daily', async (ctx)=>{
  const user = await getUser(ctx.from.id);

  const now = Date.now();

  if(user.last_daily && now - user.last_daily < 86400000){
    return ctx.reply("⏳ Already claimed today");
  }

  user.coins += 20;
  user.spins += 2;
  user.last_daily = now;

  await user.save();

  ctx.reply("🎁 Daily Bonus:\n+20 Coins\n+2 Spins");
});

// ===== BALANCE =====
bot.hears('💰 Balance', async (ctx)=>{
  const u = await getUser(ctx.from.id);
  ctx.reply(`💰 Coins: ${u.coins}\n🎟 Spins: ${u.spins}`);
});

// ===== REFERRAL =====
bot.hears('👥 Referral', async (ctx)=>{
  const me = await bot.telegram.getMe();
  const link = `https://t.me/${me.username}?start=${ctx.from.id}`;

  ctx.reply(
`👥 Invite friends:
${link}

🎁 Get +2 spins per join`
  );
});

// ===== LEADERBOARD =====
bot.hears('🏆 Leaderboard', async (ctx)=>{
  const top = await User.find().sort({ coins:-1 }).limit(5);

  let text = "🏆 Top Players\n\n";
  top.forEach((u,i)=>{
    text += `${i+1}. ${u.name} - ${u.coins}\n`;
  });

  ctx.reply(text);
});

// ===== WITHDRAW =====
bot.hears('💸 Withdraw', async (ctx)=>{
  const user = await getUser(ctx.from.id);

  if(user.coins < 500){
    return ctx.reply("❌ Minimum 500 coins required");
  }

  user.coins -= 500;
  await user.save();

  ctx.reply("✅ Withdraw request submitted (demo)");
});

// ===== WEBHOOK =====
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
bot.startWebhook('/webhook', null, PORT);

console.log("🚀 Bot Running...");
