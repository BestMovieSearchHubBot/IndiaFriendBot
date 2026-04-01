const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe.user;

let user_id = user.id;

async function loadUser(){
  let res = await fetch(`/user/${user_id}`);
  let data = await res.json();

  document.getElementById("coins").innerText = "Coins: "+data.coins;
}

async function spin(){
  let slot = document.getElementById("slot");

  // animation
  for(let i=0;i<10;i++){
    slot.innerText = "🍎 | 🍊 | 🍇";
    await new Promise(r=>setTimeout(r,100));
  }

  let res = await fetch('/spin',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ user_id })
  });

  let data = await res.json();

  slot.innerText = data.result.join(" | ");
  document.getElementById("coins").innerText = "Coins: "+data.coins;
}

async function withdraw(){
  let res = await fetch('/withdraw',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ user_id })
  });

  let data = await res.json();

  if(data.ok) alert("Withdraw Requested");
  else alert("Not enough coins");
}

loadUser();
