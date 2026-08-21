const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push(e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n);if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await new Promise(r=>setTimeout(r,50));
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await new Promise(r=>setTimeout(r,250));
  let played=0;
  for(let g=0;g<60 && played<14;g++){
    if(ev("ST.seasonOver"))break;
    ev("runWeek()");
    if(ev("ST.events.some(e=>e.type==='rain'||e.type==='postpone')")){ev("ST.weekDone=false;ST.events=[]");continue;}
    ev("autoFixLineup();applyDHRule();LIVE=makeLive();LIVE.manual=false;var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
    ev("(function(){const res=LIVE.result,nx=ST.schedule[ST.round];commitGame(res,nx.homeGame?res.home:res.away,nx.homeGame?res.away:res.home,(nx.homeGame?LIVE.home:LIVE.away).slots);})()");
    await new Promise(r=>setTimeout(r,12));played++;
  }
  const st=ev("ST.stand['wwzw']");
  console.log(`${played}경기 · ${st.w}승 ${st.l}패 ${st.t}무\n`);
  console.log('[투수 승패 기록]');
  const rows=ev("TBYID['wwzw'].pitchers.map(p=>({n:p.name,s:ST.pit[p.id]||blankPit()})).filter(x=>x.s.outs>0)");
  rows.forEach(r=>console.log(`   ${r.n} ${r.s.g}경기 ${r.s.gs}선발 ${r.s.w}승 ${r.s.l}패 ERA ${(r.s.er*7/(r.s.outs/3)).toFixed(2)}`));
  const tw=rows.reduce((a,r)=>a+r.s.w,0), tl=rows.reduce((a,r)=>a+r.s.l,0);
  console.log(`   합계 ${tw}승 ${tl}패 (팀 ${st.w}승 ${st.l}패)`);
  T('투수 승수 = 팀 승수', ()=>tw===st.w);
  T('투수 패수 = 팀 패수', ()=>tl===st.l);
  T('선발 등판(gs) 기록됨', ()=>rows.reduce((a,r)=>a+r.s.gs,0)===played);
  console.log('\n[통산 기록]');
  const car=ev("Object.keys(ST.career).map(id=>({n:nameOf(id),c:ST.career[id]})).filter(x=>x.c.pouts>0)");
  car.forEach(r=>console.log(`   ${r.n} 통산 ${r.c.pw}승 ${r.c.pl}패 ${(r.c.pouts/3).toFixed(1)}이닝`));
  T('통산 승수도 쌓임', ()=>car.reduce((a,r)=>a+r.c.pw,0)===st.w);
  console.log('\n[리그 투수 순위 승수]');
  const our=ev("TBYID['wwzw'].pitchers.filter(p=>ST.lgPit[p.id]&&ST.lgPit[p.id].w>0).map(p=>p.name+' '+ST.lgPit[p.id].w+'승')");
  console.log('   ', our.join(' ')||'(없음)');
  T('리그 기록에도 승수 반영', ()=>ev("TBYID['wwzw'].pitchers.reduce((a,p)=>a+((ST.lgPit[p.id]||{w:0}).w),0)")===st.w);
  console.log('\n[공짜진루 지수]');
  console.log('   마지막 경기:', ev("ST.lastFreePass"));
  T('공짜진루 지수 정상 범위', ()=>{const v=ev("ST.lastFreePass");return v>=0&&v<60;});
  ev("statTab='pitch'"); w.go('stats'); await new Promise(r=>setTimeout(r,40));
  T('기록 화면 클린', ()=>!/undefined|NaN/.test(d.getElementById('view').textContent));
  console.log(errs.length?'\n❌ '+errs.length+'건':'\n✅ 전체 통과');
  errs.forEach(e=>console.log('  - '+e));
  process.exit(errs.length?1:0);
},450);
