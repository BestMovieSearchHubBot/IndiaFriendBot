// India Scratch & Win Bot – Viral & Free-Tier Friendly
require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const mongoose = require('mongoose');

// Environment
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 8443;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
  setupIndexes();
});

// --------------------- Schemas ---------------------
const userSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true, required: true },
  name: { type: String, default: '' },
  cards: { type: Number, default: 1 },          // free scratch cards
  points: { type: Number, default: 0 },         // total earned (in dollars * 100 or just integer)
  referrals_count: { type: Number, default: 0 },
  referred_by: { type: Number, default: null },
  last_scratch_date: Date,                       // for daily bonus later
  created_at: { type: Date, default: Date.now }
});
userSchema.index({ user_id: 1 }, { unique: true });
userSchema.index({ referrals_count: -1 });      // for leaderboard
userSchema.index({ points: -1 });               // for earning leaderboard

const transactionSchema = new mongoose.Schema({
  user_id: Number,
  amount: Number,        // positive = added, negative = spent (stars)
  type: String,          // 'purchase', 'referral_bonus', 'scratch_win'
  details: String,
  timestamp: { type: Date, default: Date.now }
});
transactionSchema.index({ timestamp: -1 });      // auto cleanup later

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// Prize list (fruit, value in dollars)
const prizes = [
  { fruit: '🍓 Strawberry', value: 0.50 },
  { fruit: '🍊 Orange', value: 0.75 },
  { fruit: '🍎 Apple', value: 1.00 },
  { fruit: '🍉 Watermelon', value: 1.50 },
  { fruit: '🥝 Kiwi', value: 2.00 },
  { fruit: '🍒 Cherry', value: 0.25 },
  { fruit: '🍑 Peach', value: 1.25 },
  { fruit: '🍍 Pineapple', value: 1.75 }
];

// Helper: random prize
function getRandomPrize() {
  const idx = Math.floor(Math.random() * prizes.length);
  return prizes[idx];
}

// Helper: update user & record transaction
async function addPoints(userId, points, reason) {
  const user = await User.findOneAndUpdate(
    { user_id: userId },
    { $inc: { points: points } },
    { new: true }
  );
  await new Transaction({ user_id: userId, amount: points, type: 'scratch_win', details: reason }).save();
  return user;
}

async function addCards(userId, cards, reason, relatedUserId = null) {
  const user = await User.findOneAndUpdate(
    { user_id: userId },
    { $inc: { cards: cards } },
    { new: true }
  );
  await new Transaction({ user_id: userId, amount: cards, type: reason, details: `${cards} cards added`, related_user: relatedUserId }).save();
  return user;
}

async function getUser(userId) {
  return await User.findOne({ user_id: userId });
}

async function updateUser(userId, data) {
  return await User.findOneAndUpdate({ user_id: userId }, data, { upsert: true, new: true });
}

async function setupIndexes() {
  await User.syncIndexes();
  await Transaction.syncIndexes();
  console.log('Indexes synced');
}

// --------------------- Bot Setup ---------------------
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

let botUsername = '';
bot.telegram.getMe().then(info => { botUsername = info.username; });

// --------------------- Start / Registration ---------------------
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');
  let referrerId = null;
  if (args.length > 1 && args[1].startsWith('ref_')) {
    referrerId = parseInt(args[1].slice(4));
    if (!isNaN(referrerId) && referrerId !== userId) {
      ctx.session.referred_by = referrerId;
      const referrer = await getUser(referrerId);
      if (referrer) {
        await ctx.telegram.sendMessage(referrerId, `🔔 ${ctx.from.first_name} used your referral link!`);
      }
    }
  }

  let user = await getUser(userId);
  if (user) {
    await ctx.reply(`🎉 Welcome back, ${user.name || ctx.from.first_name}!\nYou have ${user.cards} scratch cards.\nBalance: $${(user.points/100).toFixed(2)}`);
  } else {
    // Create new user with 1 free card
    user = new User({
      user_id: userId,
      name: ctx.from.first_name,
      cards: 1,
      points: 0,
      referred_by: ctx.session.referred_by || null
    });
    await user.save();

    // Reward referrer with 1 card
    if (user.referred_by) {
      await addCards(user.referred_by, 1, 'referral_bonus', userId);
      await ctx.telegram.sendMessage(user.referred_by, `🎁 You got 1 extra scratch card because ${ctx.from.first_name} joined using your link!`);
    }

    await ctx.reply(`✨ Welcome, ${ctx.from.first_name}! You have received **1 free scratch card**.\n\nUse /scratch to reveal your lucky fruit and win money!\nInvite friends with /referral to get more cards.`);
  }
});

// --------------------- Scratch Card ---------------------
bot.command('scratch', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Please /start first.');

  if (user.cards <= 0) {
    return ctx.reply('You have no scratch cards left. Get more by referring friends (/referral) or buying cards with stars (/buy).');
  }

  // Show 6 card buttons
  const cardButtons = [];
  for (let i = 1; i <= 6; i++) {
    cardButtons.push(Markup.button.callback(`🎴 ${i}`, `scratch_${i}`));
  }
  const keyboard = Markup.inlineKeyboard([
    cardButtons.slice(0,3),
    cardButtons.slice(3,6)
  ]);
  const msg = await ctx.reply('👇 Choose a card to scratch!', keyboard);
  ctx.session.scratchMsgId = msg.message_id;
});

