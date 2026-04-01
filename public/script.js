const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe.user;

let user_id = user.id;

const fruits = ["🍎","🍊","🍇","🍒","🍉"];

function fillReel(id){
  let el = document.getElementById(id);
  el.innerHTML = "";
  for(let i=0;i<10;i++){
    let d = document.createElement("div");
    d.innerText = fruits[Math.floor(Math.random()*fruits.length)];
    el.appendChild(d);
  }
}

fillReel("r1");
fillReel("r2");
fillReel("r3");

// LOAD USER
async function load(){
  let res = await fetch(`/user/${user_id}`);
  let data = await res.json();
  document.getElementById("coins").innerText = "Coins: "+data.coins;
}
load();

// SPIN
async function spin(){

  // start animation
  document.getElementById("r1").classList.add("spin");
  document.getElementById("r2").classList.add("spin");
  document.getElementById("r3").classList.add("spin");

  // delay different reels (casino feel)
  setTimeout(()=> document.getElementById("r1").classList.remove("spin"), 1000);
  setTimeout(()=> document.getElementById("r2").classList.remove("spin"), 1400);
  setTimeout(()=> document.getElementById("r3").classList.remove("spin"), 1800);

  // backend result
  let res = await fetch('/spin',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ user_id })
  });

  let data = await res.json();

  setTimeout(()=>{
    document.getElementById("r1").innerHTML = `<div>${data.result[0]}</div>`;
    document.getElementById("r2").innerHTML = `<div>${data.result[1]}</div>`;
    document.getElementById("r3").innerHTML = `<div>${data.result[2]}</div>`;

    document.getElementById("coins").innerText = "Coins: "+data.coins;
  },1800);
}
