/* 런타임 성능 프로파일 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:new VirtualConsole(),beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ms=fn=>{const t=process.hrtime.bigint();fn();return Number(process.hrtime.bigint()-t)/1e6;};

(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  console.log('[초기화]');
  console.log('  buildAllTeams()   ' + ms(()=>ev("buildAllTeams()")).toFixed(1) + ' ms');
  console.log('  newSeason()       ' + ms(()=>ev("newSeason()")).toFixed(1) + ' ms');

  console.log('\n[경기 1판 (엔진)]');
  const one=ev(`(function(){
    const t=[];
    for(let i=0;i<10;i++){
      const t0=performance.now();
      const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();} L.finish();
      t.push(performance.now()-t0);
    }
    t.sort((a,b)=>a-b);
    return {med:t[5], max:t[9], min:t[0]};
  })()`);
  console.log(`  중앙값 ${one.med.toFixed(1)} ms · 최대 ${one.max.toFixed(1)} ms`);

  // 시즌 기록을 채워서 무거운 화면을 만든다
  ev(`(function(){ for(let i=0;i<14;i++){
    runWeek(); ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
    const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
    L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
    const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots); if(ST.seasonOver)break; } })()`);
  console.log(`\n[화면 렌더 — ${ev("ST.stand['wwzw'].g")}경기 치른 상태]`);
  const views=[['home','홈'],['squad','선수단'],['lineup','라인업'],['kakao','단톡방'],
    ['stand','순위'],['stats','기록실'],['records','기록'],['train','훈련'],
    ['scout','스카우트'],['recruit','영입'],['hall','전시장'],['more','더보기'],['player','프로필']];
  const slow=[];
  for(const [v,nm] of views){
    const t=ms(()=>{ try{ w.go(v); }catch(e){} });
    const mark = t>60?'  ⚠️ 느림':(t>25?'  · 보통':'');
    console.log(`  ${nm.padEnd(8)} ${t.toFixed(1).padStart(6)} ms${mark}`);
    if(t>60) slow.push(`${nm} ${t.toFixed(0)}ms`);
    await wait(10);
  }
  // 기록실 탭별
  console.log('\n[기록실 탭별]');
  for(const [k,nm] of [['team','우리 타격'],['pitch','우리 투수'],['league','리그 타자'],['lgpit','리그 투수']]){
    ev(`statTab='${k}'`);
    const t=ms(()=>w.go('stats'));
    console.log(`  ${nm.padEnd(10)} ${t.toFixed(1).padStart(6)} ms`);
  }
  console.log('\n[기록 탭별]');
  for(const [k,nm] of [['real','실제'],['feat','진기록'],['mine','내 기록'],['career','통산'],['team','구단']]){
    ev(`recTab='${k}'`);
    const t=ms(()=>w.go('records'));
    console.log(`  ${nm.padEnd(10)} ${t.toFixed(1).padStart(6)} ms`);
  }

  console.log('\n[정렬 반복 — 표가 다시 그려질 때]');
  ev("statTab='team'"); w.go('stats');
  const st=ms(()=>{ for(let i=0;i<20;i++) ev("myBatSort='ops';renderStats()"); });
  console.log(`  20회 재렌더 ${st.toFixed(0)} ms (1회당 ${(st/20).toFixed(1)} ms)`);

  console.log('\n[저장]');
  console.log('  JSON.stringify(ST)  ' + ms(()=>ev("JSON.stringify(ST)")).toFixed(1) + ' ms · ' +
    (ev("JSON.stringify(ST).length")/1024).toFixed(0) + ' KB');
  console.log('  packSave()          ' + ms(()=>ev("packSave(JSON.stringify(ST))")).toFixed(1) + ' ms');

  console.log('\n[메모리]');
  const mem=process.memoryUsage();
  console.log(`  heap ${(mem.heapUsed/1048576).toFixed(0)} MB`);
  console.log(slow.length?`\n⚠️  느린 화면: ${slow.join(', ')}`:'\n✅ 눈에 띄게 느린 화면 없음');
  process.exit(0);
})();
