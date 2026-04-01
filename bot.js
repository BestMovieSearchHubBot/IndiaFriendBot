// India Friend – Viral Dating Bot (Optimised for Free Tier)
// Features: referral leaderboard, daily streak, free boost, profile sharing, message expiry

require('dotenv').config();
const { Telegraf, session, Scenes, Markup } = require('telegraf');
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
  createVirtualUsers();
  // Set up indexes for performance
  setupIndexes();
  // Clean old messages every day (run once at startup)
  cleanOldMessages();
  // Run message cleanup every 24h
  setInterval(cleanOldMessages, 24 * 60 * 60 * 1000);
});

// --------------------- Schemas (with indexes) ---------------------
const userSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true, required: true },
  name: String,
  age: Number,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  language: { type: String, default: 'english' },
  photo_file_id: String,
  active_match: { type: Number, default: null },
  free_messages_left: { type: Number, default: 2 },
  star_balance: { type: Number, default: 0 },
  referred_by: { type: Number, default: null },
  referrals_count: { type: Number, default: 0 },
  daily_free_last_given: Date,
  streak_days: { type: Number, default: 0 },
  last_active: Date,
  boost_until: Date,
  created_at: { type: Date, default: Date.now },
  is_virtual: { type: Boolean, default: false }
});
userSchema.index({ user_id: 1 }, { unique: true });
userSchema.index({ gender: 1, active_match: 1, is_virtual: 1 });
userSchema.index({ gender: 1, active_match: 1, is_virtual: 1, language: 1 });
userSchema.index({ referrals_count: -1 }); // for leaderboard

const messageSchema = new mongoose.Schema({
  from_id: Number,
  to_id: Number,
  text: String,
  timestamp: { type: Date, default: Date.now, expires: 2592000 } // auto-delete after 30 days
});
// expires field = TTL index (MongoDB auto-deletes)

const transactionSchema = new mongoose.Schema({
  user_id: Number,
  amount: Number,
  type: String,
  related_user: Number,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// Helper functions
async function getUser(userId) { return await User.findOne({ user_id: userId }); }
async function updateUser(userId, data) { return await User.findOneAndUpdate({ user_id: userId }, data, { upsert: true, new: true }); }
async function incrementUser(userId, field, amount = 1) { return await User.findOneAndUpdate({ user_id: userId }, { $inc: { [field]: amount } }, { new: true }); }
async function recordTransaction(userId, amount, type, relatedUserId = null) {
  const tx = new Transaction({ user_id: userId, amount, type, related_user: relatedUserId });
  await tx.save();
}

// --------------------- Setup Indexes ---------------------
async function setupIndexes() {
  // Ensure indexes exist (Mongoose creates them at startup if autoIndex is true, but we'll ensure)
  await User.syncIndexes();
  await Message.syncIndexes();
  console.log('Indexes synced');
}

// --------------------- Message Cleanup (TTL already handles, but we also do a manual purge to be safe) ---------------------
async function cleanOldMessages() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const result = await Message.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });
  if (result.deletedCount > 0) console.log(`Deleted ${result.deletedCount} old messages`);
}

