// India Scratch & Win Bot – Stable Version with Reply Keyboard
require('dotenv').config();
const { Telegraf, session, Markup } = require('telegraf');
const mongoose = require('mongoose');

// Environment
const BOT_TOKEN = process.env.BOT_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = process.env.PORT || 8443;
const ADMIN_CHANNEL_ID = process.env.ADMIN_CHANNEL_ID;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', (err) => console.error('MongoDB connection error:', err));
db.once('open', () => {
  console.log('Connected to MongoDB');
  setupIndexes().catch(console.error);
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

const withdrawalSchema = new mongoose.Schema({
  user_id: Number,
  name: String,
  amount: Number,
  upi_id: String,
  status: { type: String, default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

// Prize list
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

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Database helpers with error handling
async function addPoints(userId, points, reason) {
  try {
    const user = await User.findOneAndUpdate(
      { user_id: userId },
      { $inc: { points: points } },
      { new: true }
    );
    await new Transaction({ user_id: userId, amount: points, type: 'scratch_win', details: reason }).save();
    return user;
  } catch (err) {
    console.error('addPoints error:', err);
    throw err;
  }
}

async function addCards(userId, cards, reason, relatedUserId = null) {
  try {
    const user = await User.findOneAndUpdate(
      { user_id: userId },
      { $inc: { cards: cards } },
      { new: true }
    );
    await new Transaction({ user_id: userId, amount: cards, type: reason, details: `${cards} cards added`, related_user: relatedUserId }).save();
    return user;
  } catch (err) {
    console.error('addCards error:', err);
    throw err;
  }
}

async function getUser(userId) {
  try {
    return await User.findOne({ user_id: userId });
  } catch (err) {
    console.error('getUser error:', err);
    return null;
  }
}

async function setupIndexes() {
  try {
    await User.syncIndexes();
    await Transaction.syncIndexes();
    await Withdrawal.syncIndexes();
    console.log('Indexes synced');
  } catch (err) {
    console.error('Index sync error:', err);
  }
}

// --------------------- Bot Setup ---------------------
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

let botUsername = '';
bot.telegram.getMe().then(info => { botUsername = info.username; }).catch(console.error);

// --------------------- Reply Keyboard (bottom menu) ---------------------
function getMainMenuKeyboard() {
  return Markup.keyboard([
    ['Scratch', 'Referral'],
    ['Balance', 'Leaderboard', 'Withdraw']
  ]).resize();
}

// --------------------- Start / Registration ---------------------
bot.start(async (ctx) => {
  try {
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
      await ctx.reply(
        `🎉 Welcome back, <b>${escapeHtml(user.name || ctx.from.first_name)}</b>!\nYou have ${user.cards} scratch cards.\nBalance: $${(user.points/100).toFixed(2)}`,
        { parse_mode: 'HTML', ...getMainMenuKeyboard() }
      );
    } else {
      user = new User({
        user_id: userId,
        name: ctx.from.first_name,
        cards: 1,
        points: 0,
        referred_by: ctx.session.referred_by || null
      });
      await user.save();

      if (user.referred_by) {
        await addCards(user.referred_by, 1, 'referral_bonus', userId);
        await User.updateOne({ user_id: user.referred_by }, { $inc: { referrals_count: 1 } });
        await ctx.telegram.sendMessage(user.referred_by, `🎁 You got 1 extra scratch card because <b>${escapeHtml(ctx.from.first_name)}</b> joined using your link!`, { parse_mode: 'HTML' });
      }

      await ctx.reply(
        `✨ Welcome, <b>${escapeHtml(ctx.from.first_name)}</b>! You have received <b>1 free scratch card</b>.\n\nUse the menu below to play!`,
        { parse_mode: 'HTML', ...getMainMenuKeyboard() }
      );
    }
  } catch (err) {
    console.error('Start error:', err);
    await ctx.reply('❌ Something went wrong. Please try again later.', getMainMenuKeyboard());
  }
});

// --------------------- Handle Keyboard Button Clicks ---------------------
bot.hears('Scratch', async (ctx) => {
  await ctx.telegram.sendMessage(ctx.chat.id, '/scratch').catch(console.error);
});
bot.hears('Referral', async (ctx) => {
  await ctx.telegram.sendMessage(ctx.chat.id, '/referral').catch(console.error);
});
bot.hears('Balance', async (ctx) => {
  await ctx.telegram.sendMessage(ctx.chat.id, '/balance').catch(console.error);
});
bot.hears('Leaderboard', async (ctx) => {
  await ctx.telegram.sendMessage(ctx.chat.id, '/leaderboard').catch(console.error);
});
bot.hears('Withdraw', async (ctx) => {
  await ctx.telegram.sendMessage(ctx.chat.id, '/withdraw').catch(console.error);
});

// --------------------- Scratch Card ---------------------
bot.command('scratch', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    if (!user) return ctx.reply('Please /start first.', getMainMenuKeyboard());
    if (user.cards <= 0) {
      return ctx.reply('You have no scratch cards left. Get more by referring friends (/referral) or buying cards with stars (/buy).', getMainMenuKeyboard());
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
  } catch (err) {
    console.error('Scratch command error:', err);
    await ctx.reply('❌ Error. Try again later.', getMainMenuKeyboard());
  }
});

bot.action(/scratch_\d+/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    if (!user) return ctx.answerCbQuery('Please /start first.');
    if (user.cards <= 0) {
      await ctx.answerCbQuery('No cards left!');
      await ctx.editMessageText('You have no scratch cards left. Get more via /referral or /buy.');
      return;
    }

    await User.updateOne({ user_id: userId }, { $inc: { cards: -1 } });
    const prize = getRandomPrize();
    const pointsEarned = Math.round(prize.value * 100);
    await addPoints(userId, pointsEarned, `Won ${prize.fruit}`);

    const scratchMsgId = ctx.session.scratchMsgId;
    if (scratchMsgId) {
      const resultText = `🍀 <b>You scratched a card and got:</b>\n${prize.fruit} – $${prize.value.toFixed(2)}\n\n<b>New balance:</b> $${((user.points + pointsEarned)/100).toFixed(2)}\n<b>Cards left:</b> ${user.cards-1}`;
      const afterScratchKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🎲 Play Again', 'play_again')],
        [Markup.button.callback('🏠 Main Menu', 'menu_show')]
      ]);
      await ctx.editMessageText(resultText, { parse_mode: 'HTML', ...afterScratchKeyboard });
      delete ctx.session.scratchMsgId;
    } else {
      await ctx.reply(`🍀 You scratched a card and got ${prize.fruit} – $${prize.value.toFixed(2)}\nBalance: $${((user.points + pointsEarned)/100).toFixed(2)}`, getMainMenuKeyboard());
    }
    await ctx.answerCbQuery();
  } catch (err) {
    console.error('Scratch action error:', err);
    await ctx.answerCbQuery('Error. Try again.');
  }
});

