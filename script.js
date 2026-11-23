const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- navbar: glow mengikuti bagian yang sedang dilihat ---------- */
const links=$$("#menu a"),glow=$("#glow"),secs=links.map(a=>$(a.getAttribute("href")));
const moveGlow=a=>{glow.style.left=a.offsetLeft+"px";glow.style.width=a.offsetWidth+"px"};
function spy(){
  let cur=0;secs.forEach((s,i)=>{if(s.getBoundingClientRect().top<=innerHeight*.4)cur=i});
  links.forEach((a,i)=>a.classList.toggle("on",i===cur));moveGlow(links[cur]);
  $("#nav").classList.toggle("solid",scrollY>24);
}
addEventListener("scroll",spy,{passive:true});addEventListener("resize",spy);
links.forEach(a=>a.addEventListener("mouseenter",()=>moveGlow(a)));
$("#menu").addEventListener("mouseleave",spy);
document.fonts&&document.fonts.ready.then(spy);spy();

/* ---------- animasi muncul saat scroll ---------- */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.15});
$$(".reveal").forEach((el,i)=>{el.style.transitionDelay=(i%3)*90+"ms";io.observe(el)});

/* ---------- deteksi ---------- */
const stage=$("#stage"),cv=$("#cv"),ctx=cv.getContext("2d"),fileIn=$("#file");
let img=null,boxes=[],curFile=null;
const ALIAS={arabika:"arabica",liberika:"liberica"};
const norm=n=>{n=String(n).toLowerCase().trim();return ALIAS[n]||n};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue("--"+(["arabica","robusta","liberica"].includes(n)?n:"excelsa")).trim();
const msg=t=>{const m=$("#msg");m.textContent=t||"";m.style.display=t?"block":"none"};
const EMPTY='<div class="idle"><i class="orb"></i><strong>Belum ada hasil</strong><small>Pilih foto, lalu tekan Deteksi jenis kopi.</small></div>';
function setStep(n,label){
  $$(".step").forEach((s,i)=>{s.classList.toggle("done",i+1<n);s.classList.toggle("act",i+1===n)});
  const st=$("#status");st.dataset.s=n;st.querySelector("span").textContent=label||["Menunggu foto","Foto siap","Selesai"][n-1];
  if(n===1)$("#info").hidden=true;
}

const CFG=window.KOPILENS_CONFIG||{};
if(CFG.model)$("#model").value=CFG.model;
if(CFG.apiKey){$("#settings").hidden=true}   // key sudah diatur di config.js, sembunyikan kotak pengaturan
else{
  try{$("#key").value=localStorage.getItem("rf_key")||"";$("#model").value=localStorage.getItem("rf_model")||$("#model").value}catch(e){}
  $("#key").addEventListener("change",()=>{try{localStorage.setItem("rf_key",$("#key").value.trim())}catch(e){}});
  $("#model").addEventListener("change",()=>{try{localStorage.setItem("rf_model",$("#model").value.trim())}catch(e){}});
}

stage.addEventListener("click",()=>fileIn.click());
stage.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fileIn.click()}});
["dragenter","dragover"].forEach(v=>stage.addEventListener(v,e=>{e.preventDefault();stage.classList.add("drag")}));
["dragleave","drop"].forEach(v=>stage.addEventListener(v,e=>{e.preventDefault();stage.classList.remove("drag")}));
stage.addEventListener("drop",e=>{if(e.dataTransfer.files[0])load(e.dataTransfer.files[0])});
fileIn.addEventListener("change",()=>{if(fileIn.files[0])load(fileIn.files[0])});
$("#reset").addEventListener("click",()=>{img=null;boxes=[];cv.style.display="none";$("#hint").style.display="";
  $("#go").disabled=$("#reset").disabled=true;fileIn.value="";msg("");$("#result").innerHTML=EMPTY;setStep(1)});

function load(f){
  if(!f.type.startsWith("image/")){msg("File harus berupa gambar (JPG atau PNG).");return}
  const im=new Image();
  im.onload=()=>{
    const s=Math.min(1,1024/Math.max(im.width,im.height));
    cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);
    img=im;curFile=f;boxes=[];draw();
    cv.style.display="block";$("#hint").style.display="none";
    $("#go").disabled=$("#reset").disabled=false;msg("");$("#result").innerHTML=EMPTY;setStep(2);
    $("#info").textContent=f.name+"  ·  "+im.naturalWidth+"×"+im.naturalHeight+" px  ·  "+Math.round(f.size/1024)+" KB";$("#info").hidden=false;
  };
  im.onerror=()=>msg("Foto tidak bisa dibuka. Coba file JPG atau PNG lain.");
  im.src=URL.createObjectURL(f);
}
function draw(){
  ctx.fillStyle="#fff";ctx.fillRect(0,0,cv.width,cv.height);ctx.drawImage(img,0,0,cv.width,cv.height);
  boxes.forEach(b=>{
    const c=css(b.cls);ctx.lineWidth=3;ctx.strokeStyle=c;ctx.strokeRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);
    ctx.font="600 14px sans-serif";const t=b.cls+" "+Math.round(b.conf*100)+"%",tw=ctx.measureText(t).width+10;
    ctx.fillStyle=c;ctx.fillRect(b.x-b.w/2,b.y-b.h/2-20,tw,20);ctx.fillStyle="#fff";ctx.fillText(t,b.x-b.w/2+5,b.y-b.h/2-5);
  });
}
const toB64=f=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(",")[1]);r.onerror=no;r.readAsDataURL(f)});

