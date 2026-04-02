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

// spin animation
function spinReel(id, delay){
  const reel = document.getElementById(id);
  let top = 0;
  const speed = 20;
  const imgHeight = 69;

  const interval = setInterval(()=>{
    top -= 10;
    if(top <= -imgHeight * reel.children.length) top = 0;
    reel.style.transform = `translateY(${top}px)`;
  }, speed);

  setTimeout(()=>{
    clearInterval(interval);
    reel.style.transform = "translateY(0)";
    createReel(id);
    if(id === "r3") checkWin(); // check win after last reel
  }, 2000 + delay);
}

// check for adjacent matches
function checkWin(){
  let reels = [document.getElementById("r1"), document.getElementById("r2"), document.getElementById("r3")];
  let visibleGems = [];

  // get visible 3 gems from each reel (first 3 images)
  reels.forEach(r => {
    visibleGems.push(r.children[0].src);
    visibleGems.push(r.children[1].src);
    visibleGems.push(r.children[2].src);
  });

  let totalWin = 0;
  let glowTargets = [];

  // check horizontal rows
  for(let row=0; row<3; row++){
    let a = reels[0].children[row];
    let b = reels[1].children[row];
    let c = reels[2].children[row];

    if(a.src===b.src && b.src===c.src){
      totalWin += 50; // 3 in a row big win
      glowTargets.push(a,b,c);
      console.log("BIG WIN!", a.src, b.src, c.src);
    } else if(a.src===b.src || b.src===c.src || a.src===c.src){
      totalWin += 10; // 2 in a row normal win
      // add only matching 2 for glow
      if(a.src===b.src) glowTargets.push(a,b);
      if(b.src===c.src) glowTargets.push(b,c);
      if(a.src===c.src) glowTargets.push(a,c);
      console.log("WIN!", a.src, b.src, c.src);
    }
  }

  if(totalWin>0){
    coins += totalWin;
    coinsEl.textContent = coins;
    // Add glow effect
    glowTargets.forEach(img => img.classList.add("glow"));
    setTimeout(()=>{
      glowTargets.forEach(img => img.classList.remove("glow"));
    }, 1500);

    alert("You won "+totalWin+" coins!");
  } else {
    console.log("No win this spin");
  }
}