// --------------------- Language Definitions (same as before) ---------------------
const languages = [
  { code: 'hindi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'english', name: 'English', flag: '🇬🇧' },
  { code: 'tamil', name: 'தமிழ்', flag: '🇮🇳' },
  { code: 'telugu', name: 'తెలుగు', flag: '🇮🇳' },
  { code: 'bengali', name: 'বাংলা', flag: '🇮🇳' },
  { code: 'marathi', name: 'मराठी', flag: '🇮🇳' }
];

// --------------------- Reply Generator for Virtual Users (Language Specific) ---------------------
const replies = {
  hindi: {
    greetings: ['नमस्ते! कैसे हो? 😊', 'हैलो! क्या हाल हैं?', 'हाय! सब ठीक?'],
    how_are_you: ['मैं बढ़िया हूँ, तुम बताओ?', 'बहुत अच्छा! तुम कैसे हो?'],
    name: (name) => `मेरा नाम ${name} है! आपका क्या है?`,
    age: (age) => `मैं ${age} साल का हूँ।`,
    like_hobby: ['मुझे घूमना और नई चीज़ें सीखना पसंद है! तुम्हें क्या पसंद है?', 'मुझे किताबें पढ़ना बहुत पसंद है। तुम्हारा शौक क्या है?'],
    bye: ['अच्छा, फिर मिलेंगे! 👋', 'खुश रहो! फिर बात करेंगे।'],
    photo: ['सॉरी, यहाँ फोटो नहीं भेज सकते। कभी मिलें तो दिखा दूंगी 😊'],
    default: ['अच्छा, और बताओ?', 'वाह! मुझे और बताओ।', 'हाँ, यह तो बहुत अच्छा है!', 'मैं सुन रहा हूँ...']
  },
  english: {
    greetings: ['Hi there! How are you? 😊', 'Hello! How\'s it going?', 'Hey! What\'s up?'],
    how_are_you: ['I\'m doing great, thanks for asking! What about you?', 'I\'m good! How are you?'],
    name: (name) => `My name is ${name}! What's yours?`,
    age: (age) => `I'm ${age} years old.`,
    like_hobby: ['I love traveling and trying new foods! What about you?', 'I enjoy reading books. What\'s your hobby?'],
    bye: ['It was nice talking to you! Catch you later. 👋', 'Take care! Talk soon.'],
    photo: ['Sorry, I can\'t share photos here. Maybe someday we can meet!'],
    default: ['That sounds interesting! Tell me more.', 'Oh really? That’s cool!', 'I see. What else do you enjoy doing?', 'Hmm, I’d love to hear more about that.', 'That’s awesome! 😄', 'Nice! What else?']
  },
  tamil: {
    greetings: ['வணக்கம்! எப்படி இருக்கீங்க? 😊', 'ஹாய்! எப்படி இருக்க?', 'ஹலோ! எப்படி?'],
    how_are_you: ['நான் நல்லா இருக்கேன், நீங்க எப்படி?', 'நான் நல்லா இருக்கேன்! நீங்க?'],
    name: (name) => `என் பெயர் ${name}! உங்க பெயர் என்ன?`,
    age: (age) => `எனக்கு ${age} வயது.`,
    like_hobby: ['எனக்கு பயணம் செய்வதும், புது உணவுகள் சாப்பிடுவதும் பிடிக்கும்! உங்களுக்கு?', 'எனக்கு புத்தகம் படிக்க பிடிக்கும். உங்களுக்கு என்ன பிடிக்கும்?'],
    bye: ['உங்களுடன் பேசியது மகிழ்ச்சி! பிறகு பார்க்கலாம். 👋', 'நன்றி! மீண்டும் பேசலாம்.'],
    photo: ['மன்னிக்கவும், இங்கே புகைப்படம் அனுப்ப முடியாது. எப்போதாவது சந்திக்கும் போது காட்டுகிறேன் 😊'],
    default: ['அப்படியா? சொல்லுங்கள்...', 'அருமை! மேலும் சொல்லுங்கள்.', 'ஆஹா! அது நல்ல விஷயம்.', 'உங்கள் கருத்து சுவாரஸ்யமாக உள்ளது.']
  },
  telugu: {
    greetings: ['నమస్కారం! ఎలా ఉన్నారు? 😊', 'హాయ్! ఎలా ఉన్నారు?', 'హలో! ఎలా ఉన్నారు?'],
    how_are_you: ['నేను చాలా బాగున్నాను, మీరు ఎలా ఉన్నారు?', 'నేను బాగున్నాను! మీరు?'],
    name: (name) => `నా పేరు ${name}! మీ పేరు ఏమిటి?`,
    age: (age) => `నాకు ${age} సంవత్సరాలు.`,
    like_hobby: ['నాకు ప్రయాణం మరియు కొత్త వంటకాలు ప్రయత్నించడం ఇష్టం! మీకు?', 'నాకు పుస్తకాలు చదవడం ఇష్టం. మీకు ఇష్టమైన అభిరుచి ఏమిటి?'],
    bye: ['మీతో మాట్లాడటం ఆనందంగా ఉంది! మళ్ళీ కలుద్దాం. 👋', 'జాగ్రత్త! త్వరలో మాట్లాడుకుందాం.'],
    photo: ['క్షమించండి, ఇక్కడ ఫోటోలు పంపలేను. ఎప్పుడైనా కలిసినప్పుడు చూపిస్తాను 😊'],
    default: ['ఆసక్తికరంగా ఉంది! ఇంకా చెప్పండి.', 'నిజంగా? అది బాగుంది!', 'నేను వింటున్నాను...', 'అద్భుతం! ఇంకా చెప్పండి.']
  },
  bengali: {
    greetings: ['নমস্কার! কেমন আছেন? 😊', 'হ্যালো! কেমন আছ?', 'ওহে! কেমন চলছে?'],
    how_are_you: ['আমি ভালো আছি, আপনি কেমন?', 'আমি ভালো আছি! আপনি?'],
    name: (name) => `আমার নাম ${name}! আপনার নাম কি?`,
    age: (age) => `আমার বয়স ${age} বছর।`,
    like_hobby: ['আমি ভ্রমণ এবং নতুন খাবার খেতে ভালোবাসি! আপনি?', 'আমি বই পড়তে ভালোবাসি। আপনার শখ কি?'],
    bye: ['আপনার সাথে কথা বলে ভালো লাগলো! আবার দেখা হবে। 👋', 'সাবধানে থাকুন! শীঘ্রই কথা হবে।'],
    photo: ['দুঃখিত, এখানে ফটো পাঠাতে পারবো না। কোনো দিন দেখা হলে দেখাবো 😊'],
    default: ['মজার কথা! আরও বলুন।', 'ওহ! সত্যি?', 'আমি শুনছি...', 'দারুণ! তারপর?']
  },
  marathi: {
    greetings: ['नमस्कार! कसे आहात? 😊', 'हाय! काय चाललंय?', 'हॅलो! कसं आहे?'],
    how_are_you: ['मी ठीक आहे, तुम्ही सांगा?', 'मी छान आहे! तुम्ही?'],
    name: (name) => `माझं नाव ${name} आहे! तुमचं नाव काय?`,
    age: (age) => `मी ${age} वर्षांचा/ची आहे.`,
    like_hobby: ['मला प्रवास करायला आवडतो आणि नवीन पदार्थ खायला आवडतात! तुम्हाला?', 'मला पुस्तकं वाचायला आवडतात. तुमचा छंद काय?'],
    bye: ['तुमच्याशी बोलून आनंद झाला! पुन्हा भेटू. 👋', 'काळजी घ्या! लवकरच बोलू.'],
    photo: ['माफ करा, इथे फोटो पाठवता येत नाही. कधी भेटलो तर दाखवेन 😊'],
    default: ['छान! आणखी सांगा.', 'अरे वा! मस्त.', 'मी ऐकतोय...', 'खरंच? मला आवडलं.']
  }
};

function getRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateReply(messageText, virtualUser, userLanguage) {
  const lowerMsg = messageText.toLowerCase();
  const lang = userLanguage || 'english';
  const dict = replies[lang] || replies.english;
  // detection logic (same as before)
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey') ||
      lowerMsg.includes('नमस्ते') || lowerMsg.includes('வணக்கம்') || lowerMsg.includes('నమస్కారం') ||
      lowerMsg.includes('নমস্কার') || lowerMsg.includes('नमस्कार')) return getRandom(dict.greetings);
  if (lowerMsg.includes('how are you') || lowerMsg.includes('कैसे हो') || lowerMsg.includes('எப்படி இருக்கீங்க') ||
      lowerMsg.includes('ఎలా ఉన్నారు') || lowerMsg.includes('কেমন আছেন') || lowerMsg.includes('कसे आहात')) return getRandom(dict.how_are_you);
  if (lowerMsg.includes('name') || lowerMsg.includes('नाम') || lowerMsg.includes('பெயர்') ||
      lowerMsg.includes('పేరు') || lowerMsg.includes('নাম') || lowerMsg.includes('नाव')) return dict.name(virtualUser.name);
  if (lowerMsg.includes('age') || lowerMsg.includes('उम्र') || lowerMsg.includes('வயது') ||
      lowerMsg.includes('వయస్సు') || lowerMsg.includes('বয়স') || lowerMsg.includes('वय')) return dict.age(virtualUser.age);
  if (lowerMsg.includes('like') || lowerMsg.includes('hobby') || lowerMsg.includes('पसंद') ||
      lowerMsg.includes('ஆர்வம்') || lowerMsg.includes('ఇష్టం') || lowerMsg.includes('শখ') ||
      lowerMsg.includes('आवड')) return getRandom(dict.like_hobby);
  if (lowerMsg.includes('bye') || lowerMsg.includes('goodbye') || lowerMsg.includes('अलविदा') ||
      lowerMsg.includes('பிரியாவிடை') || lowerMsg.includes('వీడ్కోలు') || lowerMsg.includes('বিদায়') ||
      lowerMsg.includes('बाय')) return getRandom(dict.bye);
  if (lowerMsg.includes('photo') || lowerMsg.includes('pic') || lowerMsg.includes('फोटो') ||
      lowerMsg.includes('புகைப்படம்') || lowerMsg.includes('చిత్రం') || lowerMsg.includes('ছবি') ||
      lowerMsg.includes('फोटो')) return dict.photo;
  return getRandom(dict.default);
}