$("#go").addEventListener("click",async()=>{
  const key=(CFG.apiKey||$("#key").value).trim(),model=(CFG.model||$("#model").value).trim();
  if(!key){$("#settings").open=true;msg("Isi API key Roboflow di Pengaturan model dulu.");return}
  if(!model){$("#settings").open=true;msg("Isi nama model, contoh: coffee-bean-tm9bq/1");return}
  msg("");$("#go").disabled=true;$("#go").textContent="Memproses…";stage.classList.add("busy");setStep(2,"Memindai…");
  try{
    let b64,sx=1;
    if(curFile&&curFile.size<=1500000&&/jpe?g|png/.test(curFile.type)){b64=await toB64(curFile);sx=cv.width/img.naturalWidth}
    else b64=cv.toDataURL("image/jpeg",.9).split(",")[1];
    boxes=[];draw();
    const [r]=await Promise.all([
      fetch("https://serverless.roboflow.com/"+model+"?api_key="+encodeURIComponent(key),
        {method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:b64}),
      new Promise(ok=>setTimeout(ok,reduce?0:1200))   // beri waktu animasi pemindaian
    ]);
    if(r.status===401||r.status===403)throw new Error("API key ditolak. Periksa kembali key di Pengaturan model.");
    if(r.status===404)throw new Error("Model tidak ditemukan. Periksa nama model dan nomor versinya.");
    if(!r.ok)throw new Error("Server Roboflow membalas error "+r.status+". Coba lagi sebentar lagi.");
    show(await r.json(),sx);
  }catch(e){msg(e instanceof TypeError?"Tidak bisa terhubung ke Roboflow. Periksa koneksi internet kamu.":e.message);setStep(2,"Gagal, coba lagi")}
  finally{$("#go").disabled=false;$("#go").textContent="Deteksi jenis kopi";stage.classList.remove("busy")}
});

function countUp(el,to){
  if(reduce){el.textContent=to+"%";return}
  const t0=performance.now();
  (function f(t){const k=Math.min(1,(t-t0)/900);el.textContent=Math.round(to*(1-Math.pow(1-k,3)))+"%";if(k<1)requestAnimationFrame(f)})(t0);
}
function show(d,sx=1){
  let p=d.predictions||[],list;
  if(Array.isArray(p)&&p.length&&p[0].width!==undefined){            // mode deteksi objek
    boxes=p.map(o=>({cls:norm(o.class),conf:o.confidence,x:o.x*sx,y:o.y*sx,w:o.width*sx,h:o.height*sx}));draw();
    const rows={};boxes.forEach(b=>{rows[b.cls]=rows[b.cls]||{n:0,s:0};rows[b.cls].n++;rows[b.cls].s+=b.conf});
    list=Object.entries(rows).map(([k,v])=>({cls:k,val:v.n/boxes.length,conf:v.s/v.n}));
  }else{                                                                // mode klasifikasi
    if(!Array.isArray(p))p=Object.entries(p).map(([k,v])=>({class:k,confidence:v.confidence}));
    list=p.map(o=>({cls:norm(o.class),val:o.confidence,conf:o.confidence}));
  }
  const box=$("#result");
  if(!list.length){box.innerHTML='<p class="empty">Tidak ada biji kopi yang terdeteksi. Coba foto yang lebih dekat dan terang.</p>';return}
  ["arabica","robusta","liberica"].forEach(k=>{if(!list.find(x=>x.cls===k))list.push({cls:k,val:0,conf:0})});
  list.sort((a,b)=>b.val-a.val);
  const top=list[0],sure=top.conf>=.5;setStep(3);
  box.innerHTML='<div class="vhead"><div class="gauge" id="gauge" style="--c:'+css(top.cls)+'"><b data-to="'+Math.round(top.conf*100)+'">0%</b></div><div>'
    +'<p class="verdict" style="--c:'+css(top.cls)+'">'+(sure?cap(top.cls):"Belum yakin")+'</p>'
    +'<p class="vsub">'+(sure?"Jenis paling mungkin di foto ini.":"Keyakinan rendah. Coba foto lain yang lebih jelas.")+'</p></div></div>'
    +'<div class="tiles">'+list.map((x,k)=>'<div class="tile'+(k===0&&sure?" win":"")+'" style="--c:'+css(x.cls)+';--k:'+k+'"><span class="nm">'+cap(x.cls)+'</span><b data-to="'+Math.round(x.val*100)+'">0%</b>'
    +'<div class="track"><div class="fill" data-w="'+Math.round(x.val*100)+'"></div></div></div>').join("")+'</div>'
    +'<details><summary>Detail teknis</summary><pre>'+JSON.stringify(d.predictions||d).slice(0,500).replace(/</g,"&lt;")+'</pre></details>';
  requestAnimationFrame(()=>{
    box.querySelectorAll(".fill").forEach(f=>f.style.width=f.dataset.w+"%");
    box.querySelectorAll("b[data-to]").forEach(b=>countUp(b,+b.dataset.to));
    $("#gauge").style.setProperty("--p",Math.round(top.conf*100));
    if(sure)burst($("#gauge"),css(top.cls));
  });
}

