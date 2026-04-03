const gems = [
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/red.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/blue.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/green.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/yellow.png",
  "https://cdn.jsdelivr.net/gh/BestMovieSearchHubBot/IndiaFriendBot@main/public/gems/purple.png"
];

let coinsEl = document.getElementById("coins");
let coins = 1000;

let isSpinning = false;   // ✅ NEW (lock system)
let finishedReels = 0;    // ✅ track reels finish

// create reel
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

  reelImages.sort(() => Math.random() - 0.5);

  reelImages.forEach(src => {
    let img = document.createElement("img");
    img.src = src;
    reel.appendChild(img);
  });
}

// init
createReel("r1");
createReel("r2");
createReel("r3");

// spin
function spin(){
  if(isSpinning) return; // ❌ block multiple clicks

  isSpinning = true;
  finishedReels = 0;

  spinReel("r1", 0);
  spinReel("r2", 200);
  spinReel("r3", 400);
}

// smooth spin
function spinReel(id, delay){
  const reel = document.getElementById(id);
  const imgHeight = 69;
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
      // ✅ force clean stop (no stuck issue)
      reel.style.transform = "translateY(0)";
      createReel(id);

      finishedReels++;

      // ✅ only after ALL reels stop
      if(finishedReels === 3){
        setTimeout(()=>{
          checkWin();
          isSpinning = false; // unlock spin
        }, 200);
      }
    }
  }

  setTimeout(()=>{
    requestAnimationFrame(animate);
  }, delay);
}

// check win
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

    if(a.src===b.src && b.src===c.src){
      totalWin += 50;
      glowTargets.push(a,b,c);
    } 
    else if(a.src===b.src || b.src===c.src || a.src===c.src){
      totalWin += 10;

      if(a.src===b.src) glowTargets.push(a,b);
      if(b.src===c.src) glowTargets.push(b,c);
      if(a.src===c.src) glowTargets.push(a,c);
    }
  }

  if(totalWin>0){
    coins += totalWin;
    coinsEl.textContent = coins;

    glowTargets.forEach(img => img.classList.add("glow"));

    setTimeout(()=>{
      glowTargets.forEach(img => img.classList.remove("glow"));
    }, 1500);

    // ✅ result properly after stop
    setTimeout(()=>{
      alert("You won " + totalWin + " coins!");
    }, 100);
  }
}