// --------------------- Virtual Users Creation ---------------------
async function createVirtualUsers() {
  const virtualCount = await User.countDocuments({ is_virtual: true });
  if (virtualCount === 0) {
    const virtuals = [
      { name: 'Priya', age: 24, gender: 'female', language: 'hindi', photo_file_id: 'PLACEHOLDER_PRIYA' },
      { name: 'Anjali', age: 28, gender: 'female', language: 'english', photo_file_id: 'PLACEHOLDER_ANJALI' },
      { name: 'Rahul', age: 26, gender: 'male', language: 'hindi', photo_file_id: 'PLACEHOLDER_RAHUL' },
      { name: 'Vikram', age: 30, gender: 'male', language: 'english', photo_file_id: 'PLACEHOLDER_VIKRAM' },
      { name: 'Neha', age: 22, gender: 'female', language: 'tamil', photo_file_id: 'PLACEHOLDER_NEHA' },
      { name: 'Arjun', age: 27, gender: 'male', language: 'telugu', photo_file_id: 'PLACEHOLDER_ARJUN' }
    ];
    for (let i = 0; i < virtuals.length; i++) {
      const v = virtuals[i];
      const virtualId = -100 - i;
      const existing = await User.findOne({ user_id: virtualId });
      if (!existing) {
        const virtualUser = new User({
          user_id: virtualId,
          name: v.name,
          age: v.age,
          gender: v.gender,
          language: v.language,
          photo_file_id: v.photo_file_id,
          is_virtual: true,
          free_messages_left: 999,
          star_balance: 0
        });
        await virtualUser.save();
        console.log(`Created virtual user: ${v.name} (${v.language})`);
      }
    }
    console.log('Virtual users created');
  }
}