// Scratch action handler
bot.action(/scratch_\d+/, async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.answerCbQuery('Please /start first.');

  if (user.cards <= 0) {
    await ctx.answerCbQuery('No cards left!');
    await ctx.editMessageText('You have no scratch cards left. Get more via /referral or /buy.');
    return;
  }

  // Deduct one card
  await User.updateOne({ user_id: userId }, { $inc: { cards: -1 } });
  const prize = getRandomPrize();
  const pointsEarned = Math.round(prize.value * 100); // store as cents
  await addPoints(userId, pointsEarned, `Won ${prize.fruit}`);

  // Delete the original scratch message
  if (ctx.session.scratchMsgId) {
    await ctx.deleteMessage(ctx.session.scratchMsgId).catch(() => {});
  }

  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(`🍀 *You scratched a card and got:*\n${prize.fruit} – $${prize.value.toFixed(2)}\n\nNew balance: $${((user.points + pointsEarned)/100).toFixed(2)}\nYou have ${user.cards-1} cards left.`);
});

// --------------------- Referral System ---------------------
bot.command('referral', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Please /start first.');

  const link = `https://t.me/${botUsername}?start=ref_${userId}`;
  const topRefs = await User.find({}).sort({ referrals_count: -1 }).limit(5).lean();
  let leaderboard = '🏆 *Top Referrers*\n';
  for (let i = 0; i < topRefs.length; i++) {
    leaderboard += `${i+1}. ${topRefs[i].name} – ${topRefs[i].referrals_count} invites\n`;
  }
  const text = `🔗 *Your Referral Link*\n${link}\n\n📊 *Stats*\nInvites: ${user.referrals_count}\n\n${leaderboard}\n\n*How it works:*\n- Each friend who joins gives you **+1 scratch card**.\n- Top referrers get featured here!`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// --------------------- Buy Cards with Stars ---------------------
bot.command('buy', async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('5 Cards – 100⭐', 'buy_5cards')]
  ]);
  await ctx.reply('🎁 *Buy scratch cards* – 5 cards for 100 stars.\nClick below to purchase:', { parse_mode: 'Markdown', ...keyboard });
});

bot.action('buy_5cards', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.replyWithInvoice({
    title: '5 Scratch Cards',
    description: 'Get 5 extra scratch cards to win more money!',
    payload: 'buy_5cards',
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: '5 Cards', amount: 100 }],
    start_parameter: 'buy_scratch'
  });
});

bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

bot.on('successful_payment', async (ctx) => {
  const userId = ctx.from.id;
  const payload = ctx.message.successful_payment.invoice_payload;
  if (payload === 'buy_5cards') {
    await addCards(userId, 5, 'purchase');
    await ctx.reply('✅ You purchased 5 scratch cards! Use /scratch to play.');
  }
});

// --------------------- Balance & Stats ---------------------
bot.command('balance', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Please /start first.');
  const text = `💰 *Your Stats*\nCards: ${user.cards}\nTotal earned: $${(user.points/100).toFixed(2)}\nInvites: ${user.referrals_count}`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('leaderboard', async (ctx) => {
  const topEarners = await User.find({}).sort({ points: -1 }).limit(5).lean();
  let earnersText = '🏆 *Top Earners*\n';
  for (let i = 0; i < topEarners.length; i++) {
    earnersText += `${i+1}. ${topEarners[i].name} – $${(topEarners[i].points/100).toFixed(2)}\n`;
  }
  const topRefs = await User.find({}).sort({ referrals_count: -1 }).limit(5).lean();
  let refsText = '🏆 *Top Referrers*\n';
  for (let i = 0; i < topRefs.length; i++) {
    refsText += `${i+1}. ${topRefs[i].name} – ${topRefs[i].referrals_count} invites\n`;
  }
  await ctx.reply(`${earnersText}\n${refsText}`, { parse_mode: 'Markdown' });
});

// --------------------- Help ---------------------
bot.command('help', async (ctx) => {
  const text = `🎮 *Commands*\n/start – Register & get your first card\n/scratch – Scratch a card\n/buy – Buy more cards with Stars\n/referral – Invite friends & earn cards\n/balance – Your stats\n/leaderboard – Top players\n\n*How to win:* Each card gives a random fruit worth $0.25 to $2. Collect points and compete on the leaderboard!`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// --------------------- Message Handler (ignore non‑commands) ---------------------
bot.on('text', async (ctx) => {
  if (!ctx.message.text.startsWith('/')) return;
  // commands already handled
});

// --------------------- Webhook ---------------------
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`).then(() => console.log('Webhook set'));
bot.startWebhook('/webhook', null, PORT);
console.log(`Bot listening on port ${PORT}`);
