const gems = [
  "gems/red.png",
  "gems/blue.png",
  "gems/green.png",
  "gems/yellow.png",
  "gems/purple.png"
];

let coins = 1000;
document.getElementById("coins").innerText = coins;

// create 15 images per reel with max 3 repetitions per gem
function createReel(id){
  const reel = document.getElementById(id);
  reel.innerHTML = "";
  const counts = {}; // track max 3 per gem
  for(let g of gems) counts[g]=0;

  let images = [];
  while(images.length < 15){
    const gem = gems[Math.floor(Math.random()*gems.length)];
    if(counts[gem]<3){
      images.push(gem);
      counts[gem]++;
    }
  }

  // add images to reel
  images.forEach(src=>{
    const img = document.createElement("img");
    img.src = src;
    reel.appendChild(img);
  });
}

// init reels
createReel("r1");
createReel("r2");
createReel("r3");

// spin animation
function spin(){
  spinReel("r1",0);
  spinReel("r2",200);
  spinReel("r3",400);
}

// reel spin function
function spinReel(id, delay){
  const reel = document.getElementById(id);
  let top = 0;
  const interval = setInterval(()=>{
    top -= 10;  // speed
    if(top <= -68*15) top=0;  // reset after 15 images
    reel.style.transform = `translateY(${top}px)`;
  },50);

  setTimeout(()=>{
    clearInterval(interval);
    checkWin();
  }, 1500 + delay);
}

// check visible gems for win (middle 3)
function checkWin(){
  const visible = 3;  // 3 gems visible
  const winGems = [];
  ["r1","r2","r3"].forEach(id=>{
    const reel = document.getElementById(id);
    const imgs = reel.querySelectorAll("img");
    winGems.push([]);
    for(let i=0;i<visible;i++){
      winGems[winGems.length-1].push(imgs[i].src);
    }
  });

  // check matching consecutive gems in middle row
  let middleRow = [winGems[0][1],winGems[1][1],winGems[2][1]];
  if(middleRow[0]===middleRow[1] && middleRow[1]===middleRow[2]){
    alert("BIG WIN! +100 coins");
    coins += 100;
  } else if(middleRow[0]===middleRow[1] || middleRow[1]===middleRow[2]){
    alert("Win! +20 coins");
    coins += 20;
  } else{
    alert("No Win");
    coins -= 10;
  }

  document.getElementById("coins").innerText = coins;
}