// --------------------- Bot Setup ---------------------
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

let botUsername = '';
bot.telegram.getMe().then((info) => { botUsername = info.username; });

// --------------------- Registration Wizard (clean UI) ---------------------
const registrationStage = new Scenes.WizardScene(
  'registration',
  async (ctx) => {
    const msg = await ctx.reply('Welcome to *India Friend*! 🇮🇳\nLet\'s create your profile.\n\nWhat is your name?', { parse_mode: 'Markdown' });
    ctx.wizard.state.promptMsgId = msg.message_id;
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
    const name = ctx.message.text.trim();
    if (name.length < 2) {
      const errMsg = await ctx.reply('Name must be at least 2 characters. Please enter again.');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    ctx.wizard.state.name = name;
    const msg = await ctx.reply('What is your age? (only number)');
    ctx.wizard.state.promptMsgId = msg.message_id;
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
    const age = parseInt(ctx.message.text);
    if (isNaN(age) || age < 18) {
      const errMsg = await ctx.reply('Please enter a valid age (must be 18 or older).');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    ctx.wizard.state.age = age;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Male', 'male')],
      [Markup.button.callback('Female', 'female')],
      [Markup.button.callback('Other', 'other')]
    ]);
    const msg = await ctx.reply('Select your gender:', keyboard);
    ctx.wizard.state.promptMsgId = msg.message_id;
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery) {
      if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
      const errMsg = await ctx.reply('Please use the buttons to select your gender.');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
    const gender = ctx.callbackQuery.data;
    if (!['male', 'female', 'other'].includes(gender)) {
      await ctx.answerCbQuery('Invalid selection.');
      const errMsg = await ctx.reply('Invalid selection. Please try again.');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    ctx.wizard.state.gender = gender;
    await ctx.answerCbQuery();

    const langKeyboard = Markup.inlineKeyboard(
      languages.map(lang => [Markup.button.callback(`${lang.flag} ${lang.name}`, lang.code)])
    );
    const msg = await ctx.reply('Select your preferred language:', langKeyboard);
    ctx.wizard.state.promptMsgId = msg.message_id;
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.callbackQuery) {
      if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
      const errMsg = await ctx.reply('Please use the buttons to select your language.');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
    const language = ctx.callbackQuery.data;
    const validLang = languages.find(l => l.code === language);
    if (!validLang) {
      await ctx.answerCbQuery('Invalid selection.');
      const errMsg = await ctx.reply('Invalid selection. Please try again.');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    ctx.wizard.state.language = language;
    await ctx.answerCbQuery();
    const msg = await ctx.reply('Now send me a photo of yourself.');
    ctx.wizard.state.promptMsgId = msg.message_id;
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (ctx.wizard.state.promptMsgId) await ctx.deleteMessage(ctx.wizard.state.promptMsgId).catch(() => {});
    if (!ctx.message.photo) {
      const errMsg = await ctx.reply('Please send a photo.');
      ctx.wizard.state.promptMsgId = errMsg.message_id;
      return;
    }
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileId = photo.file_id;

    const referrerId = ctx.session.referred_by || null;
    const newUser = new User({
      user_id: ctx.from.id,
      name: ctx.wizard.state.name,
      age: ctx.wizard.state.age,
      gender: ctx.wizard.state.gender,
      language: ctx.wizard.state.language,
      photo_file_id: fileId,
      referred_by: referrerId,
      free_messages_left: 2,
      star_balance: 0,
      referrals_count: 0,
      streak_days: 1,
      last_active: new Date(),
      daily_free_last_given: new Date()
    });
    await newUser.save();

    if (referrerId) {
      const referrer = await getUser(referrerId);
      if (referrer) {
        await incrementUser(referrerId, 'referrals_count');
        if ((referrer.referrals_count + 1) % 5 === 0) {
          await incrementUser(referrerId, 'free_messages_left');
          await ctx.telegram.sendMessage(referrerId, '🎁 Congratulations! You earned 1 free message for referring 5 friends!');
        }
      }
    }

    await ctx.reply(
      '✅ *Profile created successfully!*\n\n' +
      'Use /find to find your best match.\n' +
      'Use /profile to view your profile.\n' +
      'Use /viewmatch to see your current match.\n' +
      'Use /buy to purchase more messages with Telegram Stars.\n' +
      'Use /referral to invite friends and earn free messages!',
      { parse_mode: 'Markdown' }
    );
    return ctx.scene.leave();
  }
);

// --------------------- Stage Middleware ---------------------
const stage = new Scenes.Stage([registrationStage]);
bot.use(stage.middleware());

// --------------------- Command Handlers (with viral features) ---------------------
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');
  let referrerId = null;
  if (args.length > 1 && args[1].startsWith('ref_')) {
    referrerId = parseInt(args[1].slice(4));
    if (!isNaN(referrerId)) {
      ctx.session.referred_by = referrerId;
      const referrer = await getUser(referrerId);
      if (referrer) {
        await ctx.telegram.sendMessage(referrerId, `🔔 ${ctx.from.first_name} used your referral link!`);
      }
    }
  }

  const user = await getUser(userId);
  if (user) {
    // Update last active and streak
    const now = new Date();
    const lastActive = user.last_active;
    let streak = user.streak_days || 0;
    if (lastActive) {
      const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak++;
      else if (diffDays > 1) streak = 1;
    } else {
      streak = 1;
    }
    await updateUser(userId, { last_active: now, streak_days: streak });
    await ctx.reply(`You are already registered! Your streak: ${streak} days 🔥\nUse /find to get matches or /profile to view your profile.`);
  } else {
    await ctx.scene.enter('registration');
  }
});

