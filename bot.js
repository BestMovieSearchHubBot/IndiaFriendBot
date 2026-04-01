// India Scratch & Win Bot – Viral & Free-Tier Friendly (HTML version)
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
  cards: { type: Number, default: 1 },
  points: { type: Number, default: 0 },
  referrals_count: { type: Number, default: 0 },
  referred_by: { type: Number, default: null },
  created_at: { type: Date, default: Date.now }
});
userSchema.index({ user_id: 1 }, { unique: true });
userSchema.index({ referrals_count: -1 });
userSchema.index({ points: -1 });

const transactionSchema = new mongoose.Schema({
  user_id: Number,
  amount: Number,
  type: String,
  details: String,
  timestamp: { type: Date, default: Date.now }
});
transactionSchema.index({ timestamp: -1 });

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

function getRandomPrize() {
  const idx = Math.floor(Math.random() * prizes.length);
  return prizes[idx];
}

// Helper: escape HTML special characters
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
    }
  }

  let user = await getUser(userId);
  if (user) {
    await ctx.reply(`🎉 Welcome back, <b>${escapeHtml(user.name || ctx.from.first_name)}</b>!\nYou have ${user.cards} scratch cards.\nBalance: $${(user.points/100).toFixed(2)}`, { parse_mode: 'HTML' });
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
      await User.updateOne({ user_id: user.referred_by }, { $inc: { referrals_count: 1 } });
      await ctx.telegram.sendMessage(user.referred_by, `🎁 You got 1 extra scratch card because <b>${escapeHtml(ctx.from.first_name)}</b> joined using your link!`, { parse_mode: 'HTML' });
    }

    await ctx.reply(
      `✨ Welcome, <b>${escapeHtml(ctx.from.first_name)}</b>! You have received <b>1 free scratch card</b>.\n\n` +
      `Use /scratch to reveal your lucky fruit and win money!\n` +
      `Invite friends with /referral to get more cards.`,
      { parse_mode: 'HTML' }
    );
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

  const cardButtons = [];
  for (let i = 1; i <= 6; i++) {
    cardButtons.push(Markup.button.callback(`🎴 ${i}`, `scratch_${i}`));
  }
  const keyboard = Markup.inlineKeyboard([
    cardButtons.slice(0, 3),
    cardButtons.slice(3, 6)
  ]);
  const msg = await ctx.reply('👇 Choose a card to scratch!', keyboard);
  ctx.session.scratchMsgId = msg.message_id;
});

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
  const pointsEarned = Math.round(prize.value * 100);
  await addPoints(userId, pointsEarned, `Won ${prize.fruit}`);

  const scratchMsgId = ctx.session.scratchMsgId;
  if (scratchMsgId) {
    const resultText = `🍀 <b>You scratched a card and got:</b>\n${prize.fruit} – $${prize.value.toFixed(2)}\n\n<b>New balance:</b> $${((user.points + pointsEarned)/100).toFixed(2)}\n<b>Cards left:</b> ${user.cards-1}`;
    const playAgainKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎲 Play Again', 'play_again')]
    ]);
    await ctx.editMessageText(resultText, { parse_mode: 'HTML', ...playAgainKeyboard });
    delete ctx.session.scratchMsgId;
  } else {
    await ctx.reply(`🍀 You scratched a card and got ${prize.fruit} – $${prize.value.toFixed(2)}\nBalance: $${((user.points + pointsEarned)/100).toFixed(2)}`);
  }
  await ctx.answerCbQuery();
});

bot.action('play_again', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.telegram.sendMessage(ctx.chat.id, '/scratch');
});

// --------------------- Referral System (Fixed HTML) ---------------------
bot.command('referral', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Please /start first.');

  const link = `https://t.me/${botUsername}?start=ref_${userId}`;
  const topRefs = await User.find({}).sort({ referrals_count: -1 }).limit(5).lean();
  let leaderboard = '<b>🏆 Top Referrers</b>\n';
  for (let i = 0; i < topRefs.length; i++) {
    leaderboard += `${i+1}. ${escapeHtml(topRefs[i].name)} – ${topRefs[i].referrals_count} invites\n`;
  }
  const text = `<b>🔗 Your Referral Link</b>\n${link}\n\n<b>📊 Stats</b>\nInvites: ${user.referrals_count}\n\n${leaderboard}\n\n<b>How it works:</b>\n- Each friend who joins gives you <b>+1 scratch card</b>.\n- Top referrers get featured here!`;
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// --------------------- Buy Cards with Stars ---------------------
bot.command('buy', async (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('5 Cards – 100⭐', 'buy_5cards')]
  ]);
  await ctx.reply('<b>🎁 Buy scratch cards</b> – 5 cards for 100 stars.\nClick below to purchase:', { parse_mode: 'HTML', ...keyboard });
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

// --------------------- Balance & Leaderboard (HTML) ---------------------
bot.command('balance', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Please /start first.');
  const text = `<b>💰 Your Stats</b>\nCards: ${user.cards}\nTotal earned: $${(user.points/100).toFixed(2)}\nInvites: ${user.referrals_count}`;
  await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('leaderboard', async (ctx) => {
  const topEarners = await User.find({}).sort({ points: -1 }).limit(5).lean();
  let earnersText = '<b>🏆 Top Earners</b>\n';
  for (let i = 0; i < topEarners.length; i++) {
    earnersText += `${i+1}. ${escapeHtml(topEarners[i].name)} – $${(topEarners[i].points/100).toFixed(2)}\n`;
  }
  const topRefs = await User.find({}).sort({ referrals_count: -1 }).limit(5).lean();
  let refsText = '<b>🏆 Top Referrers</b>\n';
  for (let i = 0; i < topRefs.length; i++) {
    refsText += `${i+1}. ${escapeHtml(topRefs[i].name)} – ${topRefs[i].referrals_count} invites\n`;
  }
  await ctx.reply(`${earnersText}\n${refsText}`, { parse_mode: 'HTML' });
});

// --------------------- Help ---------------------
bot.command('help', async (ctx) => {
  const text = `<b>🎮 Commands</b>\n/start – Register & get your first card\n/scratch – Scratch a card\n/buy – Buy more cards with Stars\n/referral – Invite friends & earn cards\n/balance – Your stats\n/leaderboard – Top players\n\n<b>How to win:</b> Each card gives a random fruit worth $0.25 to $2. Collect points and compete on the leaderboard!`;
  await ctx.reply(text, { parse_mode: 'HTML' });
});

// --------------------- Webhook ---------------------
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`).then(() => console.log('Webhook set'));
bot.startWebhook('/webhook', null, PORT);
console.log(`Bot listening on port ${PORT}`);
