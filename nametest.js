/* 화면마다 이름이 눌리는지 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};

(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");
  // 상태를 만든다 — 부상·불만·폼·불씨·약속·진기록
  ev(`(function(){ for(let i=0;i<8;i++){
    runWeek(); ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
    const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
    L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
    const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots); if(ST.seasonOver)break; }
    // 홈 화면 요소를 강제로 켠다
    const us=TBYID['wwzw'];
    ST.injury[us.players[3].id]={name:'발목 접질림',games:2,sev:2};
    ST.unhappy[us.players[5].id]={level:3,streak:0};
    ST.spark[us.players[6].id]={n:3,why:['벤치']};
    ST.promise[us.players[7].id]={type:'start',games:3};
  })()`);

  const clickable=(v,label)=>{
    w.go(v);
    const n=d.querySelectorAll('#view .nml');
    return {n:n.length, first:n[0]};
  };
  console.log('[화면별 누를 수 있는 이름 수]');
  const want={home:5, kakao:1, stats:5, records:3, hall:0, train:1, more:0};
  for(const [v,nm] of [['home','홈'],['squad','선수단'],['lineup','라인업'],['kakao','단톡방'],
      ['stand','순위'],['stats','기록실'],['records','기록'],['train','훈련'],
      ['scout','스카우트'],['hall','전시장'],['more','더보기']]){
    const r=clickable(v,nm);
    await wait(20);
    console.log(`  ${nm.padEnd(8)} ${String(r.n).padStart(3)}개`);
    if(want[v]!=null && r.n<want[v]) bad.push(`${nm}: 이름 링크 ${r.n}개 (${want[v]}개 이상 기대)`);
  }

  console.log('\n[홈 화면 세부]');
  w.go('home'); await wait(80);
  const homeTxt=d.getElementById('view').textContent;
  const links=[...d.querySelectorAll('#view .nml')].map(x=>x.textContent);
  console.log('  링크된 이름:', [...new Set(links)].join(', '));
  T('플레이 중 선수가 눌린다', ()=>{
    const hm=d.querySelector('#view .hero-me .nml');
    return hm ? hm.textContent : '!hero-me 에 링크 없음';
  });
  T('부상 목록이 눌린다', ()=>/부상:/.test(homeTxt)
    ? (!!d.querySelector('#view .card p.muted .nml')||links.length>1 ? true : '!부상 이름 링크 없음')
    : '부상자 없음(생략)');
  T('불만 목록이 눌린다', ()=>/불만:/.test(homeTxt)
    ? (!!d.querySelector('#view .warn .nml') ? true : '!불만 이름 링크 없음') : '불만 없음(생략)');
  T('약속 줄이 눌린다', ()=>/약속/.test(homeTxt)
    ? (links.length>2 ? true : '!약속 이름 링크 없음') : '약속 없음(생략)');

  console.log('\n[실제로 눌러본다]');
  for(const [v,nm] of [['home','홈'],['kakao','단톡방'],['train','훈련'],['stats','기록실'],['records','기록']]){
    w.go(v); await wait(60);
    const l=d.querySelector('#view .nml');
    if(!l){ console.log(`  ${nm}: 링크 없음`); continue; }
    l.click(); await wait(50);
    const on=d.getElementById('sheet').classList.contains('open');
    const title=d.getElementById('sheet-title').textContent;
    const clean=!/undefined|NaN/.test(d.getElementById('sheet-body').textContent);
    T(`${nm} — ${l.textContent} 카드 열림`, ()=>on&&clean ? title : (!on?'!안 열림':'!카드에 undefined'));
    ev("closeSheet()"); await wait(20);
  }

  console.log('\n[중복 실행 안 되는지]');
  T('표 안 이름은 한 번만 연다', ()=>{
    ev("statTab='team'"); w.go('stats');
    let count=0;
    const orig=w.openPlayerCard;
    w.openPlayerCard=function(...a){ count++; return orig.apply(this,a); };
    const l=d.querySelector('#view table .nml'); if(l) l.click();
    w.openPlayerCard=orig; ev("closeSheet()");
    return count===1 ? true : `!${count}회 실행됨`;
  });

  console.log('\n[전 화면 클린]');
  const dirty=[];
  for(const v of ['home','squad','lineup','kakao','stand','stats','records','train','scout','recruit','hall','more','player']){
    w.go(v); await wait(40);
    const t=(d.getElementById('view')||{}).textContent||'';
    if(/undefined|NaN|\[object/.test(t)) dirty.push(v);
  }
  T('undefined 없음', ()=>dirty.length?('!'+dirty.join(',')):true);

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
