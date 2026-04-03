const gems = [
  "gems/red.png",
  "gems/blue.png",
  "gems/green.png",
  "gems/yellow.png",
  "gems/purple.png"
];

let coinsEl = document.getElementById("coins");
let coins = 1000;

// create reel with 15 images, max 3 of each gem
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

  // add to reel
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

// spin reels
function spin(){
  spinReel("r1", 0);
  spinReel("r2", 200);
  spinReel("r3", 400);
}

// 🎰 SMOOTH CASINO SPIN (UPDATED)
function spinReel(id, delay){
  const reel = document.getElementById(id);
  const imgHeight = 69;
  const totalHeight = imgHeight * reel.children.length;

  let start = null;
  let duration = 2500 + delay;

  function easeOut(t){
    return 1 - Math.pow(1 - t, 3); // smooth slow down
  }

  function animate(timestamp){
    if(!start) start = timestamp;
    let progress = timestamp - start;

    let t = Math.min(progress / duration, 1);
    let eased = easeOut(t);

    // 3 full spins + slow stop
    let move = eased * (totalHeight * 3);
    reel.style.transform = `translateY(${-move % totalHeight}px)`;

    if(progress < duration){
      requestAnimationFrame(animate);
    } else {
      // stop clean
      reel.style.transform = "translateY(0)";
      createReel(id);

      if(id === "r3") checkWin();
    }
  }

  setTimeout(()=>{
    requestAnimationFrame(animate);
  }, delay);
}

// check for adjacent matches
function checkWin(){
  let reels = [document.getElementById("r1"), document.getElementById("r2"), document.getElementById("r3")];
  let visibleGems = [];

  reels.forEach(r => {
    visibleGems.push(r.children[0].src);
    visibleGems.push(r.children[1].src);
    visibleGems.push(r.children[2].src);
  });

  let totalWin = 0;
  let glowTargets = [];

  for(let row=0; row<3; row++){
    let a = reels[0].children[row];
    let b = reels[1].children[row];
    let c = reels[2].children[row];

    if(a.src===b.src && b.src===c.src){
      totalWin += 50;
      glowTargets.push(a,b,c);
    } else if(a.src===b.src || b.src===c.src || a.src===c.src){
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

    alert("You won "+totalWin+" coins!");
  } else {
    console.log("No win this spin");
  }
}
