const gems = [
  "gems/red.png",
  "gems/blue.png",
  "gems/green.png",
  "gems/yellow.png",
  "gems/purple.png"
];

// create reels with max 3 of each gem
function createReel(id){
  let reel = document.getElementById(id);
  reel.innerHTML = "";

  // Gem count tracker
  let gemCount = {};
  gems.forEach(g => gemCount[g] = 0);

  let reelImages = [];

  while (reelImages.length < 15) {
    let gem = gems[Math.floor(Math.random() * gems.length)];
    if (gemCount[gem] < 3) {  // max 3 of each gem
      reelImages.push(gem);
      gemCount[gem]++;
    }
  }

  // Shuffle for randomness
  reelImages.sort(() => Math.random() - 0.5);

  // Add to reel
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

// reel animation
function spinReel(id, delay){
  const reel = document.getElementById(id);
  let top = 0;
  const speed = 20; // speed of spin
  const imgHeight = 69; // height + gap approx

  const interval = setInterval(() => {
    top -= 10;
    if (top <= -imgHeight * reel.children.length) top = 0;
    reel.style.transform = `translateY(${top}px)`;
  }, speed);

  setTimeout(() => {
    clearInterval(interval);
    reel.style.transform = "translateY(0)";

    // Reset reel images for next spin
    createReel(id);
  }, 2000 + delay); // spin duration
}