bot.action('play_again', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.telegram.sendMessage(ctx.chat.id, '/scratch').catch(console.error);
});
bot.action('menu_show', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.telegram.sendMessage(ctx.chat.id, '/menu').catch(console.error);
});

// --------------------- Referral ---------------------
bot.command('referral', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    if (!user) return ctx.reply('Please /start first.', getMainMenuKeyboard());

    const link = `https://t.me/${botUsername}?start=ref_${userId}`;
    const shareText = `🎁 Earn free scratch cards! Join India Scratch & Win using my link: ${link}`;
    const shareButton = Markup.inlineKeyboard([
      [Markup.button.url('📤 Share Referral Link', `https://t.me/share/url?url=${encodeURIComponent(shareText)}`)]
    ]);
    await ctx.reply(`<b>🔗 Your Referral Link</b>\n${link}\n\nClick the button below to share it with friends!\n\n<i>Each friend who joins gives you +1 scratch card!</i>`, { parse_mode: 'HTML', ...shareButton });
    await ctx.reply('Main Menu:', getMainMenuKeyboard());
  } catch (err) {
    console.error('Referral error:', err);
    await ctx.reply('❌ Error. Try again later.', getMainMenuKeyboard());
  }
});

// --------------------- Withdrawal ---------------------
bot.command('withdraw', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    if (!user) return ctx.reply('Please /start first.', getMainMenuKeyboard());

    const balance = user.points / 100;
    if (balance < 10) {
      return ctx.reply(`Minimum withdrawal is $10. Your current balance is $${balance.toFixed(2)}. Keep scratching!`, getMainMenuKeyboard());
    }

    ctx.session.withdrawState = 'awaiting_upi';
    await ctx.reply('Please enter your UPI ID (e.g., name@okhdfcbank):');
  } catch (err) {
    console.error('Withdraw error:', err);
    await ctx.reply('❌ Error. Try again later.', getMainMenuKeyboard());
  }
});