bot.command('profile', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Not registered. Use /start.');

  const genderEmoji = user.gender === 'male' ? '♂️' : user.gender === 'female' ? '♀️' : '⚧️';
  const lang = languages.find(l => l.code === user.language) || { name: 'English', flag: '🇬🇧' };
  let text = `👤 *Your Profile*\n` +
             `Name: ${user.name}\n` +
             `Age: ${user.age} ${genderEmoji}\n` +
             `Language: ${lang.flag} ${lang.name}\n` +
             `Streak: ${user.streak_days || 0} days 🔥\n` +
             `Free messages left: ${user.free_messages_left}\n` +
             `Star balance: ${user.star_balance}⭐\n` +
             `Referrals: ${user.referrals_count}\n`;
  if (user.boost_until && user.boost_until > new Date()) text += `Boost active until: ${user.boost_until.toDateString()}\n`;
  await ctx.replyWithPhoto(user.photo_file_id, { caption: text, parse_mode: 'Markdown' });
});

// View match (with fallback for virtual)
bot.command('viewmatch', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Not registered.');
  const matchId = user.active_match;
  if (!matchId) return ctx.reply('No active match.');
  const match = await getUser(matchId);
  if (!match) return ctx.reply('Match not found.');

  const genderEmoji = match.gender === 'male' ? '♂️' : match.gender === 'female' ? '♀️' : '⚧️';
  const lang = languages.find(l => l.code === match.language) || { name: 'English', flag: '🇬🇧' };
  let text = `❤️ *Your Match: ${match.name}*\nAge: ${match.age} ${genderEmoji}\nLanguage: ${lang.flag} ${lang.name}`;
  if (match.is_virtual) text += `\n(This is an AI partner)`;

  if (match.is_virtual && match.photo_file_id === 'PLACEHOLDER_...') {
    // If photo is placeholder, don't try to send
    await ctx.reply(text, { parse_mode: 'Markdown' });
  } else {
    await ctx.replyWithPhoto(match.photo_file_id, { caption: text, parse_mode: 'Markdown' });
  }
});

