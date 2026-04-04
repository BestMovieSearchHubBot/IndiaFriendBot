require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'));

// User Schema
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, unique: true, required: true },
  username: { type: String, default: '' },
  coins: { type: Number, default: 1030.00 },
  referralCode: { type: String, unique: true },
  referredBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  next();
});
const User = mongoose.model('User', UserSchema);

// Redeem Schema
const RedeemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['amazon', 'googleplay', 'freediamond'] },
  amount: Number,
  email: String,
  uid: String,
  status: { type: String, default: 'pending' }
});
const Redeem = mongoose.model('Redeem', RedeemSchema);

// ---------- Telegram Bot ----------
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const WEBAPP_URL = process.env.WEBAPP_URL;

// Only /start command – sends single WebApp button
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const refCode = match[1] || null;
  const telegramId = msg.from.id.toString();
  const name = msg.from.first_name || 'Player';

  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId, username: name });
    await user.save();
    if (refCode) {
      const referrer = await User.findOne({ referralCode: refCode });
      if (referrer && referrer.telegramId !== telegramId) {
        referrer.coins += 10;
        await referrer.save();
        user.coins += 10;
        user.referredBy = referrer.telegramId;
        await user.save();
      }
    }
  }

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎰 PLAY LUCKY GEMS', web_app: { url: `${WEBAPP_URL}?startapp=${user.referralCode}` } }]
      ]
    }
  };
  bot.sendMessage(chatId, 
    `✨ *${name}*, welcome to Lucky Gems!\n💰 Coins: ${user.coins.toFixed(2)}\n🔗 Your referral code: \`${user.referralCode}\`\n\nShare this code with friends – you both get 10 coins!`,
    { parse_mode: 'Markdown', ...opts }
  );
});

// ---------- API Routes ----------
app.post('/api/auth', async (req, res) => {
  const { telegramId, referCode } = req.body;
  if (!telegramId) return res.status(400).json({ error: 'Telegram ID required' });
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId, username: 'Player' });
    await user.save();
    if (referCode) {
      const referrer = await User.findOne({ referralCode: referCode });
      if (referrer && referrer.telegramId !== telegramId) {
        referrer.coins += 10;
        await referrer.save();
        user.coins += 10;
        user.referredBy = referrer.telegramId;
        await user.save();
      }
    }
  }
  res.json({ userId: user._id, telegramId: user.telegramId, coins: user.coins, referralCode: user.referralCode });
});

app.get('/api/user/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username, coins: user.coins, referralCode: user.referralCode });
});

const gemsList = [
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/red.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/blue.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/green.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/yellow.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/purple.png"
];

function getRandomGem() { return gemsList[Math.floor(Math.random() * gemsList.length)]; }

function generateRandomMatrix() {
  const matrix = [];
  for (let i = 0; i < 3; i++) {
    matrix[i] = [];
    for (let j = 0; j < 3; j++) matrix[i][j] = getRandomGem();
  }
  return matrix;
}

function calculateWin(matrix) {
  let totalWin = 0;
  for (let row = 0; row < 3; row++) {
    const a = matrix[row][0], b = matrix[row][1], c = matrix[row][2];
    if (a === b && b === c) totalWin += 5;
    else if (a === b || b === c || a === c) totalWin += 0.5;
  }
  return totalWin;
}

app.post('/api/spin', async (req, res) => {
  const { userId } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.coins < 1) return res.status(400).json({ error: 'Insufficient coins' });

  user.coins -= 1;
  await user.save();

  const matrix = generateRandomMatrix();
  const winAmount = calculateWin(matrix);
  let newCoins = user.coins;
  if (winAmount > 0) {
    newCoins = user.coins + winAmount;
    user.coins = newCoins;
    await user.save();
  }
  res.json({ matrix, win: winAmount, newCoins });
});

app.get('/api/referral/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ referralCode: user.referralCode });
});

app.post('/api/redeem', async (req, res) => {
  const { userId, type, email, uid } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let requiredCoins = 0;
  if (type === 'amazon' || type === 'googleplay') {
    requiredCoins = 500;
    if (!email) return res.status(400).json({ error: 'Email required' });
  } else if (type === 'freediamond') {
    requiredCoins = 420;
    if (!uid) return res.status(400).json({ error: 'UID required' });
  } else return res.status(400).json({ error: 'Invalid type' });

  if (user.coins < requiredCoins) return res.status(400).json({ error: `Need ${requiredCoins} coins` });

  user.coins -= requiredCoins;
  await user.save();

  const redeem = new Redeem({ userId: user._id, type, amount: requiredCoins, email, uid });
  await redeem.save();
  res.json({ success: true, newCoins: user.coins });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