/* ===== upgrade wow ===== */
// judul muncul kata demi kata
const h1=$(".hero h1");
h1.innerHTML=h1.textContent.split(" ").map((w,i)=>'<span style="--i:'+i+'">'+w+'</span>').join("");

// bar progres scroll
addEventListener("scroll",()=>{
  const m=document.documentElement.scrollHeight-innerHeight;
  $("#progress").style.width=(m>0?scrollY/m*100:0)+"%";
},{passive:true});

// sorot kursor + biji kopi bergeser mengikuti mouse (parallax)
const bn=$$(".bean");
addEventListener("mousemove",e=>{
  const R=document.documentElement.style;R.setProperty("--mx",e.clientX+"px");R.setProperty("--my",e.clientY+"px");
  if(reduce)return;
  const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5;
  bn.forEach((b,i)=>{const k=(i%3+1)*22;b.style.setProperty("--px",(-x*k)+"px");b.style.setProperty("--py",(-y*k)+"px")});
});

// kartu jenis kopi miring 3D + kilau
$$(".type").forEach(el=>{
  el.addEventListener("mousemove",e=>{
    if(reduce)return;
    const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    el.style.transform="perspective(800px) rotateX("+(.5-y)*12+"deg) rotateY("+(x-.5)*14+"deg) translateY(-8px)";
    el.style.setProperty("--gx",x*100+"%");el.style.setProperty("--gy",y*100+"%");
  });
  el.addEventListener("mouseleave",()=>el.style.transform="");
});
// hapus jeda animasi muncul setelah selesai, supaya efek miring tidak tertunda
$$(".reveal").forEach(el=>new MutationObserver(()=>{if(el.classList.contains("in"))setTimeout(()=>el.style.transitionDelay="0ms",1000)}).observe(el,{attributes:true,attributeFilter:["class"]}));

// tombol hero magnetik
$$(".hero .btn").forEach(b=>{
  b.addEventListener("mousemove",e=>{if(reduce)return;const r=b.getBoundingClientRect();
    b.style.transform="translate("+(e.clientX-r.left-r.width/2)*.18+"px,"+(e.clientY-r.top-r.height/2)*.3+"px)"});
  b.addEventListener("mouseleave",()=>b.style.transform="");
});

// hujan biji kopi saat hasil yakin
function burst(el,c){
  if(reduce||!el)return;
  const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  for(let i=0;i<28;i++){
    const s=document.createElement("i");s.className="spark";
    s.style.cssText="left:"+cx+"px;top:"+cy+"px;background:"+(i%3?"radial-gradient(ellipse at 30% 25%,#a06a43,#3a1f10)":c);
    document.body.appendChild(s);
    const a=Math.random()*6.28,d=90+Math.random()*190;
    s.animate([{transform:"translate(-50%,-50%) scale(1)",opacity:1},
      {transform:"translate(calc(-50% + "+Math.cos(a)*d+"px),calc(-50% + "+(Math.sin(a)*d+70)+"px)) rotate("+Math.random()*540+"deg) scale(.6)",opacity:0}],
      {duration:900+Math.random()*600,easing:"cubic-bezier(.2,.8,.3,1)"}).onfinish=()=>s.remove();
  }
}

/* ===== riak gelombang saat tombol diklik ===== */
document.addEventListener("click",e=>{
  const b=e.target.closest(".btn");if(!b||b.disabled||reduce)return;
  const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height)*2.2,s=document.createElement("span");
  s.className="ripple";s.style.cssText="width:"+d+"px;height:"+d+"px;left:"+(e.clientX-r.left-d/2)+"px;top:"+(e.clientY-r.top-d/2)+"px";
  b.appendChild(s);setTimeout(()=>s.remove(),750);
});

setStep(1);