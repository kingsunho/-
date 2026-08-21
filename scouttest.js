/* 스카우트 투수 · 선수 카드 몸값 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s); w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n)}};
(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");
  // 몇 경기 돌려 리그 기록을 만든다
  ev(`(function(){ for(let i=0;i<6;i++){
    runWeek(); ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
    const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
    L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
    const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots); if(ST.seasonOver)break; } })()`);

  console.log('[스카우트 — 투수가 뜨나]');
  w.go('scout'); await wait(120);
  const teamBtn=[...d.querySelectorAll('#view .btn, #view .sc-team, #view button')]
    .filter(b=>!/뒤로|홈/.test(b.textContent));
  // 팀 하나 열기
  ev(`(function(){ const t=TEAMS.find(x=>x.id!=='wwzw'&&(x.pitchers||[]).length);
      scoutTeam=t.id; renderScout(); return t.name; })()`);
  await wait(120);
  let t=d.getElementById('view').textContent;
  const heads=[...d.querySelectorAll('#view .card-h')].map(x=>x.textContent);
  console.log('   카드:', heads.join(' | '));
  T('야수 카드가 있다', ()=>heads.some(h=>/야수$/.test(h)));
  T('투수 카드가 있다', ()=>heads.some(h=>/투수$/.test(h)) ? true : '!투수 카드 없음');
  T('투수 능력치가 나온다', ()=>/구위 \d+ · 제구 \d+ · 체력 \d+/.test(t));
  T('투수 몸값이 나온다', ()=>{
    const card=[...d.querySelectorAll('#view .card')].find(c=>/투수$/.test((c.querySelector('.card-h')||{}).textContent||''));
    if(!card) return '!카드 없음';
    const v=card.querySelector('.sc-v');
    return v && /만원/.test(v.textContent) ? v.textContent : '!'+(v?v.textContent:'없음');
  });
  T('투수도 접촉 버튼이 있다', ()=>{
    const card=[...d.querySelectorAll('#view .card')].find(c=>/투수$/.test((c.querySelector('.card-h')||{}).textContent||''));
    return card && card.querySelectorAll('.sc-b').length>0;
  });
  T('투타 겸업이 중복으로 안 나온다', ()=>ev(`(function(){
    const t=TEAMS.find(x=>x.id===scoutTeam);
    const dup=(t.pitchers||[]).filter(q=>t.players.some(x=>x.name===q.name));
    const shown=[...document.querySelectorAll('#view .card')]
      .filter(c=>/투수$/.test((c.querySelector('.card-h')||{}).textContent||''))
      .flatMap(c=>[...c.querySelectorAll('.sc-n')].map(x=>x.textContent));
    return dup.every(q=>!shown.includes(q.name));
  })()`));
  T('스카우트 이름이 눌린다', ()=>d.querySelectorAll('#view .sc-n .nml').length>0);
  T('undefined 없음', ()=>!/undefined|NaN/.test(t));

  console.log('\n[선수 카드 몸값]');
  const check=(pid,label)=>{
    ev(`openPlayerCard('${pid}')`);
    const b=d.getElementById('sheet-body').textContent;
    const v=d.querySelector('#sheet-body .pcs-val');
    const r=v?v.textContent:null;
    ev("closeSheet()");
    T(label, ()=>r&&/만원/.test(r) ? r : '!'+(r||'몸값 없음'));
    return b;
  };
  check('ksh','우리 팀 타자');
  check('swm','우리 팀 투수(겸업)');
  const oppB=ev("(function(){const t=TEAMS.find(x=>x.id!=='wwzw');return t.players[0].id})()");
  check(oppB,'상대 팀 타자');
  const oppP=ev("(function(){for(const t of TEAMS){if(t.id==='wwzw')continue;for(const q of (t.pitchers||[])){if(!t.players.some(x=>x.name===q.name))return q.id}}})()");
  if(oppP) check(oppP,'상대 팀 투수');
  else console.log('  (겸업 아닌 상대 투수 없음)');

  console.log('\n[기록실에서 눌러도 몸값이 보이나]');
  for(const [tab,label] of [['league','리그 타자'],['lgpit','리그 투수']]){
    ev(`statTab='${tab}'`); w.go('stats'); await wait(80);
    const l=d.querySelector('#view .nml');
    if(!l){ console.log(`  (${label} 표가 비었다)`); continue; }
    l.click(); await wait(50);
    const v=d.querySelector('#sheet-body .pcs-val');
    const title=d.getElementById('sheet-title').textContent;
    const clean=!/undefined|NaN/.test(d.getElementById('sheet-body').textContent);
    ev("closeSheet()");
    T(`${label} — 이름 누르면 몸값`, ()=>v&&clean ? `${title} ${v.textContent}` : (!v?'!몸값 없음':'!undefined 있음'));
  }
  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