bot.on('text', async (ctx) => {
  if (ctx.session.withdrawState === 'awaiting_upi') {
    try {
      const userId = ctx.from.id;
      const user = await getUser(userId);
      if (!user) {
        ctx.session.withdrawState = null;
        return ctx.reply('Please /start first.', getMainMenuKeyboard());
      }

      const upi = ctx.message.text.trim();
      if (!upi.includes('@')) {
        await ctx.reply('Invalid UPI ID. Please enter a valid UPI ID (e.g., name@okhdfcbank).');
        return;
      }

      const amount = user.points / 100;
      if (amount < 10) {
        ctx.session.withdrawState = null;
        return ctx.reply(`Minimum withdrawal is $10. Your current balance is $${amount.toFixed(2)}.`, getMainMenuKeyboard());
      }

      // Deduct points
      await User.updateOne({ user_id: userId }, { $set: { points: 0 } });
      await new Transaction({ user_id: userId, amount: -amount, type: 'withdraw', details: `Withdrawal $${amount.toFixed(2)} to UPI ${upi}` }).save();

      const withdrawal = new Withdrawal({
        user_id: userId,
        name: user.name,
        amount,
        upi_id: upi
      });
      await withdrawal.save();

      if (ADMIN_CHANNEL_ID) {
        const msg = `<b>💰 Withdrawal Request</b>\n\n<b>User:</b> ${escapeHtml(user.name)} (ID: ${userId})\n<b>Amount:</b> $${amount.toFixed(2)}\n<b>UPI ID:</b> ${upi}\n<b>Time:</b> ${new Date().toLocaleString()}`;
        await ctx.telegram.sendMessage(ADMIN_CHANNEL_ID, msg, { parse_mode: 'HTML' });
      } else {
        console.log('ADMIN_CHANNEL_ID not set. Withdrawal request:', { user: user.name, amount, upi });
      }

      await ctx.reply(`✅ Withdrawal request of $${amount.toFixed(2)} submitted. Our team will process it soon. Your balance is now $0.`, getMainMenuKeyboard());
      ctx.session.withdrawState = null;
    } catch (err) {
      console.error('Withdrawal UPI error:', err);
      ctx.session.withdrawState = null;
      await ctx.reply('❌ Error processing withdrawal. Try again later.', getMainMenuKeyboard());
    }
  }
});

// --------------------- Buy Cards with Stars ---------------------
bot.command('buy', async (ctx) => {
  try {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('5 Cards – 100⭐', 'buy_5cards')]
    ]);
    await ctx.reply('<b>🎁 Buy scratch cards</b> – 5 cards for 100 stars.\nClick below to purchase:', { parse_mode: 'HTML', ...keyboard });
  } catch (err) {
    console.error('Buy error:', err);
    await ctx.reply('❌ Error. Try again later.', getMainMenuKeyboard());
  }
});

bot.action('buy_5cards', async (ctx) => {
  try {
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
  } catch (err) {
    console.error('Buy invoice error:', err);
    await ctx.answerCbQuery('Error generating invoice.');
  }
});

bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error('Pre-checkout error:', err);
  }
});

bot.on('successful_payment', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const payload = ctx.message.successful_payment.invoice_payload;
    if (payload === 'buy_5cards') {
      await addCards(userId, 5, 'purchase');
      await ctx.reply('✅ You purchased 5 scratch cards! Use /scratch to play.', getMainMenuKeyboard());
    }
  } catch (err) {
    console.error('Payment success error:', err);
    await ctx.reply('❌ Error adding cards. Contact support.', getMainMenuKeyboard());
  }
});

// --------------------- Balance & Leaderboard ---------------------
bot.command('balance', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const user = await getUser(userId);
    if (!user) return ctx.reply('Please /start first.', getMainMenuKeyboard());
    const text = `<b>💰 Your Stats</b>\nCards: ${user.cards}\nTotal earned: $${(user.points/100).toFixed(2)}\nInvites: ${user.referrals_count}`;
    await ctx.reply(text, { parse_mode: 'HTML', ...getMainMenuKeyboard() });
  } catch (err) {
    console.error('Balance error:', err);
    await ctx.reply('❌ Error. Try again later.', getMainMenuKeyboard());
  }
});

bot.command('leaderboard', async (ctx) => {
  try {
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
    await ctx.reply(`${earnersText}\n${refsText}`, { parse_mode: 'HTML', ...getMainMenuKeyboard() });
  } catch (err) {
    console.error('Leaderboard error:', err);
    await ctx.reply('❌ Error. Try again later.', getMainMenuKeyboard());
  }
});

// --------------------- Help ---------------------
bot.command('help', async (ctx) => {
  const text = `<b>🎮 Commands</b>\n/scratch – Scratch a card\n/buy – Buy more cards with Stars\n/referral – Invite friends & earn cards\n/withdraw – Request withdrawal (min $10)\n/balance – Your stats\n/leaderboard – Top players\n\n<b>How to win:</b> Each card gives a random fruit worth $0.25 to $2. Collect points and compete on the leaderboard!`;
  await ctx.reply(text, { parse_mode: 'HTML', ...getMainMenuKeyboard() });
});

// --------------------- Menu Command ---------------------
bot.command('menu', async (ctx) => {
  await ctx.reply('Main Menu:', getMainMenuKeyboard());
});

// --------------------- Health Check (prevents Render 403 on root) ---------------------
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`).then(() => console.log('Webhook set'));
bot.startWebhook('/webhook', null, PORT);
console.log(`Bot listening on port ${PORT}`);