// Find match (same as before, but with streak check)
bot.command('find', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Please /start first.');
  if (user.active_match) return ctx.reply('You already have a match. Use /unmatch to end it.');

  const opposite = user.gender === 'male' ? 'female' : 'male';
  // Real users with same language
  let candidates = await User.find({
    gender: opposite,
    active_match: null,
    is_virtual: false,
    user_id: { $ne: userId },
    language: user.language
  });
  if (candidates.length === 0) {
    candidates = await User.find({
      gender: opposite,
      active_match: null,
      is_virtual: false,
      user_id: { $ne: userId }
    });
  }
  let isVirtual = false;
  if (candidates.length === 0) {
    candidates = await User.find({
      gender: opposite,
      active_match: null,
      is_virtual: true,
      user_id: { $ne: userId }
    });
    if (candidates.length === 0) return ctx.reply('No matches available now. Try later.');
    isVirtual = true;
    await ctx.reply('⚠️ No real users available. You’re matched with an AI partner.');
  }

  // closest age
  const best = candidates.reduce((prev, curr) => Math.abs(curr.age - user.age) < Math.abs(prev.age - user.age) ? curr : prev);
  await updateUser(userId, { active_match: best.user_id });
  await updateUser(best.user_id, { active_match: userId });

  await ctx.replyWithPhoto(best.photo_file_id, { caption: `✨ Matched with ${best.name} (${best.age})! Use /message to chat.` });
  if (!best.is_virtual) {
    await ctx.telegram.sendPhoto(best.user_id, user.photo_file_id, { caption: `✨ Matched with ${user.name} (${user.age})! Use /message to chat.` });
  }
});

