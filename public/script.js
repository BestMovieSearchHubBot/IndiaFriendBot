const gems = [
  "gems/red.png",
  "gems/blue.png",
  "gems/green.png",
  "gems/yellow.png",
  "gems/purple.png"
];

// create reels
function createReel(id){
  let reel = document.getElementById(id);
  reel.innerHTML = "";

  for(let i=0;i<15;i++){
    let img = document.createElement("img");
    img.src = gems[Math.floor(Math.random()*gems.length)];
    reel.appendChild(img);
  }
}

// init
createReel("r1");
createReel("r2");
createReel("r3");

// spin
function spin(){

  spinReel("r1", 0);
  spinReel("r2", 200);
  spinReel("r3", 400);
}

// reel animation
function spinReel(id, delay){

  let reel = document.getElementById(id);

  setTimeout(()=>{

    let position = 0;
    reel.style.transition = "none";

    let interval = setInterval(()=>{
      position += 25;
      reel.style.transform = `translateY(-${position}px)`;

      if(position > 500){
        clearInterval(interval);

        reel.style.transition = "transform 0.6s ease-out";
        reel.style.transform = `translateY(-600px)`;
      }

    },30);

  },delay);
}
