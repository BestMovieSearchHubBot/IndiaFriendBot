const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe.user;
const user_id = user.id;

const fruits = ["💎","🟢","🔷","🔴","🟡"];

const grid = document.getElementById("grid");

// CREATE 9 BOXES
for(let i=0;i<9;i++){
  let box = document.createElement("div");
  box.className = "box";
  box.id = "b"+i;
  grid.appendChild(box);
}

// LOAD USER
async function load(){
  let res = await fetch(`/user/${user_id}`);
  let data = await res.json();
  document.getElementById("coins").innerText = data.coins;
}
load();

// SPIN FUNCTION
async function spin(){

  // backend result
  let res = await fetch('/spin',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ user_id })
  });

  let data = await res.json();

  let result = data.result;

  // CLEAR BOXES
  for(let i=0;i<9;i++){
    document.getElementById("b"+i).innerHTML="";
  }

  // FALL ANIMATION
  for(let i=0;i<9;i++){

    let item = document.createElement("div");
    item.className = "item";
    item.innerText = result[i % 3]; // repeat pattern

    let box = document.getElementById("b"+i);
    box.appendChild(item);

    // delay for each box
    setTimeout(()=>{
      item.classList.add("show");
    }, i * 100); // stagger effect
  }

  // update coins
  setTimeout(()=>{
    document.getElementById("coins").innerText = data.coins;
  },1000);
}
