require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
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

// Redemption Schema
const RedeemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['amazon', 'googleplay', 'freediamond'] },
  amount: Number,
  email: String,        // for vouchers
  uid: String,          // for Free Fire
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const Redeem = mongoose.model('Redeem', RedeemSchema);

// ---------- API Routes ----------

// Register or login (simple username)
app.post('/api/auth', async (req, res) => {
  const { username, referCode } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  let user = await User.findOne({ username });
  if (!user) {
    user = new User({ username });
    await user.save();
    // Handle referral bonus
    if (referCode) {
      const referrer = await User.findOne({ referralCode: referCode });
      if (referrer && referrer.username !== username) {
        // Give 10 coins to both
        referrer.coins += 10;
        await referrer.save();
        user.coins += 10;
        user.referredBy = referrer.username;
        await user.save();
      }
    }
  }
  res.json({ userId: user._id, username: user.username, coins: user.coins, referralCode: user.referralCode });
});

// Get user data
app.get('/api/user/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ username: user.username, coins: user.coins, referralCode: user.referralCode });
});

// Spin logic (bet 1 coin, 3 reels, 3 rows, paytable)
const gemsList = [
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/red.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/blue.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/green.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/yellow.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/purple.png"
];

function getRandomGem() {
  return gemsList[Math.floor(Math.random() * gemsList.length)];
}

// Generate a random 3x3 matrix (each cell a gem URL)
function generateRandomMatrix() {
  const matrix = [];
  for (let i = 0; i < 3; i++) {
    matrix[i] = [];
    for (let j = 0; j < 3; j++) {
      matrix[i][j] = getRandomGem();
    }
  }
  return matrix;
}

// Calculate win amount for a given matrix (bet = 1 coin)
function calculateWin(matrix) {
  let totalWin = 0;
  for (let row = 0; row < 3; row++) {
    const a = matrix[row][0];
    const b = matrix[row][1];
    const c = matrix[row][2];
    if (a === b && b === c) {
      totalWin += 5;      // 5x bet
    } else if (a === b || b === c || a === c) {
      totalWin += 0.5;    // 0.5x bet
    }
  }
  return totalWin;
}

app.post('/api/spin', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.coins < 1) return res.status(400).json({ error: 'Insufficient coins' });

  // Deduct bet
  user.coins -= 1;
  await user.save();

  // Generate random result
  const matrix = generateRandomMatrix();
  const winAmount = calculateWin(matrix);
  let newCoins = user.coins;
  if (winAmount > 0) {
    newCoins = user.coins + winAmount;
    user.coins = newCoins;
    await user.save();
  }

  res.json({
    matrix: matrix,
    win: winAmount,
    newCoins: newCoins
  });
});

// Referral code info
app.get('/api/referral/:userId', async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ referralCode: user.referralCode });
});

// Redeem request
app.post('/api/redeem', async (req, res) => {
  const { userId, type, email, uid } = req.body;
  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  let requiredCoins = 0;
  if (type === 'amazon' || type === 'googleplay') {
    requiredCoins = 500;
    if (!email) return res.status(400).json({ error: 'Email required for voucher' });
  } else if (type === 'freediamond') {
    requiredCoins = 420;
    if (!uid) return res.status(400).json({ error: 'UID required for Free Fire' });
  } else {
    return res.status(400).json({ error: 'Invalid redeem type' });
  }

  if (user.coins < requiredCoins) {
    return res.status(400).json({ error: `Need ${requiredCoins} coins` });
  }

  // Deduct coins
  user.coins -= requiredCoins;
  await user.save();

  const redeem = new Redeem({
    userId: user._id,
    type,
    amount: requiredCoins,
    email: email || null,
    uid: uid || null
  });
  await redeem.save();

  res.json({ success: true, newCoins: user.coins, message: 'Redemption request submitted' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
