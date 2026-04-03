const gems = [
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/red.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/blue.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/green.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/yellow.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/purple.png"
];

let coinsEl = document.getElementById("coins");
let coins = 1000; 
let isSpinning = false;
let finishedReels = 0;

function createReel(id){
  let reel = document.getElementById(id);
  reel.innerHTML = "";
  let reelImages = [];
  while(reelImages.length < 15){
    let gem = gems[Math.floor(Math.random() * gems.length)];
    reelImages.push(gem);
  }
  reelImages.forEach(src => {
    let img = document.createElement("img");
    img.src = src;
    reel.appendChild(img);
  });
}

// Initial Reels Setup
createReel("r1");
createReel("r2");
createReel("r3");

function spin(){
  if(isSpinning) return; 

  isSpinning = true; // Lock spin button
  finishedReels = 0;

  spinReel("r1", 0);
  spinReel("r2", 300);
  spinReel("r3", 600);
}

function spinReel(id, delay){
  const reel = document.getElementById(id);
  const imgHeight = 85 + 18; // Image + Margin
  const totalHeight = imgHeight * reel.children.length;

  let start = null;
  let duration = 2500 + delay;

  function animate(timestamp){
    if(!start) start = timestamp;
    let progress = timestamp - start;
    let t = Math.min(progress / duration, 1);
    let eased = 1 - Math.pow(1 - t, 3); // Ease Out Effect

    let move = eased * (totalHeight * 4);
    reel.style.transform = `translateY(${-move % totalHeight}px)`;

    if(progress < duration){
      requestAnimationFrame(animate);
    } else {
      reel.style.transform = "translateY(0)";
      createReel(id); 
      finishedReels++;

      if(finishedReels === 3){
        setTimeout(checkWin, 300);
      }
    }
  }
  setTimeout(() => requestAnimationFrame(animate), delay);
}

function checkWin(){
  let reels = [
    document.getElementById("r1"),
    document.getElementById("r2"),
    document.getElementById("r3")
  ];

  let totalWin = 0;
  let glowTargets = [];

  for(let row=0; row<3; row++){
    let a = reels[0].children[row];
    let b = reels[1].children[row];
    let c = reels[2].children[row];

    if(!a || !b || !c) continue;

    if(a.src === b.src && b.src === c.src){
      totalWin += 50;
      glowTargets.push(a, b, c);
    } 
    else if(a.src === b.src || b.src === c.src || a.src === c.src){
      totalWin += 10;
      if(a.src === b.src) glowTargets.push(a, b);
      if(b.src === c.src) glowTargets.push(b, c);
      if(a.src === c.src) glowTargets.push(a, c);
    }
  }

  if(totalWin > 0){
    glowTargets.forEach(img => img.classList.add("glow"));
    setTimeout(() => {
      showWinAnimation(totalWin);
    }, 400);
  } else {
    isSpinning = false; // Agar nahi jeeta toh unlock kardo
  }
}

function showWinAnimation(amount) {
  const overlay = document.getElementById("winOverlay");
  const winLabel = document.getElementById("winLabel");
  
  winLabel.innerText = "+" + amount + " COINS";
  overlay.style.display = "flex";
  
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

function closeWin() {
  document.getElementById("winOverlay").style.display = "none";
  document.querySelectorAll('.glow').forEach(el => el.classList.remove('glow'));
  isSpinning = false; // Collect karne ke baad hi agla spin allow hoga
}

// Spin button connection
document.getElementById('spinBtn').onclick = spin;
