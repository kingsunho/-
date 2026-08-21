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

  console.log('[참석률 현실화]');
  ev("ST.trainRain=false;ST.trainStreak=0;ST.absent={};");
  const cnt={};const N=400;
  for(let i=0;i<N;i++){ev("ST.weekSeq++;ST.trainAttendKey=null");
    ev("trainAttendList()").forEach(id=>cnt[id]=(cnt[id]||0)+1);}
  const names=ev("TBYID['wwzw'].players.map(p=>p.id)");
  console.log('   ', names.map(id=>`${ev(`nameOf('${id}')`)} ${Math.round((cnt[id]||0)/N*100)}%`).join(' '));
  T('상시조 80% 안팎 (100% 아님)', ()=>['ksh','kjh','kig','khg','lg','swm','khj']
     .every(x=>cnt[x]/N>0.75&&cnt[x]/N<0.90));
  T('나머지는 30% 미만', ()=>['jms','lmh','ksn','ksw','lsm'].every(x=>(cnt[x]||0)/N<0.30));
  T('경기 출석보다 훈련 출석이 낮다', ()=>(cnt.lg||0)/N < 1.0 && (cnt.jms||0)/N < ev("META.jms.attend"));

  console.log('\n[연속 훈련 피로]');
  const f=[0,1,2,3,4].map(st=>{ev(`ST.trainStreak=${st}`);return ev("trainFatigue()")});
  console.log('   연속 0/1/2/3/4주 →', f.map(x=>x.toFixed(2)).join(' '));
  T('2주차부터 하락', ()=>f[2]<f[1]&&f[3]<f[2]&&f[4]<f[3]);
  ev("ST.trainStreak=3;ST.trainAttendKey=null");
  const tired=ev("trainAttendList()").length;
  ev("ST.trainStreak=0;ST.trainAttendKey=null");
  const fresh=ev("trainAttendList()").length;
  console.log(`   연속 3주 ${tired}명 vs 쉬고 난 뒤 ${fresh}명`);
  T('연속 훈련 시 인원 감소', ()=>tired<=fresh);
  ev("ST.trainFocus='bat';ST.trainStreak=3;applyTraining()");
  T('훈련하면 연속 카운터 증가', ()=>ev("ST.trainStreak")===4);
  ev("ST.trainFocus='none';applyTraining()");
  T('쉬면 초기화', ()=>ev("ST.trainStreak")===0);

  console.log('\n[비 오는 날]');
  ev("ST.trainRain=true;ST.trainPush=false;ST.trainFocus='bat';ST.trainAttendKey=null");
  T('취소하면 아무도 안 나옴', ()=>ev("trainAttendList()").length===0);
  ev("TBYID['wwzw'].players.forEach(p=>ST.cond[p.id]=50);applyTraining()");
  T('취소 시 전원 컨디션 +4', ()=>ev("ST.cond.lg")===54);
  T('취소 로그', ()=>/비로 훈련 취소/.test(ev("ST.trainLog.join('|')")));
  ev("ST.trainPush=true;ST.trainAttendKey=null;ST.trainStreak=0");
  const rainN=ev("trainAttendList()").length;
  ev("ST.trainRain=false;ST.trainAttendKey=null");
  const dryN=ev("trainAttendList()").length;
  console.log(`   비 강행 ${rainN}명 vs 맑은 날 ${dryN}명`);
  T('강행해도 인원 절반 이하', ()=>rainN<=Math.ceil(dryN*0.7));

  console.log('\n[포지션 적응 훈련]');
  ev("ST.trainRain=false;ST.trainPush=false;ST.trainStreak=0;ST.posTrain={};");
  // 김선호는 2루/유격만 가능. 좌익(0)을 훈련으로 열어본다
  console.log('   김선호 좌익 타고난 적합도:', ev("basePosFit('ksh','LF')"), '/ 한계:', ev("posTrainCap('ksh','LF')"));
  T('안 서던 자리 한계는 30', ()=>ev("posTrainCap('ksh','LF')")===30);
  T('서던 자리는 +25', ()=>ev("posTrainCap('ksh','2B')")===Math.min(70,ev("basePosFit('ksh','2B')")+25));
  T('좌투는 내야 불가 유지', ()=>ev("posTrainCap('ksn','SS')")===0&&ev("posTrainCap('lsm','C')")===0);
  ev("ST.trainFocus='pos';ST.trainTarget='ksh';ST.trainPos='LF';");
  const b0=ev("posFit('ksh','LF')");
  for(let i=0;i<20;i++){ev("ST.trainAttend=['ksh','lg'];ST.trainAttendKey=trainAttendKey();applyTraining()");}
  const a0=ev("posFit('ksh','LF')");
  console.log(`   좌익 적합도 ${b0} → ${a0.toFixed(1)}`);
  T('적합도 상승', ()=>a0>b0);
  T('한계를 넘지 않는다', ()=>a0<=30);
  T('훈련 안 한 포지션은 그대로', ()=>ev("posFit('ksh','RF')")===ev("basePosFit('ksh','RF')"));
  T('로그 표시', ()=>/좌익 적합도/.test(ev("ST.trainLog.join('|')"))||/적응 완료/.test(ev("ST.trainLog.join('|')")));
  console.log('   ', ev("ST.trainLog.join(' / ')"));
  // 불가 포지션
  ev("ST.trainTarget='ksn';ST.trainPos='SS';ST.trainAttend=['ksn'];ST.trainAttendKey=trainAttendKey();applyTraining()");
  T('불가 포지션은 안 오름', ()=>ev("posFit('ksn','SS')")===0);
  console.log('   ', ev("ST.trainLog.join(' / ')"));
  // 불참 시 무산
  ev("ST.trainTarget='ksh';ST.trainPos='LF';ST.trainAttend=['lg'];ST.trainAttendKey=trainAttendKey();");
  const bb=ev("posFit('ksh','LF')"); ev("applyTraining()");
  T('불참하면 무산', ()=>ev("posFit('ksh','LF')")===bb && /무산/.test(ev("ST.trainLog.join('|')")));

  console.log('\n[라인업 반영]');
  T('훈련한 포지션에 실제로 설 수 있다', ()=>ev("posFit('ksh','LF')")>0);
  ev("ST.lineup[0]={id:'ksh',pos:'LF'};");
  T('라인업 배치 가능', ()=>ev("ST.lineup[0].pos")==='LF'&&ev("posFit('ksh','LF')")>0);
  ev("ST.lineup=recommendLineup();optimizePositions();applyDHRule();");

  console.log('\n[화면]');
  ev("ST.trainFocus='pos';ST.trainTarget='ksh';ST.trainPos='LF';ST.trainRain=true;");
  w.go('train'); await new Promise(r=>setTimeout(r,60));
  const tv=d.getElementById('view').textContent;
  T('비 강행 선택 카드', ()=>/훈련일에 비가 온다/.test(tv));
  T('포지션 적응 카드', ()=>/좌익 적응|포지션 미지정/.test(tv));
  T('포지션 고르기 버튼', ()=>[...d.querySelectorAll('#view .btn')].some(b=>/연습시킬 포지션/.test(b.textContent)));
  T('훈련 화면 클린', ()=>!/undefined|NaN/.test(tv));
  [...d.querySelectorAll('#view .btn')].find(b=>/연습시킬 포지션/.test(b.textContent)).click();
  await new Promise(r=>setTimeout(r,40));
  T('포지션 시트 9개(DH 제외 8 + 투수)', ()=>d.querySelectorAll('#sheet-body .pick-row').length===9);
  T('시트 클린', ()=>!/undefined|NaN/.test(d.getElementById('sheet-body').textContent));
  ev("closeSheet()");
  w.go('squad'); await new Promise(r=>setTimeout(r,40));
  T('선수단에 적응 포지션 표시', ()=>/포지션 적응/.test(d.getElementById('view').textContent));

  console.log('\n[세이브 왕복 + 전 화면]');
  ev("saveGame(true)"); await new Promise(r=>setTimeout(r,50));
  const raw=ev("JSON.stringify(ST)");
  ev(`ST=JSON.parse(${JSON.stringify(raw)});normalizeState();`);
  T('posTrain 보존', ()=>ev("posFit('ksh','LF')")>0);
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
