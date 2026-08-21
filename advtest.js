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

  console.log('[일정 — 불규칙 간격]');
  const dates=ev("seasonDates(2026).map(d=>(d.getMonth()+1)+'/'+d.getDate())");
  console.log('   ', dates.slice(0,14).join(' → '));
  const gaps=ev("(function(){const ds=seasonDates(2026);const g=[];for(let i=1;i<ds.length;i++)g.push(Math.round((ds[i]-ds[i-1])/(7*86400000)));return g})()");
  console.log('   간격(주):', gaps.slice(0,14).join(' '));
  T('간격이 균등하지 않다', ()=>new Set(gaps).size>=3);
  T('1~4주 범위', ()=>gaps.every(g=>g>=1&&g<=4));
  T('2~9월 안에 22경기 이상', ()=>dates.length>=22);
  T('전부 일요일', ()=>ev("seasonDates(2026).every(d=>d.getDay()===0)"));
  T('같은 연도면 항상 같은 일정', ()=>JSON.stringify(ev("seasonDates(2026).map(d=>+d)"))===JSON.stringify(ev("seasonDates(2026).map(d=>+d)")));
  console.log('   간격 문구:', [1,2,3,4,5].map(i=>ev(`gapLabel(${i},2026)`)).join(' / '));

  console.log('\n[시즌 12경기 진행]');
  let played=0;
  for(let g=0;g<60&&played<12;g++){
    if(ev("ST.seasonOver"))break;
    ev("runWeek()");
    if(ev("ST.events.some(e=>e.type==='rain'||e.type==='postpone')")){ev("ST.weekDone=false;ST.events=[]");continue;}
    ev("autoFixLineup();applyDHRule();LIVE=makeLive();LIVE.manual=false;var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
    ev("(function(){const res=LIVE.result,nx=ST.schedule[ST.round];commitGame(res,nx.homeGame?res.home:res.away,nx.homeGame?res.away:res.home,(nx.homeGame?LIVE.home:LIVE.away).slots);})()");
    await new Promise(r=>setTimeout(r,12));played++;
  }
  console.log('   ', played+'경기');

  console.log('\n[wRC+ / WAR]');
  const lgw=ev("leagueWoba()");
  console.log('   리그 wOBA:', lgw.woba.toFixed(3));
  const rows=ev(`TBYID['wwzw'].players.map(p=>({n:p.name,id:p.id,b:ST.bat[p.id]||blankBat()})).filter(x=>x.b.pa>=8)
    .map(x=>({n:x.n,pa:x.b.pa,avg:avg(x.b),wrc:wrcPlus(x.b,leagueWoba()),war:warOf(x.id,x.b,leagueWoba())}))
    .sort((a,b)=>b.wrc-a.wrc)`);
  rows.forEach(r=>console.log(`   ${r.n.padEnd(4)} ${String(r.pa).padStart(3)}타석 ${r.avg.toFixed(3)} wRC+ ${String(r.wrc).padStart(4)} WAR ${r.war.toFixed(2)}`));
  T('wRC+ 계산됨', ()=>rows.length>0&&rows.every(r=>Number.isFinite(r.wrc)));
  T('리그 평균 근처가 100', ()=>{
    const all=ev(`(function(){const L=leagueWoba();let s=0,n=0;
      Object.keys(ST.lgBat).forEach(id=>{const b=ST.lgBat[id];if(b.pa>=15){s+=wrcPlus(b,L);n++}});return s/n})()`);
    console.log('   리그 규정타석 평균 wRC+:', all.toFixed(1));
    return Math.abs(all-100)<12;});
  T('WAR 유한값', ()=>rows.every(r=>Number.isFinite(r.war)));
  T('잘하는 선수가 WAR 높다', ()=>rows[0].war>=rows[rows.length-1].war);
  const pw=ev(`TBYID['wwzw'].pitchers.map(p=>({n:p.name,s:ST.pit[p.id]||blankPit()})).filter(x=>x.s.outs>6)
    .map(x=>({n:x.n,era:(x.s.er*7)/(x.s.outs/3),war:warPit(x.s,leagueEra())}))`);
  console.log('   투수 WAR:', pw.map(x=>`${x.n} ERA${x.era.toFixed(2)} WAR${x.war.toFixed(2)}`).join(' / '));
  T('투수 WAR 계산', ()=>pw.every(x=>Number.isFinite(x.war)));
  T('ERA 낮을수록 WAR 높다', ()=>{const s=pw.slice().sort((a,b)=>a.era-b.era);return s.length<2||s[0].war>=s[s.length-1].war;});

  console.log('\n[몸값 실시간 변동]');
  const vals=ev(`TBYID['wwzw'].players.filter(p=>!isMerc(p.id)).map(p=>({n:p.name,
    v:playerValue(p,META[p.id],ST.bat[p.id]), prev:(ST.valuePrev||{})[p.id]}))`);
  vals.slice(0,6).forEach(v=>console.log(`   ${v.n} ${v.v.toFixed(1)}만원${v.prev!=null?` (직전 ${v.prev.toFixed(1)})`:''}`));
  T('valuePrev 스냅샷 존재', ()=>ev("Object.keys(ST.valuePrev||{}).length")>0);
  // 성적을 크게 바꾸면 몸값이 움직인다
  const p0=ev("playerValue(TBYID['wwzw'].players[0],META[TBYID['wwzw'].players[0].id],ST.bat[TBYID['wwzw'].players[0].id])");
  ev("(function(){const id=TBYID['wwzw'].players[0].id;const b=ST.bat[id];b.g=12;b.pa=50;b.ab=45;b.h=30;b.d2=8;b.d3=2;b.hr=3;b.bb=5;})()");
  const p1=ev("playerValue(TBYID['wwzw'].players[0],META[TBYID['wwzw'].players[0].id],ST.bat[TBYID['wwzw'].players[0].id])");
  console.log(`   성적 급상승 시 ${p0.toFixed(1)} → ${p1.toFixed(1)}만원`);
  T('성적 좋아지면 몸값 상승', ()=>p1>p0);
  ev("(function(){const id=TBYID['wwzw'].players[0].id;const b=ST.bat[id];b.h=3;b.d2=0;b.d3=0;b.hr=0;b.bb=1;})()");
  const p2=ev("playerValue(TBYID['wwzw'].players[0],META[TBYID['wwzw'].players[0].id],ST.bat[TBYID['wwzw'].players[0].id])");
  console.log(`   성적 급락 시 → ${p2.toFixed(1)}만원`);
  T('성적 나빠지면 몸값 하락', ()=>p2<p1);
  w.go('squad'); await new Promise(r=>setTimeout(r,50));
  T('선수단에 wRC+/WAR 표시', ()=>/wRC\+/.test(d.getElementById('view').textContent)&&/WAR/.test(d.getElementById('view').textContent));
  T('WAR 정렬 탭', ()=>[...d.querySelectorAll('#view .subtab')].some(b=>b.textContent==='WAR'));

  console.log('\n[감독 면담]');
  ev("ST.bossTalk=null;ST.bossTalkCount=0;ST.bossTalkAt=-99;");
  console.log('   내 성적:', JSON.stringify(ev("myGrade()")));
  let got=0;
  for(let i=0;i<40&&!ev("ST.bossTalk");i++){ev("ST.bossTalkAt=-99;rollBossTalk()");}
  T('면담 발생', ()=>!!ev("ST.bossTalk"));
  if(ev("ST.bossTalk")){
    console.log('   등급:', ev("ST.bossTalk.tier"), '/ 감독:', ev("nameOf(ST.bossTalk.boss)"));
    console.log('   ', ev("ST.bossTalk.log.map(m=>m.text.replace(/\\n/g,' / ')).join(' | ')"));
    T('감독이 플레이어가 아니다', ()=>ev("ST.bossTalk.boss")!==ev("ST.playerId"));
    w.go('home'); await new Promise(r=>setTimeout(r,50));
    T('홈에 면담 카드', ()=>/에게서 카톡/.test(d.getElementById('view').textContent));
    const opts=[...d.querySelectorAll('#view .bossopt')];
    T('선택지 3개', ()=>d.querySelectorAll('#view .bossopt').length===3);
    const m0=ev("ST.morale[ST.playerId]");
    opts[0].click(); await new Promise(r=>setTimeout(r,50));
    T('사기 변동', ()=>ev("ST.morale[ST.playerId]")!==m0);
    T('감독 답변 추가', ()=>ev("ST.bossTalk.log.length")>=5);
    console.log('   ', ev("ST.bossTalk.log.slice(-3).map(m=>m.text.replace(/\\n/g,' / ')).join(' | ')"));
    T('카운터 증가', ()=>ev("ST.bossTalkCount")===1);
    ev("ST.bossTalk=null");
  }
  // 못하는 등급이면 이모티콘
  ev("ST.bossTalk={boss:'lg',tier:'bad',wrc:40,pa:20,avg:.1,ops:.3,step:0,log:[{who:'lg',text:sayTo('lg',ST.playerId,...pickOne(BOSS_BAD))}]}");
  console.log('   화난 대사 예:', ev("ST.bossTalk.log[0].text"));
  T('못하면 이모티콘 사용', ()=>{
    for(let i=0;i<30;i++){const t=ev("pickOne(BOSS_BAD)[0]");if(/😤|😡|😠|🤬/.test(t))return true;}
    return false;});
  ev("ST.bossTalk=null");
  T('시즌 2회 제한', ()=>{ev("ST.bossTalkCount=2;ST.bossTalkAt=-99;rollBossTalk()");return !ev("ST.bossTalk");});

  console.log('\n[세이브 왕복 + 전 화면]');
  ev("saveGame(true)"); await new Promise(r=>setTimeout(r,50));
  const raw=ev("JSON.stringify(ST)");
  ev(`ST=JSON.parse(${JSON.stringify(raw)});normalizeState();`);
  for(const v of ['home','squad','lineup','game','train','scout','stand','stats','records','more','kakao']){
    w.go(v);await new Promise(r=>setTimeout(r,25));
    const x=d.getElementById('view');
    if(x.textContent.trim().length<5)errs.push(v+' 비어있음');
    if(/undefined|NaN/.test(x.textContent))errs.push(v+' undefined/NaN');
  }
  for(const t of ['team','pitch','league','lgpit']){
    ev(`statTab='${t}'`); w.go('stats'); await new Promise(r=>setTimeout(r,30));
    if(/undefined|NaN/.test(d.getElementById('view').textContent))errs.push('stats/'+t);
  }
  T('전 화면·전 탭 클린', ()=>true);
  console.log(errs.length?'\n❌ '+errs.length+'건':'\n✅ 전체 통과');
  errs.forEach(e=>console.log('  - '+e));
  process.exit(errs.length?1:0);
},450);