// Unmatch
bot.command('unmatch', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user.active_match) return ctx.reply('No active match.');
  const matchId = user.active_match;
  await updateUser(userId, { active_match: null });
  await updateUser(matchId, { active_match: null });
  await ctx.reply('Unmatched. Use /find to find a new match.');
});

// Referral with leaderboard
bot.command('referral', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Register first with /start.');
  const link = `https://t.me/${botUsername}?start=ref_${userId}`;
  // leaderboard: top 5 referrers
  const topReferrers = await User.find({ is_virtual: false }).sort({ referrals_count: -1 }).limit(5).lean();
  let leaderboard = '🏆 *Top Referrers*\n';
  for (let i = 0; i < topReferrers.length; i++) {
    const u = topReferrers[i];
    leaderboard += `${i+1}. ${u.name} – ${u.referrals_count} referrals\n`;
  }
  const text = `🔗 *Your Referral Link*\n${link}\n\n📊 *Your stats*\nReferrals: ${user.referrals_count}\n\n${leaderboard}\n\n*How it works:*\n- Each friend who registers gives you +1 free message when they join.\n- Every 5 referrals = +1 free message.\n- Top referrers get featured weekly!`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
});

// Profile Sharing (text card)
bot.command('shareprofile', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Register first.');
  const text = `🌟 *${user.name}* (${user.age}) is looking for a match on India Friend!\nJoin the bot and meet new people: https://t.me/${botUsername}`;
  await ctx.reply(text, { parse_mode: 'Markdown' });
  await ctx.reply('✅ Share this message with friends!');
});

// Free Boost via referrals (if user has referred at least 3 friends)
bot.command('freeboost', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Register first.');
  if (user.referrals_count < 3) {
    return ctx.reply(`You need ${3 - user.referrals_count} more referral(s) to get a free boost. Invite friends with /referral.`);
  }
  const boostUntil = new Date();
  boostUntil.setDate(boostUntil.getDate() + 7); // 7 days free boost
  await updateUser(userId, { boost_until: boostUntil });
  await ctx.reply(`✅ You got a free 7‑day boost! Your profile will appear first in searches until ${boostUntil.toDateString()}.`);
});

