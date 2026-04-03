const gems = [
  "gems/red.png",
  "gems/blue.png",
  "gems/green.png",
  "gems/yellow.png",
  "gems/purple.png"
];

let coins = 1030;
let coinsEl = document.getElementById("coins");

let isSpinning = false;
let finishedReels = 0;

/* 🎰 CREATE REEL */
function createReel(id){
  let reel = document.getElementById(id);
  reel.innerHTML = "";

  let gemCount = {};
  gems.forEach(g => gemCount[g] = 0);

  let reelImages = [];

  while(reelImages.length < 15){
    let gem = gems[Math.floor(Math.random() * gems.length)];

    if(gemCount[gem] < 3){
      reelImages.push(gem);
      gemCount[gem]++;
    }
  }

  // shuffle
  reelImages.sort(() => Math.random() - 0.5);

  reelImages.forEach(src => {
    let img = document.createElement("img");
    img.src = src;
    reel.appendChild(img);
  });
}

/* 🔹 INIT */
createReel("r1");
createReel("r2");
createReel("r3");

/* 🎯 SPIN BUTTON */
document.getElementById("spinBtn").addEventListener("click", spin);

/* 🎰 SPIN */
function spin(){
  if(isSpinning) return;

  isSpinning = true;
  finishedReels = 0;

  spinReel("r1", 0);
  spinReel("r2", 200);
  spinReel("r3", 400);
}

/* 🎡 SPIN ANIMATION (SMOOTH) */
function spinReel(id, delay){
  const reel = document.getElementById(id);
  const imgHeight = 103;
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

    let move = eased * (totalHeight * 3);
    reel.style.transform = `translateY(${-move % totalHeight}px)`;

    if(progress < duration){
      requestAnimationFrame(animate);
    } else {
      reel.style.transform = "translateY(0)";
      createReel(id);

      finishedReels++;

      if(finishedReels === 3){
        setTimeout(()=>{
          checkWin();
          isSpinning = false;
        }, 200);
      }
    }
  }

  setTimeout(()=>{
    requestAnimationFrame(animate);
  }, delay);
}

/* 🎉 SHOW WIN FRAME */
function showWinFrame(amount){
  const frame = document.getElementById("winFrame");
  const text = document.getElementById("winText");
  const coinsTxt = document.getElementById("winCoins");

  coinsTxt.textContent = "+" + amount;

  frame.classList.remove("normal-win","big-win");

  if(amount >= 50){
    text.textContent = "BIG WIN 🔥";
    frame.classList.add("big-win");
  } else {
    text.textContent = "YOU WIN";
    frame.classList.add("normal-win");
  }

  frame.classList.add("show");

  setTimeout(()=>{
    frame.classList.remove("show","normal-win","big-win");
  }, 2000);
}

/* 💰 CHECK WIN */
function checkWin(){
  let reels = [
    document.getElementById("r1"),
    document.getElementById("r2"),
    document.getElementById("r3")
  ];

  let totalWin = 0;
  let winPositions = [];

  for(let row = 0; row < 3; row++){
    let a = reels[0].children[row];
    let b = reels[1].children[row];
    let c = reels[2].children[row];

    // 🟢 FULL MATCH
    if(a.src === b.src && b.src === c.src){
      totalWin += 50;

      winPositions.push(
        {reel:'r1', index:row},
        {reel:'r2', index:row},
        {reel:'r3', index:row}
      );
    } 
    // 🟡 PARTIAL MATCH
    else if(a.src === b.src || b.src === c.src || a.src === c.src){
      totalWin += 10;
    }
  }

  if(totalWin > 0){
    coins += totalWin;
    coinsEl.textContent = coins;

    // 🎉 Show UI
    showWinFrame(totalWin);

    // ✨ Glow effect
    winPositions.forEach(pos => {
      const reel = document.getElementById(pos.reel);
      const gem = reel.children[pos.index];

      if(gem){
        gem.classList.add("win");

        setTimeout(()=>{
          gem.classList.remove("win");
        }, 1000);
      }
    });
  }
}
