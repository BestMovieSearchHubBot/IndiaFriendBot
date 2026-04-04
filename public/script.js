const gems = [
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/red.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/blue.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/green.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/yellow.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/purple.png"
];

let coinsEl = document.getElementById("coins");
let coins = 1030;   // as per HTML

let isSpinning = false;   // ✅ spin lock
let finishedReels = 0;
const BIG_WIN_THRESHOLD = 15;   // ✅ 15 या उससे अधिक पर बड़ा पॉपअप

// ✅ disable/enable spin button
function setSpinEnabled(enabled) {
  const btn = document.getElementById("spinBtn");
  if (enabled) {
    btn.style.pointerEvents = "auto";
    btn.style.opacity = "1";
  } else {
    btn.style.pointerEvents = "none";
    btn.style.opacity = "0.6";
  }
}

// create reel (3 copies of each gem, shuffled)
function createReel(id) {
  let reel = document.getElementById(id);
  reel.innerHTML = "";

  let gemCount = {};
  gems.forEach(g => gemCount[g] = 0);

  let reelImages = [];

  while (reelImages.length < 15) {
    let gem = gems[Math.floor(Math.random() * gems.length)];
    if (gemCount[gem] < 3) {
      reelImages.push(gem);
      gemCount[gem]++;
    }
  }

  reelImages.sort(() => Math.random() - 0.5);

  reelImages.forEach(src => {
    let img = document.createElement("img");
    img.src = src;
    reel.appendChild(img);
  });
}

// initial fill
createReel("r1");
createReel("r2");
createReel("r3");

// ✅ spin function with lock and bet deduction
function spin() {
  if (isSpinning) return;

  isSpinning = true;
  setSpinEnabled(false);
  finishedReels = 0;

  if (coins <= 0) {
    alert("Out of coins! Game Over.");
    isSpinning = false;
    setSpinEnabled(true);
    return;
  }
  coins--;
  coinsEl.innerText = coins;

  spinReel("r1", 0);
  spinReel("r2", 200);
  spinReel("r3", 400);
}

// spin animation (unchanged)
function spinReel(id, delay) {
  const reel = document.getElementById(id);
  const imgHeight = 69;
  const totalHeight = imgHeight * reel.children.length;

  let start = null;
  let duration = 2500 + delay;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(timestamp) {
    if (!start) start = timestamp;
    let progress = timestamp - start;
    let t = Math.min(progress / duration, 1);
    let eased = easeOut(t);
    let move = eased * (totalHeight * 3);
    reel.style.transform = `translateY(${-move % totalHeight}px)`;

    if (progress < duration) {
      requestAnimationFrame(animate);
    } else {
      reel.style.transform = "translateY(0)";
      createReel(id);
      finishedReels++;

      if (finishedReels === 3) {
        setTimeout(() => {
          checkWin();
        }, 200);
      }
    }
  }

  setTimeout(() => {
    requestAnimationFrame(animate);
  }, delay);
}

// ✅ normal win: smooth coin count-up (no popup)
function updateCoinsSimple(amount, callback) {
  let startVal = coins;
  let targetVal = coins + amount;
  let step = Math.max(1, Math.ceil(amount / 20));
  let interval = setInterval(() => {
    startVal += step;
    if (startVal >= targetVal) {
      startVal = targetVal;
      clearInterval(interval);
      coins = targetVal;
      coinsEl.innerText = coins;
      if (callback) callback();
    } else {
      coins = startVal;
      coinsEl.innerText = coins;
    }
  }, 40);
}

// ✅ big win overlay
function showBigWinOverlay(amount) {
  const overlay = document.getElementById("winOverlay");
  const winLabel = document.getElementById("winLabel");
  winLabel.innerText = "+" + amount + " COINS";
  overlay.style.display = "flex";
  window._bigWinAmount = amount;
}

// ✅ close overlay and add coins
function closeWin() {
  const overlay = document.getElementById("winOverlay");
  overlay.style.display = "none";
  document.querySelectorAll('.glow').forEach(el => el.classList.remove('glow'));

  if (window._bigWinAmount && window._bigWinAmount > 0) {
    let winAmount = window._bigWinAmount;
    window._bigWinAmount = 0;
    updateCoinsSimple(winAmount, () => {
      isSpinning = false;
      setSpinEnabled(true);
    });
  } else {
    isSpinning = false;
    setSpinEnabled(true);
  }
}

// ✅ check win (original logic + big/normal split)
function checkWin() {
  let reels = [
    document.getElementById("r1"),
    document.getElementById("r2"),
    document.getElementById("r3")
  ];

  let totalWin = 0;
  let glowTargets = [];

  for (let row = 0; row < 3; row++) {
    let a = reels[0].children[row];
    let b = reels[1].children[row];
    let c = reels[2].children[row];

    if (a.src === b.src && b.src === c.src) {
      totalWin += 50;
      glowTargets.push(a, b, c);
    } else if (a.src === b.src || b.src === c.src || a.src === c.src) {
      totalWin += 10;
      if (a.src === b.src) glowTargets.push(a, b);
      if (b.src === c.src) glowTargets.push(b, c);
      if (a.src === c.src) glowTargets.push(a, c);
    }
  }

  if (totalWin > 0) {
    glowTargets.forEach(img => img.classList.add("glow"));

    if (totalWin >= BIG_WIN_THRESHOLD) {
      // 🎰 बड़ी जीत – पॉपअप दिखाएँ, स्पिन लॉक रहेगा
      showBigWinOverlay(totalWin);
      // isSpinning को false बाद में COLLECT पर किया जाएगा
    } else {
      // 🟢 छोटी जीत – सिर्फ कॉइन अपडेट करें, फिर स्पिन अनलॉक
      updateCoinsSimple(totalWin, () => {
        isSpinning = false;
        setSpinEnabled(true);
        setTimeout(() => {
          document.querySelectorAll('.glow').forEach(el => el.classList.remove('glow'));
        }, 500);
      });
    }
  } else {
    // कोई जीत नहीं
    isSpinning = false;
    setSpinEnabled(true);
    document.querySelectorAll('.glow').forEach(el => el.classList.remove('glow'));
  }
}

// ✅ event listeners
document.getElementById("spinBtn").addEventListener("click", () => {
  if (typeof spin === "function") spin();
});
document.getElementById("collectBtn").addEventListener("click", closeWin);
document.body.addEventListener("contextmenu", e => e.preventDefault());

// sync display
coinsEl.innerText = coins;