// Daily Bonus (if streak maintained)
bot.command('daily', async (ctx) => {
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Register first.');
  const now = new Date();
  const lastGiven = user.daily_free_last_given;
  if (!lastGiven || lastGiven.toDateString() !== now.toDateString()) {
    await incrementUser(userId, 'free_messages_left', 1);
    await updateUser(userId, { daily_free_last_given: now });
    await ctx.reply(`🎁 Daily bonus claimed! You received 1 free message. Streak: ${user.streak_days || 0} days.`);
  } else {
    await ctx.reply('You already claimed your daily bonus today.');
  }
});

// Existing buy, payment, boost (unchanged) ...
bot.command('buy', async (ctx) => { /* ... same ... */ });
bot.action(/buy_(\d+)/, async (ctx) => { /* ... same ... */ });
bot.on('pre_checkout_query', async (ctx) => { await ctx.answerPreCheckoutQuery(true); });
bot.on('successful_payment', async (ctx) => { /* ... same ... */ });
bot.command('boost', async (ctx) => { /* ... same ... */ });

// Message Handler (with daily bonus and streak update)
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  const userId = ctx.from.id;
  const user = await getUser(userId);
  if (!user) return ctx.reply('Not registered. Use /start.');

  // Update last active and streak (once per day)
  const now = new Date();
  const lastActive = user.last_active;
  if (!lastActive || lastActive.toDateString() !== now.toDateString()) {
    let streak = user.streak_days || 0;
    if (lastActive) {
      const diffDays = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak++;
      else if (diffDays > 1) streak = 1;
    } else {
      streak = 1;
    }
    await updateUser(userId, { last_active: now, streak_days: streak });
  }

  const matchId = user.active_match;
  if (!matchId) return ctx.reply('No match. Use /find to get one.');

  // Daily free message (already handled with daily command, but also give a free message if not claimed)
  let freeLeft = user.free_messages_left;
  const lastGiven = user.daily_free_last_given;
  if (!lastGiven || lastGiven.toDateString() !== now.toDateString()) {
    await incrementUser(userId, 'free_messages_left', 1);
    await updateUser(userId, { daily_free_last_given: now });
    freeLeft += 1;
  }

  let costUsed = '';
  if (freeLeft > 0) {
    await incrementUser(userId, 'free_messages_left', -1);
    costUsed = 'free';
  } else if (user.star_balance >= COST_PER_MESSAGE) {
    await incrementUser(userId, 'star_balance', -COST_PER_MESSAGE);
    await recordTransaction(userId, -COST_PER_MESSAGE, 'spent', matchId);
    costUsed = `${COST_PER_MESSAGE}⭐`;
  } else {
    return ctx.reply('No free messages left and insufficient stars. Use /buy to get more.');
  }

  const match = await getUser(matchId);
  if (match.is_virtual) {
    const reply = generateReply(ctx.message.text, match, user.language);
    const delay = Math.floor(Math.random() * 6000) + 2000;
    const originalMsg = new Message({ from_id: userId, to_id: matchId, text: ctx.message.text });
    await originalMsg.save();
    await ctx.reply(`✅ Message sent! (${costUsed} used)`);
    setTimeout(async () => {
      await ctx.telegram.sendMessage(ctx.chat.id, `*${match.name}:* ${reply}`, { parse_mode: 'Markdown' });
      const replyMsg = new Message({ from_id: matchId, to_id: userId, text: reply });
      await replyMsg.save();
    }, delay);
  } else {
    await ctx.telegram.sendMessage(matchId, `💬 *From ${user.name}:* ${ctx.message.text}`, { parse_mode: 'Markdown' });
    const newMsg = new Message({ from_id: userId, to_id: matchId, text: ctx.message.text });
    await newMsg.save();
    await ctx.reply(`✅ Message sent! (${costUsed} used)`);
  }
});

// --------------------- Start Webhook ---------------------
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`).then(() => console.log('Webhook set'));
bot.startWebhook('/webhook', null, PORT);
console.log(`Bot listening on port ${PORT}`);
