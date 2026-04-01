const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe.user;
const user_id = user.id;

const grid = document.getElementById("grid");

// CREATE GRID
for(let i=0;i<9;i++){
  let box = document.createElement("div");
  box.className="box";
  box.id="b"+i;
  grid.appendChild(box);
}

// LOAD USER
async function load(){
  let res = await fetch(`/user/${user_id}`);
  let data = await res.json();
  document.getElementById("coins").innerText = data.coins;
}
load();

// SPIN
async function spin(){

  let res = await fetch('/spin',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ user_id })
  });

  let data = await res.json();

  // clear
  for(let i=0;i<9;i++){
    document.getElementById("b"+i).innerHTML="";
  }

  // 🎰 animation (column wise better feel)
  for(let col=0; col<3; col++){

    for(let row=0; row<3; row++){

      let i = row*3 + col;

      let item = document.createElement("div");
      item.className="item";
      item.innerText = data.result[col];

      let box = document.getElementById("b"+i);
      box.appendChild(item);

      setTimeout(()=>{
        item.classList.add("show");
      }, col*200 + row*80);

    }
  }

  setTimeout(()=>{
    document.getElementById("coins").innerText = data.coins;
  },1000);
}
