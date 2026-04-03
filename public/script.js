const gems = [
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/red.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/blue.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/green.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/yellow.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/purple.png"
];

let coinsEl = document.getElementById("coins");
let coins = 1000; // Starting coins

let isSpinning = false;
let finishedReels = 0;

// Reel create karne ka function
function createReel(id){
  let reel = document.getElementById(id);
  reel.innerHTML = "";

  let gemCount = {};
  gems.forEach(g => gemCount[g] = 0);

  let reelImages = [];

  // 15 gems generate karein taaki spin smooth dikhe
  while(reelImages.length < 15){
    let gem = gems[Math.floor(Math.random() * gems.length)];
    if(gemCount[gem] < 5){ // thoda balance badha diya
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

// Initial Reels
createReel("r1");
createReel("r2");
createReel("r3");

// Spin Trigger
function spin(){
  if(isSpinning) return; 

  isSpinning = true;
  finishedReels = 0;

  // Har reel ka delay badha diya taaki casino feel aaye
  spinReel("r1", 0);
  spinReel("r2", 300);
  spinReel("r3", 600);
}

// Animation Logic
function spinReel(id, delay){
  const reel = document.getElementById(id);
  const imgHeight = 85 + 18; // FIX: 85px (image) + 18px (margin-bottom)
  const totalHeight = imgHeight * reel.children.length;

  let start = null;
  let duration = 2500 + delay;

  function easeOut(t){
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(timestamp){
    if(!start) start = timestamp;
    let progress = timestamp - start;

    let t = Math.min(progress / duration, 1);
    let eased = easeOut(t);

    let move = eased * (totalHeight * 4); // 4 baar poori reel ghumegi
    reel.style.transform = `translateY(${-move % totalHeight}px)`;

    if(progress < duration){
      requestAnimationFrame(animate);
    } else {
      reel.style.transform = "translateY(0)";
      createReel(id); // Spin khatam hone par nayi symbols reload
      finishedReels++;

      if(finishedReels === 3){
        setTimeout(()=>{
          checkWin();
          isSpinning = false;
        }, 300);
      }
    }
  }

  setTimeout(()=>{
    requestAnimationFrame(animate);
  }, delay);
}

// Winning Logic
function checkWin(){
  let reels = [
    document.getElementById("r1"),
    document.getElementById("r2"),
    document.getElementById("r3")
  ];

  let totalWin = 0;
  let glowTargets = [];

  // Pehli 3 row check karein (kyunki overflow:hidden hai)
  for(let row=0; row<3; row++){
    let a = reels[0].children[row];
    let b = reels[1].children[row];
    let c = reels[2].children[row];

    if(!a || !b || !c) continue;

    // Perfect Match (50 Coins)
    if(a.src === b.src && b.src === c.src){
      totalWin += 50;
      glowTargets.push(a, b, c);
    } 
    // Partial Match (10 Coins)
    else if(a.src === b.src || b.src === c.src || a.src === c.src){
      totalWin += 10;
      if(a.src === b.src) glowTargets.push(a, b);
      if(b.src === c.src) glowTargets.push(b, c);
      if(a.src === c.src) glowTargets.push(a, c);
    }
  }

  if(totalWin > 0){
    // CSS glow apply karein
    glowTargets.forEach(img => img.classList.add("glow"));

    // Casino Overlay dikhayein
    setTimeout(() => {
      showWinAnimation(totalWin);
    }, 400);
  }
}

// Overlay function (Jo aapke HTML ke naye UI ko trigger karega)
function showWinAnimation(amount) {
  const overlay = document.getElementById("winOverlay");
  const winLabel = document.getElementById("winLabel");
  
  winLabel.innerText = "+" + amount + " COINS";
  overlay.style.display = "flex";
  
  // Coin count-up effect
  let startValue = coins;
  coins += amount;
  let duration = 800; 
  let startTime = null;

  function updateCoins(timestamp) {
    if (!startTime) startTime = timestamp;
    let progress = timestamp - startTime;
    let current = Math.min(Math.floor(startValue + (amount * (progress / duration))), coins);
    coinsEl.textContent = current;
    if (progress < duration) requestAnimationFrame(updateCoins);
  }
  requestAnimationFrame(updateCoins);
}

// Button click par band karne ke liye
function closeWin() {
  document.getElementById("winOverlay").style.display = "none";
  document.querySelectorAll('.glow').forEach(el => el.classList.remove('glow'));
}
