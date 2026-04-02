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

  // check horizontal rows
  for(let row=0; row<3; row++){
    let a = visibleGems[row];
    let b = visibleGems[row+3];
    let c = visibleGems[row+6];

    if(a===b && b===c){
      totalWin += 50; // 3 in a row big win
      console.log("BIG WIN!", a, b, c);
    } else if(a===b || b===c || a===c){
      totalWin += 10; // 2 in a row normal win
      console.log("WIN!", a, b, c);
    }
  }

  if(totalWin>0){
    coins += totalWin;
    coinsEl.textContent = coins;
    alert("You won "+totalWin+" coins!");
  } else {
    console.log("No win this spin");
  }
}
