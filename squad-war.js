/* GENE WAR — squad command battlefield */
(function(){
"use strict";
var war=null, raf=0, last=0, logTimer=0;
var squadNames=["흑염 돌격대","철갑 수호대","심연 사냥대"];
var commands=["공격","방어","이동","후퇴"];
function ensureSquads(){
 if(!Array.isArray(state.squads)||state.squads.length!==3) state.squads=squadNames.map((name,i)=>({name,units:[],command:"공격"}));
 state.squads.forEach((s,i)=>{if(!s.name)s.name=squadNames[i];if(!Array.isArray(s.units))s.units=[];});
}
function allAssigned(id,except){return state.squads.some((s,i)=>s.units.includes(id));}
function squadSetup(){
 ensureSquads();
 var html='<div class="war-panel"><div class="war-heading"><div><span class="eyebrow">LEGION ORGANIZATION</span><h2>군단 편성</h2><p>각 부대는 최대 3마리로 구성돼. 전투 중에는 부대 전체를 하나의 단위로 지휘해.</p></div><div class="war-chip">3개 부대 · 부대당 3마리</div></div><div class="squad-setup-grid">';
 state.squads.forEach((s,i)=>{
  html+='<div class="squad-setup squad-'+i+'"><div class="squad-title"><span class="squad-symbol">'+["Ⅰ","Ⅱ","Ⅲ"][i]+'</span><div><b>'+s.name+'</b><small>'+s.units.length+'/3 배치</small></div></div>';
  for(var j=0;j<3;j++){
   var id=s.units[j]||"", opts='<option value="">비어 있음</option>'+state.units.map(u=>'<option value="'+u.id+'" '+(id===u.id?'selected':'')+'>'+u.name+' · Lv.'+u.level+'</option>').join("");
   html+='<label class="member-slot"><span>구성원 '+(j+1)+'</span><select onchange="GW.assign('+i+','+j+',this.value)">'+opts+'</select></label>';
  }
  html+='<div class="squad-foot">'+(s.units.length? s.units.map(id=>{var u=unit(id);return u?'<span>'+u.name+'</span>':""}).join(""):'<span class="empty-label">아직 배치된 생명체가 없어</span>')+'</div></div>';
 });
 html+='</div><div class="war-actions"><button onclick="GW.autoAssign()">⚔ 추천 편성</button><button class="primary" onclick="GW.start()">전투 시작</button></div></div>';
 html+='<div class="war-panel rules"><h3>전투 지휘 방법</h3><div class="rule-grid"><div><b>① 부대 선택</b><p>전장에 있는 아군 부대를 클릭</p></div><div><b>② 명령 내리기</b><p>이동할 땅이나 공격할 적 부대를 클릭</p></div><div><b>③ 전술 변경</b><p>공격·방어·이동·후퇴 명령 사용</p></div></div></div>';
 return html;
}
function battleScreen(){
 if(!war)return squadSetup();
 var html='<div class="war-panel battlefield-panel"><div class="war-heading"><div><span class="eyebrow">LIVE TACTICAL WARFARE · STAGE '+state.stage+'</span><h2>전장 지휘실</h2><p>아군 부대를 선택한 뒤 전장이나 적 부대를 클릭해 명령을 내려.</p></div><div class="war-chip">전투 시간 <b id="war-clock">0:00</b></div></div>';
 html+='<div class="battlefield-wrap"><canvas id="war-canvas" width="1100" height="570" aria-label="실시간 군단 전투 전장"></canvas><div class="battle-overlay"><span>아군 진영</span><span>적 진영</span></div></div>';
 html+='<div class="war-command-bar"><div class="selected-info"><b id="war-selected">부대를 선택해</b><small id="war-command-state">전장을 클릭하면 명령을 내릴 수 있어</small></div><div class="command-buttons"><button onclick="GW.command(\'공격\')">⚔ 공격</button><button onclick="GW.command(\'방어\')">🛡 방어</button><button onclick="GW.command(\'이동\')">➤ 이동</button><button onclick="GW.command(\'후퇴\')">↩ 후퇴</button><button class="skill-command" onclick="GW.command(\'특수기\')">✦ 부대 특수기</button></div><button class="pause-button" onclick="GW.pause()" id="war-pause">Ⅱ 일시정지</button></div>';
 html+='<div class="war-status-grid"><div><b>아군 부대</b><div id="war-allies" class="status-list"></div></div><div><b>적 군단</b><div id="war-enemies" class="status-list"></div></div></div>';
 html+='<div class="war-log" id="war-log"></div></div>';
 if(war.done)html+='<div class="war-result"><h2>'+(war.won?'승리!':'패배')+'</h2><p>'+(war.won?'적 군단을 격파했어. 생존한 생명체가 경험치를 얻었어.':'군단이 무너졌어. 부대 편성과 유전자 조합을 바꿔 다시 도전해 봐.')+'</p><button class="primary" onclick="GW.close()">전투 결과 확인</button></div>';
 return html;
}
function makeMember(u,side){
 var s=stats(u),max=s.hp;
 return {id:u.id,name:u.name,source:u,side:side,max:max,hp:max,atk:s.atk,def:s.def,speed:s.speed,cd:Math.random()*.7,alive:true};
}
function makeEnemySquad(i){
 var types=[
  {name:"황혼의 파멸룡",kind:"dragon",hp:170,atk:22,def:9,color:0},
  {name:"흑요석 마귀군",kind:"demon",hp:210,atk:18,def:14,color:1},
  {name:"핏빛 심연수",kind:"beast",hp:145,atk:27,def:7,color:2}
 ];
 var base=types[(state.stage+i-1)%types.length],scale=1+state.stage*.12;
 var members=[];
 for(var j=0;j<3;j++){
  var hp=Math.round(base.hp*scale*(j===0?1.25:.82));
  members.push({id:"enemy-"+i+"-"+j,name:base.name+(j===0?" 우두머리":j===1?" 파수꾼":" 추격자"),side:1,max:hp,hp:hp,atk:Math.round(base.atk*scale*(j===0?1.15:1)),def:Math.round(base.def*scale),speed:1+((j===2)?.25:0),cd:Math.random()*.8,alive:true,kind:base.kind,color:base.color});
 }
 return {id:"enemy-squad-"+i,side:1,name:base.name,kind:base.kind,color:base.color,x:850,y:145+i*140,targetX:850,targetY:145+i*140,command:"공격",members:members,selected:false,cool:0};
}
function start(){
 ensureSquads();
 var filled=state.squads.filter(s=>s.units.some(id=>unit(id)));
 if(!filled.length){toast("먼저 부대에 생명체를 배치해.");return;}
 war={allies:[],enemies:[],selected:0,paused:false,done:false,won:false,elapsed:0,logs:["전투 개시! 부대를 선택하고 명령을 내려."],lastLog:0,stage:state.stage};
 state.squads.forEach((s,i)=>{
  var members=s.units.map(id=>unit(id)).filter(Boolean).map(u=>makeMember(u,0));
  if(members.length)war.allies.push({id:"ally-"+i,side:0,name:s.name,x:210,y:145+i*140,targetX:210,targetY:145+i*140,command:"공격",members:members,selected:false,cool:0,index:i});
 });
 for(var i=0;i<3;i++)war.enemies.push(makeEnemySquad(i));
 war.selected=0;
 render();
 setTimeout(mount,60);
}
function log(s){if(!war)return;war.logs.push(s);if(war.logs.length>18)war.logs.shift();var el=document.getElementById("war-log");if(el)el.innerHTML=war.logs.slice(-8).map(x=>"<div>"+x+"</div>").join("");}
function alive(s){return s.members.filter(m=>m.hp>0);}
function squadAlive(s){return alive(s).length>0;}
function center(s){return {x:s.x,y:s.y};}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function nearest(from,list){var best=null,dist=1e9;list.forEach(s=>{if(!squadAlive(s))return;var d=distance(from,s);if(d<dist){dist=d;best=s;}});return best;}
function setCommand(cmd){
 if(!war||war.done)return;
 var s=war.allies[war.selected];if(!s)return;
 if(cmd==="특수기"){
  if(s.cool>0){log(s.name+" 특수기 재사용 대기 중");return;}
  var near=nearest(s,war.enemies);if(!near)return;
  var dmg=0;alive(s).forEach(m=>{var target=alive(near).sort((a,b)=>a.hp-b.hp)[0];if(target){var n=Math.max(1,Math.round(m.atk*1.8-target.def*.35));target.hp=Math.max(0,target.hp-n);dmg+=n;}});
  s.cool=16;log("✦ "+s.name+" 군단 특수기 발동! 총 "+dmg+" 피해");
  checkEnd();updateHud();return;
 }
 s.command=cmd;
 if(cmd==="후퇴"){s.targetX=90;s.targetY=s.y;log(s.name+" 후퇴 명령!");}
 else if(cmd==="방어"){s.targetX=s.x;s.targetY=s.y;log(s.name+" 방어 진형으로 전환");}
 else if(cmd==="공격"){var t=nearest(s,war.enemies);if(t){s.targetX=t.x-95;s.targetY=t.y;log(s.name+" 공격 명령 → "+t.name);}}
 else if(cmd==="이동"){s.command="이동";log(s.name+" 이동 대기. 전장을 클릭해 위치를 지정해.");}
 updateHud();
}
function moveOrder(x,y){
 if(!war||war.done)return;
 var s=war.allies[war.selected];if(!s)return;
 s.command="이동";s.targetX=Math.max(55,Math.min(520,x));s.targetY=Math.max(65,Math.min(505,y));log(s.name+" 이동 → 지정 위치");
 updateHud();
}
function targetOrder(enemy){
 var s=war.allies[war.selected];if(!s||!enemy)return;
 s.command="공격";s.targetX=enemy.x-90;s.targetY=enemy.y; s.focus=enemy.id;
 log(s.name+" 집중 공격 → "+enemy.name);updateHud();
}
function commandClick(cmd){if(cmd==="이동"){setCommand(cmd);return;}setCommand(cmd);}
function updateHud(){
 if(!war)return;
 var s=war.allies[war.selected],a=document.getElementById("war-selected"),b=document.getElementById("war-command-state");
 if(a)a.textContent=s?s.name:"부대 없음";
 if(b)b.textContent=s?"명령: "+s.command+" · 생존 "+alive(s).length+"/"+s.members.length+" · 특수기 "+(s.cool>0?Math.ceil(s.cool)+"초":"사용 가능"):"";
 var al=document.getElementById("war-allies"),en=document.getElementById("war-enemies");
 if(al)al.innerHTML=war.allies.map((x,i)=>'<button class="status-unit '+(i===war.selected?'chosen':'')+'" onclick="GW.select('+i+')"><b>'+x.name+'</b><span>'+alive(x).length+'/'+x.members.length+' 생존</span><small>'+x.command+'</small></button>').join("");
 if(en)en.innerHTML=war.enemies.map(x=>'<div class="status-unit enemy-status"><b>'+x.name+'</b><span>'+alive(x).length+'/3 생존</span><small>'+Math.round(alive(x).reduce((n,m)=>n+m.hp,0))+' HP</small></div>').join("");
 var logEl=document.getElementById("war-log");if(logEl)logEl.innerHTML=war.logs.slice(-8).map(x=>"<div>"+x+"</div>").join("");
}
function select(i){if(!war||!war.allies[i])return;war.selected=i;war.allies.forEach((s,j)=>s.selected=j===i);updateHud();}
function checkEnd(){
 if(!war||war.done)return;
 var a=war.allies.some(s=>squadAlive(s)),e=war.enemies.some(s=>squadAlive(s));
 if(!e||!a){
  war.done=true;war.won=!e;cancelAnimationFrame(raf);
  if(war.won){
   var st=war.stage,gold=85+st*20,data=18+st*4,energy=25+st*3;
   state.gold+=gold;state.data+=data;state.energy+=energy;state.wins++;state.stage++;
   war.allies.forEach(s=>alive(s).forEach(m=>{var u=unit(m.id);if(u){u.xp+=35+st*6;while(u.xp>=u.level*35){u.xp-=u.level*35;u.level++;}}}));
   state.log.push("스테이지 "+st+" 군단 전쟁 승리! 보상 획득");
   log("승리 보상: 골드 +"+gold+" · 연구 데이터 +"+data+" · 에너지 +"+energy);
  }else{state.energy+=12;state.log.push("스테이지 "+state.stage+" 군단 전쟁 패배");log("군단 패배. 부대 구성과 지휘를 다시 점검해 봐.");}
  save();render();setTimeout(mount,60);
 }
}
function update(dt){
 if(!war||war.paused||war.done)return;
 war.elapsed+=dt;
 war.allies.concat(war.enemies).forEach(s=>{
  if(!squadAlive(s))return;
  s.cool=Math.max(0,s.cool-dt);
  if(s.side===1){
   var prey=nearest(s,war.allies);if(prey){s.targetX=prey.x+90;s.targetY=prey.y;}
  }else if(s.command==="공격"&&!s.focus){
   var foe=nearest(s,war.enemies);if(foe){s.targetX=foe.x-90;s.targetY=foe.y;}
  }
  if(s.command!=="방어"||s.side===1){
   var dx=s.targetX-s.x,dy=s.targetY-s.y,d=Math.hypot(dx,dy);
   if(d>12){var speed=(s.side?47:55)*dt;s.x+=dx/d*Math.min(speed,d);s.y+=dy/d*Math.min(speed,d);}
  }
  s.members.forEach(m=>{
   if(m.hp<=0)return;m.cd-=dt;
   var enemies=s.side?war.allies:war.enemies;
   var targets=enemies.filter(x=>squadAlive(x)).flatMap(x=>alive(x).map(m=>({m,s:x})));
   if(!targets.length)return;
   var target=null;
   if(!s.side&&s.focus){var focused=war.enemies.find(x=>x.id===s.focus);if(focused&&squadAlive(focused))target=alive(focused).sort((a,b)=>a.hp-b.hp)[0];}
   if(!target){targets.sort((a,b)=>Math.hypot(a.s.x-s.x,a.s.y-s.y)-Math.hypot(b.s.x-s.x,b.s.y-s.y));target=targets[0].m;}
   var targetSquad=enemies.find(x=>x.members.includes(target));if(!targetSquad)return;
   var range=72+(m.source&&m.source.speed>1.4?18:0);
   if(distance(s,targetSquad)<range+18&&m.cd<=0){
    var dmg=Math.max(1,Math.round(m.atk*(.88+Math.random()*.25)-target.def*.38));
    if(s.command==="방어"&&!s.side)dmg=Math.max(1,Math.round(dmg*.8));
    target.hp=Math.max(0,target.hp-dmg);m.cd=Math.max(.42,1.2-(m.speed||1)*.28);
    if(Math.random()<.14)log(m.name+"의 강타! "+dmg+" 피해");
    if(target.hp<=0)log(target.name+" 전투 불능!");
   }
  });
 });
 checkEnd();
}
function drawBackground(ctx,w,h){
 var g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,"#202d38");g.addColorStop(.48,"#31453d");g.addColorStop(1,"#172b2c");ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 for(var i=0;i<90;i++){var x=(i*137)%w,y=(i*83)%h;ctx.fillStyle=i%3===0?"#b9b18a18":"#050e121c";ctx.beginPath();ctx.ellipse(x,y,18+(i%5)*5,5+(i%4)*2,(i%9)/5,0,Math.PI*2);ctx.fill();}
 ctx.strokeStyle="#d6c59b22";ctx.lineWidth=2;for(var x=55;x<w;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(var y=45;y<h;y+=65){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 ctx.fillStyle="#d7c9a51a";ctx.fillRect(w/2-2,0,4,h);
 ctx.fillStyle="#73b8a51b";ctx.fillRect(0,0,w/2,h);ctx.fillStyle="#bd65501b";ctx.fillRect(w/2,0,w/2,h);
}
function drawBeast(ctx,x,y,scale,kind,color,hp,max,side,dead){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 var palettes=[["#7aafc4","#31556f","#c7ecdc"],["#b77a5e","#4d2930","#f1b37c"],["#8d8aaf","#3b365c","#d9c5ff"]];
 var p=palettes[color||0],body=ctx.createRadialGradient(-8,-19,4,0,0,47);body.addColorStop(0,p[0]);body.addColorStop(.55,p[1]);body.addColorStop(1,"#10131d");
 ctx.globalAlpha=dead?.2:1;
 ctx.fillStyle="#090e13";ctx.beginPath();ctx.ellipse(0,30,43,11,0,0,Math.PI*2);ctx.fill();
 // tail
 ctx.strokeStyle=p[1];ctx.lineWidth=13;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-29,12);ctx.quadraticCurveTo(-58,20,-67,-9);ctx.stroke();
 ctx.fillStyle=p[1];ctx.beginPath();ctx.moveTo(-63,-7);ctx.lineTo(-76,-20);ctx.lineTo(-68,1);ctx.closePath();ctx.fill();
 // wings with membrane ribs
 ctx.fillStyle=p[1];ctx.strokeStyle=p[2];ctx.lineWidth=2;
 [-1,1].forEach(dir=>{ctx.save();ctx.scale(dir,1);ctx.beginPath();ctx.moveTo(-9,-15);ctx.quadraticCurveTo(-23,-64,-72,-56);ctx.lineTo(-57,-27);ctx.lineTo(-70,-18);ctx.lineTo(-37,-7);ctx.lineTo(-22,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle=p[2]+"99";ctx.beginPath();ctx.moveTo(-12,-13);ctx.lineTo(-67,-54);ctx.moveTo(-20,-8);ctx.lineTo(-58,-27);ctx.moveTo(-26,0);ctx.lineTo(-69,-18);ctx.stroke();ctx.restore();});
 // legs and claws
 ctx.strokeStyle=p[1];ctx.lineWidth=10;ctx.lineCap="round";[[-22,15],[22,15]].forEach(q=>{ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.lineTo(q[0]-5,34);ctx.stroke();ctx.strokeStyle=p[2];ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(q[0]-5,34);ctx.lineTo(q[0]-11,39);ctx.moveTo(q[0]-5,34);ctx.lineTo(q[0]+1,40);ctx.stroke();ctx.strokeStyle=p[1];ctx.lineWidth=10;});
 // torso
 ctx.fillStyle=body;ctx.strokeStyle=p[2];ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(-39,-16);ctx.quadraticCurveTo(-42,-39,-12,-43);ctx.lineTo(16,-40);ctx.quadraticCurveTo(42,-27,38,5);ctx.quadraticCurveTo(20,28,-18,23);ctx.quadraticCurveTo(-43,12,-39,-16);ctx.fill();ctx.stroke();
 // armor plates
 for(var i=0;i<5;i++){ctx.fillStyle=i%2?p[0]:p[1];ctx.beginPath();ctx.moveTo(-28+i*13,-25+(i%2)*4);ctx.lineTo(-20+i*13,-38);ctx.lineTo(-10+i*13,-24);ctx.closePath();ctx.fill();}
 // neck/head
 ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(18,-27);ctx.quadraticCurveTo(32,-48,49,-39);ctx.lineTo(61,-25);ctx.lineTo(48,-12);ctx.lineTo(22,-11);ctx.closePath();ctx.fill();ctx.stroke();
 // horns
 ctx.fillStyle=p[2];ctx.beginPath();ctx.moveTo(35,-39);ctx.quadraticCurveTo(34,-62,20,-68);ctx.quadraticCurveTo(45,-59,46,-39);ctx.fill();ctx.beginPath();ctx.moveTo(47,-37);ctx.quadraticCurveTo(62,-58,72,-55);ctx.quadraticCurveTo(57,-47,57,-31);ctx.fill();
 // eye glow
 ctx.shadowColor="#ffd879";ctx.shadowBlur=13;ctx.fillStyle="#ffe8a1";ctx.beginPath();ctx.ellipse(48,-29,5,2.8,-.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle="#14131b";ctx.beginPath();ctx.moveTo(52,-17);ctx.lineTo(69,-20);ctx.lineTo(60,-11);ctx.closePath();ctx.fill();
 // chest sigil
 ctx.shadowColor=p[2];ctx.shadowBlur=9;ctx.fillStyle=p[2];ctx.beginPath();ctx.arc(0,-2,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
 ctx.restore();
 // hp indicator
 if(!dead){ctx.fillStyle="#111820";ctx.fillRect(x-34*scale,y+45*scale,68*scale,5*scale);ctx.fillStyle=side?"#db765f":"#78d5b5";ctx.fillRect(x-34*scale,y+45*scale,68*scale*Math.max(0,hp/max),5*scale);}
}
function drawSquad(ctx,s,side){
 var members=alive(s),offsets=[[-18,0],[16,-13],[16,13]];
 members.forEach((m,i)=>{
  var o=offsets[i]||[0,0],x=s.x+o[0],y=s.y+o[1];
  if(side)drawBeast(ctx,x,y,0.72,m.kind||"dragon",m.color||0,m.hp,m.max,1,m.hp<=0);
  else{
   var g=m.source.g,kind=expressed(g,"C")?"dragon":expressed(g,"B")?"demon":"beast",color=expressed(g,"A")?0:expressed(g,"B")?1:2;
   drawBeast(ctx,x,y,0.72,kind,color,m.hp,m.max,0,m.hp<=0);
  }
 });
 ctx.save();ctx.font="bold 13px system-ui";ctx.textAlign="center";ctx.fillStyle="#f5f0dc";ctx.shadowColor="#111";ctx.shadowBlur=5;ctx.fillText(s.name,s.x,s.y-58);ctx.shadowBlur=0;
 if(!side&&war.allies[war.selected]===s){ctx.strokeStyle="#ffe39a";ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.beginPath();ctx.ellipse(s.x,s.y,75,55,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
 ctx.restore();
}
function draw(){
 var c=document.getElementById("war-canvas");if(!c||!war)return;var ctx=c.getContext("2d"),w=c.width,h=c.height;
 drawBackground(ctx,w,h);
 // terrain ruins and scattered stones
 for(var i=0;i<12;i++){var x=(i*191+73)%w,y=(i*97+50)%h;ctx.fillStyle="#101a1d88";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+17,y-9);ctx.lineTo(x+30,y+7);ctx.lineTo(x+7,y+13);ctx.closePath();ctx.fill();}
 war.allies.forEach(s=>drawSquad(ctx,s,0));war.enemies.forEach(s=>drawSquad(ctx,s,1));
 ctx.fillStyle="#e7dfc0";ctx.font="bold 14px system-ui";ctx.fillText("YOUR LEGION",22,26);ctx.textAlign="right";ctx.fillText("ENEMY LEGION",w-22,26);ctx.textAlign="left";
 if(war.paused){ctx.fillStyle="#080d12aa";ctx.fillRect(0,0,w,h);ctx.fillStyle="#fff";ctx.font="bold 38px system-ui";ctx.textAlign="center";ctx.fillText("PAUSED",w/2,h/2);ctx.textAlign="left";}
}
function attachCanvas(){
 if(!war)return;var c=document.getElementById("war-canvas");if(!c)return;
 c.onclick=function(e){
  var r=c.getBoundingClientRect(),x=(e.clientX-r.left)*c.width/r.width,y=(e.clientY-r.top)*c.height/r.height;
  var enemy=war.enemies.find(s=>squadAlive(s)&&Math.hypot(s.x-x,s.y-y)<82);
  if(enemy){targetOrder(enemy);return;}
  var ally=war.allies.findIndex(s=>squadAlive(s)&&Math.hypot(s.x-x,s.y-y)<75);
  if(ally>=0){select(ally);return;}
  if(war.allies[war.selected])moveOrder(x,y);
 };
 updateHud();draw();
 if(!raf){last=performance.now();raf=requestAnimationFrame(loop);}
}
function loop(t){
 if(!war){raf=0;return;}var dt=Math.min(.05,(t-last)/1000||0);last=t;
 if(!war.paused&&!war.done)update(dt);
 draw();
 var clock=document.getElementById("war-clock");if(clock){var sec=Math.floor(war.elapsed);clock.textContent=Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");}
 if(war.done){raf=0;return;}
 raf=requestAnimationFrame(loop);
}
function pause(){if(!war||war.done)return;war.paused=!war.paused;var b=document.getElementById("war-pause");if(b)b.textContent=war.paused?"▶ 계속":"Ⅱ 일시정지";draw();}
function close(){war=null;cancelAnimationFrame(raf);raf=0;render();}
function autoAssign(){
 ensureSquads();state.squads.forEach(s=>s.units=[]);
 var sorted=state.units.slice().sort((a,b)=>{var x=stats(a),y=stats(b);return(y.hp+y.atk*4+y.def*3)-(x.hp+x.atk*4+x.def*3);});
 sorted.slice(0,9).forEach((u,i)=>state.squads[Math.floor(i/3)].units.push(u.id));
 save();render();
}
function assign(si,mi,id){
 ensureSquads();if(id&&allAssigned(id,si)){toast("한 생명체를 여러 부대에 중복 배치할 수 없어.");render();return;}
 var s=state.squads[si];if(id&&s.units[mi]!==id&&allAssigned(id,si)){toast("한 생명체는 한 부대에만 배치할 수 있어.");render();return;}s.units[mi]=id||null;s.units=s.units.filter(Boolean);
 // preserve selected slot order while compacting
 save();render();
}
function mount(){if(war&&!war.done)attachCanvas();}
var oldRender=render;
render=function(){oldRender();if(tab==="군단·전투"&&war)setTimeout(mount,20);};
battleView=function(){return battleScreen();};
fight=function(){start();};
window.GW={assign:assign,autoAssign:autoAssign,start:start,select:select,command:commandClick,pause:pause,close:close};
ensureSquads();
render();
})();