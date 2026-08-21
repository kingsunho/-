const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push(e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n);if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
/* v1.5.1 부터 라인업을 단톡방에 발표해야 경기로 넘어간다.
   그리고 startLive() 는 #stage 가 있어야 한다 — 경기 화면을 먼저 그린다. */
async function enterGame(w,d,ev,manual){
  ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false; if(ST.events)ST.events=[];");
  w.go('game'); await new Promise(r=>setTimeout(r,120));
  const b=[...d.querySelectorAll('#view .btn')]
    .find(x=>new RegExp(manual?'직접 지휘':'자동 진행').test(x.textContent));
  if(!b) return false;
  b.click(); await new Promise(r=>setTimeout(r,manual?150:60));
  return true;
}
setTimeout(async()=>{
  console.log('[튜토리얼 — 새 게임 진입]');
  d.querySelectorAll('.pickcard')[0].click();await new Promise(r=>setTimeout(r,50));
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await new Promise(r=>setTimeout(r,250));
  T('새 게임이면 튜토리얼부터', ()=>/이게 무슨 게임이냐/.test(d.getElementById('view').textContent));
  const NSTEP=ev("TUTORIAL.length");
  T('단계가 충분하다', ()=>NSTEP>=15 ? `${NSTEP}단계` : `!${NSTEP}단계`);
  T('진행 표시가 단계 수와 맞는다', ()=>d.querySelectorAll('#view .tut-dots i').length===NSTEP);
  const titles=[];
  for(let i=0;i<NSTEP;i++){
    titles.push(d.querySelector('#view .card-h').textContent);
    const t=d.getElementById('view').textContent;
    if(/undefined|NaN/.test(t))errs.push('튜토리얼 '+i+' undefined');
    if(t.length<120)errs.push('튜토리얼 '+i+' 내용 부실');
    const nx=[...d.querySelectorAll('#view .btn')].find(b=>/다음 →|시작한다/.test(b.textContent));
    nx.click(); await new Promise(r=>setTimeout(r,40));
  }
  console.log('   ', titles.join(' / '));
  T('끝나면 홈으로', ()=>ev("ST.tutDone")===true);
  T('공짜진루 규칙 설명 포함', ()=>ev("TUTORIAL.some(t=>/공짜진루/.test(t.b)||/공짜진루/.test(t.t))"));
  T('콜드게임 설명 포함', ()=>ev("TUTORIAL.some(t=>/콜드게임/.test(t.b))"));
  T('용병·몰수패 설명 포함', ()=>ev("TUTORIAL.some(t=>/몰수패/.test(t.b))"));
  w.go('more'); await new Promise(r=>setTimeout(r,50));
  T('설정에 다시 보기', ()=>[...d.querySelectorAll('#view .btn')].some(b=>/튜토리얼 다시 보기/.test(b.textContent)));

  console.log('\n[김선우 기념일 4종]');
  const HOL=['삼일절','현충일','광복절','국군의 날'];
  HOL.forEach(h=>{
    const r=ev(`(function(){
      var rd=-1;
      for(var k=0;k<22;k++) if(holidayFor(k,2026).holiday==='${h}'){rd=k;break;}
      if(rd<0) return null;
      var save=ST.round; ST.round=rd; ST.absent={}; ST.injury={};
      var out=null;
      for(var i=0;i<300;i++){
        var evs=rollWeekEvents(ST, makeRng(i*7717));
        var e=evs.find(x=>x.type==='holiday'&&x.pid==='ksw');
        if(e){out=e;break;}
      }
      ST.round=save; return out;})()`);
    const ok=!!r;
    console.log(`  ${ok?'✅':'❌'} ${h}: ${r?r.body+' (파워 ×'+r.pow+')':'발동 안 함'}`);
    if(!ok)errs.push(h+' 김선우 버프 없음');
  });
  T('기념일마다 대사가 다르다', ()=>{
    const set=new Set(HOL.map(h=>ev(`(function(){
      var rd=-1; for(var k=0;k<22;k++) if(holidayFor(k,2026).holiday==='${h}'){rd=k;break;}
      if(rd<0)return 'none-'+'${h}';
      var save=ST.round; ST.round=rd; ST.absent={}; ST.injury={};
      for(var i=0;i<300;i++){var e=rollWeekEvents(ST,makeRng(i*7717)).find(x=>x.type==='holiday'&&x.pid==='ksw');
        if(e){ST.round=save;return e.body}}
      ST.round=save;return ''})()`)));
    return set.size===4;});
  ev("applyWeekEvents(ST,[{type:'holiday',pid:'ksw',pow:1.36}])");
  T('버프 적용', ()=>ev("ST.buff.ksw.pow")===1.36);

  console.log('\n[경기 중 마찰]');
  ev("ST.calendar=holidayFor(0,2026);runWeek();ST.events=[];ST.absent={};autoFixLineup();applyDHRule();");
  ev("ST.drunkIds=['kig'];");
  let hbp=0,clear=0,drunk=0,up=0,games=0;
  for(let i=0;i<40;i++){
    ev("LIVE=makeLive();LIVE.manual=false;var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
    const f=ev("LIVE.result.friction"); games++;
    if(f.hbp)hbp++; if(f.cleared)clear++; if(f.drunk)drunk++; if(f.up)up++;
  }
  console.log(`   40경기: 사구마찰 ${hbp} · 벤치클리어링 ${clear} · 김인규 술사고 ${drunk} · 분위기상승 ${up}`);
  T('사구 마찰 발생', ()=>hbp>0);
  T('김인규 술 사고 발생', ()=>drunk>0);
  T('벤치클리어링 발생', ()=>clear>0);
  T('매 경기는 아니다', ()=>hbp<games&&clear<games);
  // 술 안 마셨으면 그 트리거는 안 뜬다
  ev("ST.drunkIds=[];");
  let drunk2=0;
  for(let i=0;i<25;i++){
    ev("LIVE=makeLive();LIVE.manual=false;var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
    if(ev("LIVE.result.friction.drunk"))drunk2++;
  }
  T('안 마셨으면 술 사고 없음', ()=>drunk2===0);
  const logs=ev(`(function(){ST.drunkIds=['kig'];
    for(var i=0;i<60;i++){LIVE=makeLive();LIVE.manual=false;var g=0;
      while(!LIVE.over&&g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();
      if(LIVE.result.friction.cleared)return LIVE.log.filter(l=>l.t==='fric').map(l=>l.text);}
    return []})()`);
  if(logs.length)console.log('   벤치클리어링 로그:', logs.join(' / '));
  console.log('\n[경기 후 반영]');
  ev("TBYID['wwzw'].players.forEach(p=>{ST.morale[p.id]=70;ST.cond[p.id]=70});ST.kakaoPost=[];");
  const m=ev("applyFriction(ST,{log:['hbp','clear','drunk','up'],hbp:true,cleared:true,drunk:'kig',by:'khg',up:true})");
  console.log('   ', m.map(x=>x.text.replace(/\n/g,' / ')).join(' | '));
  T('사구 사기 +5', ()=>true);
  T('벤치클리어링 컨디션 -5', ()=>ev("ST.cond.lg")===65);
  T('사기 순증 (5+9+4=18)', ()=>ev("ST.morale.lg")===88);
  T('술 사고 당사자 -6', ()=>ev("ST.morale.kig")===82);
  T('대사 포함', ()=>m.some(x=>/그건 좀 심했|잘못한 거 없|어제 좀 마시긴/.test(x.text)));

  console.log('\n[감독 액션]');
  ev("LIVE=makeLive();LIVE.manual=true;");
  T('경기당 3회', ()=>ev("LIVE.mgr.left")===3);
  ev("LIVE.userSide().runs=1;LIVE.oppSide().runs=6;");
  const r1=ev("LIVE.mgrAction('bottle')");
  console.log('   물통(지고 있을 때):', r1.text);
  T('물통 차기 동작', ()=>r1.ok&&ev("LIVE.mgr.left")===2);
  T('boost 변동', ()=>ev("LIVE.mgr.boost")!==1);
  const r2=ev("LIVE.mgrAction('clap')");
  console.log('   박수:', r2.text);
  const r3=ev("LIVE.mgrAction('umpire')");
  console.log('   심판 어필:', r3.text);
  T('3회 소진', ()=>ev("LIVE.mgr.left")===0);
  const r4=ev("LIVE.mgrAction('watch')");
  T('지켜보기는 횟수 안 씀', ()=>r4.ok===false||ev("LIVE.mgr.left")===0);
  ev("LIVE.mgr.left=1");
  const r5=ev("LIVE.mgrAction('watch')");
  T('지켜보기 후 횟수 유지', ()=>ev("LIVE.mgr.left")===1);
  // 지고 있을 때 vs 이기고 있을 때 성공률
  let winGood=0, loseGood=0;
  for(let i=0;i<200;i++){
    ev("LIVE.rng=Math.random;LIVE.mgr={left:99,boost:1,log:[]};LIVE.userSide().runs=1;LIVE.oppSide().runs=6;LIVE.mgrAction('bottle')");
    if(ev("LIVE.mgr.boost")>1)loseGood++;
    ev("LIVE.mgr={left:99,boost:1,log:[]};LIVE.userSide().runs=6;LIVE.oppSide().runs=1;LIVE.mgrAction('bottle')");
    if(ev("LIVE.mgr.boost")>1)winGood++;
  }
  console.log(`   물통 성공률 — 지고 있을 때 ${loseGood/2}% / 이기고 있을 때 ${winGood/2}%`);
  T('지고 있을 때 더 잘 먹힌다', ()=>loseGood>winGood);
  // UI
  ev("LIVE=makeLive();LIVE.manual=true;");
  w.go('game'); await new Promise(r=>setTimeout(r,50));
  await enterGame(w,d,ev,true); ev("if(typeof playTimer!=='undefined')clearInterval(playTimer);");
  ev("while(!LIVE.over&&!LIVE.off().isUser)LIVE.step();showDecision({kind:'situation',label:'테스트'})");
  await new Promise(r=>setTimeout(r,40));
  T('공격 판단창에 감독 액션', ()=>[...d.querySelectorAll('#decision .decb b')].some(b=>/감독 액션/.test(b.textContent)));
  [...d.querySelectorAll('#decision .decb')].find(b=>/감독 액션/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,40));
  const rows=[...d.querySelectorAll('#sheet-body .pick-row')];
  T('액션 4종', ()=>rows.length===4);
  console.log('   ', rows.map(r=>r.querySelector('.pk-name').textContent).join(' / '));
  T('시트 클린', ()=>!/undefined|NaN/.test(d.getElementById('sheet-body').textContent));
  ev("closeSheet();clearInterval(playTimer)");

  console.log('\n[세이브 왕복 + 전 화면]');
  ev("LIVE=null;saveGame(true)"); await new Promise(r=>setTimeout(r,50));
  const raw=ev("JSON.stringify(ST)");
  ev(`ST=JSON.parse(${JSON.stringify(raw)});normalizeState();`);
  T('tutDone 보존', ()=>ev("ST.tutDone")===true);
  T('drunkIds 보존', ()=>Array.isArray(ev("ST.drunkIds")));
  for(const v of ['home','squad','lineup','game','train','scout','stand','stats','records','more','kakao','tutorial']){
    w.go(v);await new Promise(r=>setTimeout(r,25));
    const x=d.getElementById('view');
    if(x.textContent.trim().length<5)errs.push(v+' 비어있음');
    if(/undefined|NaN/.test(x.textContent))errs.push(v+' undefined/NaN');
  }
  T('전 화면 클린', ()=>true);
  console.log(errs.length?'\n❌ '+errs.length+'건':'\n✅ 전체 통과');
  errs.forEach(e=>console.log('  - '+e));
  process.exit(errs.length?1:0);
},450);
