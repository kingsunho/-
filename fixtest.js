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

  console.log('[버그1] 결장한 투수가 사라지지 않는다');
  const rot0=ev("ST.rotation.slice()");
  console.log('    초기 로테이션:', rot0.map(x=>ev(`nameOf('${x}')`)).join(' → '));
  const ace=rot0[0];
  ev(`ST.absent['${ace}']='늦잠';`);          // 첫 경기 늦잠 결장
  ev("sanitizeRotation()");
  T('sanitizeRotation 이 안 지운다', ()=>ev("ST.rotation").indexOf(ace)>=0);
  const g=ev("gameRotation()");
  T('그 경기 등판 순서에서는 빠진다', ()=>g.indexOf(ace)<0);
  ev("applyDHRule(); LIVE=makeLive();");
  T('makeLive 후에도 로테이션 유지', ()=>ev("ST.rotation").indexOf(ace)>=0);
  T('경기 로테이션은 결장자 제외', ()=>ev("ST.gameRotation").indexOf(ace)<0);
  ev("var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
  ev("(function(){const res=LIVE.result,nx=ST.schedule[ST.round];commitGame(res,nx.homeGame?res.home:res.away,nx.homeGame?res.away:res.home,(nx.homeGame?LIVE.home:LIVE.away).slots);})()");
  await new Promise(r=>setTimeout(r,40));
  T('경기 후에도 로테이션에 남아있다', ()=>ev("ST.rotation").indexOf(ace)>=0);
  ev(`delete ST.absent['${ace}'];`);
  T('다음 주 복귀 시 등판 순서 1번', ()=>ev("gameRotation()")[0]===ace);
  console.log('    복귀 후:', ev("gameRotation()").map(x=>ev(`nameOf('${x}')`)).join(' → '));

  console.log('\n[버그2] 불펜 지정 · 로테이션 추가/제외');
  ev("runWeek();ST.events=[];");
  w.go('lineup'); await new Promise(r=>setTimeout(r,60));
  const addBtn=[...d.querySelectorAll('#view .btn')].find(b=>/투수 추가/.test(b.textContent));
  T('투수 추가 버튼 존재', ()=>!!addBtn);
  const before=ev("ST.rotation.length");
  addBtn.click(); await new Promise(r=>setTimeout(r,40));
  const rows=[...d.querySelectorAll('#sheet-body .pick-row')];
  T('대기 투수 목록', ()=>rows.length>0);
  console.log('    대기:', rows.map(r=>r.querySelector('.pk-name').textContent).join(', '));
  rows[0].click(); await new Promise(r=>setTimeout(r,50));
  T('추가됨', ()=>ev("ST.rotation.length")===before+1);
  // 추가된 선수를 2번(불펜)으로 올리기
  const added=ev("ST.rotation[ST.rotation.length-1]");
  ev(`(function(){const a=ST.rotation;const i=a.indexOf('${added}');while(a.indexOf('${added}')>1){const j=a.indexOf('${added}');[a[j-1],a[j]]=[a[j],a[j-1]];}})()`);
  T('불펜(2번) 배치 가능', ()=>ev("ST.rotation")[1]===added && ev("ST.rotation")[0]!==added);
  console.log('    로테이션:', ev("ST.rotation").map(x=>ev(`nameOf('${x}')`)).join(' → '));
  w.go('lineup'); await new Promise(r=>setTimeout(r,50));
  const rmBtn=d.querySelectorAll('#view .pt-ctl .rm');
  T('제외 버튼 존재', ()=>rmBtn.length===ev("ST.rotation.length"));
  const n0=ev("ST.rotation.length");
  rmBtn[rmBtn.length-1].click(); await new Promise(r=>setTimeout(r,50));
  T('제외 동작', ()=>ev("ST.rotation.length")===n0-1);

  console.log('\n[버그3] 영입 선수 등판');
  ev(`(function(){
    const us=TBYID['wwzw'];
    us.players.push({id:'new_test',name:'테스트영입',bats:'R',con:50,pow:45,eye:40,spd:45,def:45,arm:55,pos:['P','LF'],pitch:null,real:null});
    META['new_test']={born:1999,speech:'jon',throws:'R',car:false,school:'-',drink:2,loyal:70,pot:4,
      traits:['영입'],friends:[],rival:null,coach:{},pos:PR({P:52}),desc:'영입'};
    ST.bat['new_test']=blankBat();ST.cond['new_test']=72;ST.morale['new_test']=75;ST.injury['new_test']=null;
    ST.ca['new_test']=calcCA(us.players[us.players.length-1]);
    finalizeTeam(us);buildPitcherPool();ST.pit['new_test']=blankPit();ST.rest['new_test']=3;
  })()`);
  T('투수 풀에 포함', ()=>ev("TBYID['wwzw'].pitchers.some(p=>p.id==='new_test')"));
  ev("ST.rotation.unshift('new_test');syncStarter();");
  T('로테이션 선발 지정', ()=>ev("gameRotation()")[0]==='new_test');
  ev("applyDHRule();LIVE=makeLive();var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
  T('실제 등판함', ()=>{const pb=ev("LIVE.result.pbox['new_test']");return pb&&pb.bf>0;});
  console.log('    투구 기록:', JSON.stringify(ev("LIVE.result.pbox['new_test']")));

  console.log('\n[말투] 규칙 재정립');
  const cases=[
    ['ksh','kjh','ban','00 ↔ 00'],
    ['kjh','ksh','ban','00 ↔ 00'],
    ['ksh','swm','jon','00 → 99형'],
    ['swm','ksh','ban','99형 → 00'],
    ['lg','jms','ban','99 ↔ 99'],
    ['kig','khg','ban','쌍둥이'],
    ['khg','kig','ban','쌍둥이'],
    ['kig','swm','ban','인규 → 99형(반말)'],
    ['khg','lg','ban','한규 → 99형(반말)'],
    ['kig','ksh','ban','인규 → 00'],
    ['khg','yjh','ban','한규 → 99형(반말)'],
    ['ksw','ujh','jon','00 → 99형'],
    ['lmh','ksn','ban','99형 → 00'],
  ];
  cases.forEach(([a,b,exp,label])=>{
    const got=ev(`speechTo('${a}','${b}')`);
    const ok=got===exp;
    console.log(`  ${ok?'✅':'❌'} ${nameOfS(a)}→${nameOfS(b)} ${label}: ${got}`);
    if(!ok)errs.push(`말투 ${a}→${b}`);
  });
  function nameOfS(id){return ev(`nameOf('${id}')`)}

  console.log('\n[데이터] 쌍둥이 차 없음 · 대장 제거');
  T('김인규 차 없음', ()=>ev("META.kig.car")===false);
  T('김한규 차 없음', ()=>ev("META.khg.car")===false);
  T('김인규 카풀 특성 제거', ()=>!ev("META.kig.traits").includes('카풀'));
  T('김선호 대장 제거', ()=>!ev("META.ksh.traits").includes('대장'));
  ev("ST.absent={};ST.injury={};");   // 결장자가 있으면 배차에서 빠지는 게 정상이므로 비우고 본다
  const cp=ev("resolveCarpool(ST)");
  const kjhRide=cp.rides.find(r=>r.origin==='kjh');
  console.log('    배차:', cp.rides.map(r=>`${ev(`nameOf('${r.driver}')`)}: ${r.riders.map(x=>ev(`nameOf('${x}')`)).join(',')}`).join(' | '));
  T('쌍둥이가 김준희 차에 탄다', ()=>kjhRide&&kjhRide.riders.includes('kig')&&kjhRide.riders.includes('khg'));
  T('기름값 싸움 대사 제거', ()=>{
    for(let i=0;i<300;i++){const e=ev(`rollBrotherEvent(ST,makeRng(${i}*7717))`);
      if(e&&e.lines&&e.lines.some(l=>/기름값/.test(l[1])))return false;}
    return true;});
  T('형제 대사에 형 호칭 없음', ()=>{
    for(let i=0;i<300;i++){const e=ev(`rollBrotherEvent(ST,makeRng(${i}*7717))`);
      if(e&&e.lines&&e.lines.some(l=>/형이|형은|형 야구/.test(l[1])))return false;}
    return true;});

  console.log('\n[전 화면]');
  for(const v of ['home','squad','lineup','game','train','scout','stand','stats','records','more','kakao']){
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
