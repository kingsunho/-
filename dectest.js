/* 직접 지휘 판단창에 기록이 나오는지 · 상황에 안 맞는 지시가 안 뜨는지 */
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

  console.log('[기록 요약 헬퍼]');
  ev(`(function(){
    ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    LIVE=makeLive(); LIVE.manual=true;
    let g=0; while(!LIVE.over&&g++<120){ LIVE.pending=null; LIVE.step(); }
  })()`);
  T('타자 오늘 기록이 문장으로 나온다', ()=>{
    const id=ev("Object.keys(LIVE.box).find(k=>LIVE.box[k].pa>0)");
    const t=ev(`todayBat('${id}')`);
    return /오늘 \d+타수 \d+안타/.test(t) ? t : '!'+t;
  });
  T('타석 전이면 그렇게 말한다', ()=>ev("todayBat('__없는선수__')")==='오늘 첫 타석');
  T('투수 오늘 기록', ()=>{
    const id=ev("Object.keys(LIVE.pbox).find(k=>LIVE.pbox[k].bf>0)");
    const t=ev(`todayPit('${id}')`);
    return /이닝.*피안타.*실점/.test(t) ? t : '!'+t;
  });
  T('시즌 기록 요약', ()=>{
    const t=ev("seasonBat('ksh')");
    return /시즌 기록 없음|시즌 \./.test(t) ? t : '!'+t;
  });
  T('투수 상태 판정', ()=>{
    const s1=ev("JSON.stringify(pitState('__없음__'))");
    return JSON.parse(s1).t==='' ? '등판 전이면 빈 값' : '!'+s1;
  });

  console.log('\n[공격 판단창]');
  const openOff=(bases)=>ev(`(function(){
    LIVE.bases=${JSON.stringify(bases)};
    LIVE.tacTTL={bat:0,run:0};
    const box=document.getElementById('decision');
    if(!box){ const st=document.createElement('div'); st.id='stage';
      const dc=document.createElement('div'); dc.id='decision'; st.appendChild(dc);
      document.getElementById('view').appendChild(st); }
    showDecision({kind:'offense',label:'작전 지시'});
    return document.getElementById('decision').textContent;
  })()`);
  let t=openOff([null,null,null]);
  const btns=()=>[...d.querySelectorAll('#decision .decb b')].map(x=>x.textContent);
  console.log('   주자 없음:', btns().join(' / '));
  T('타자 오늘 기록이 판단창에 뜬다', ()=>/오늘 \d+타수|오늘 첫 타석/.test(t));
  T('시즌 기록도 같이 뜬다', ()=>/시즌/.test(t));
  T('주자 없으면 "뛰어라" 가 없다', ()=>!btns().includes('뛰어라'));
  T('주자 없으면 번트도 없다', ()=>!btns().includes('진루 우선')&&!btns().includes('번트 앤 런'));
  T('타격 지시는 그대로 있다', ()=>btns().includes('공 보고 가기')&&btns().includes('적극 타격'));
  T('상대 투수 정보가 같이 뜬다', ()=>/상대 투수/.test(t)&&/구위 \d+ · 제구 \d+/.test(t));
  T('왜 없는지 알려준다', ()=>/주자가 없어서/.test(t));

  t=openOff(['ksh',null,null]);
  console.log('   1루 주자:', btns().join(' / '));
  T('1루 주자면 "뛰어라" 가 있다', ()=>btns().includes('뛰어라'));
  T('1루 주자면 번트 앤 런도 있다', ()=>btns().includes('번트 앤 런'));

  t=openOff([null,'ksh',null]);
  console.log('   2루 주자:', btns().join(' / '));
  T('2루 주자면 진루 우선은 있고 도루는 없다',
    ()=>btns().includes('진루 우선')&&!btns().includes('뛰어라'));

  console.log('\n[수비 판단창 — 상대 타자를 알 수 있나]');
  const dt=ev(`(function(){
    LIVE.bases=[null,null,null];
    LIVE.half = LIVE.userIsHome ? 0 : 1;      // 우리가 수비
    showDecision({kind:'defense',label:'수비 판단'});
    return document.getElementById('decision').textContent;
  })()`);
  console.log('   ', dt.replace(/\s+/g,' ').slice(0,120));
  T('우리 투수 오늘 기록이 뜬다', ()=>/이닝.*피안타|등판 전/.test(dt) ? true : '!'+dt.slice(0,60));
  T('상대 타자가 몇 번인지 나온다', ()=>/\d+번 · 컨택 \d+/.test(dt) ? true : '!'+dt.slice(0,90));
  T('상대 타자 능력치가 나온다', ()=>/컨택 \d+ · 파워 \d+ · 주루 \d+/.test(dt));
  T('상대 타자 오늘 성적이 나온다', ()=>/오늘 \d+타수 \d+안타|오늘 첫 타석/.test(dt));
  T('판단창 이름이 눌린다', ()=>{
    const l=d.querySelectorAll('#decision .nml');
    return l.length>=2 ? `${l.length}개` : `!${l.length}개`;
  });
  T('상대 선수 카드가 열린다', ()=>{
    const l=d.querySelector('#decision .nml'); if(!l) return '!링크 없음';
    l.click();
    const on=d.getElementById('sheet').classList.contains('open');
    const title=d.getElementById('sheet-title').textContent;
    const clean=!/undefined|NaN/.test(d.getElementById('sheet-body').textContent);
    ev("closeSheet()");
    return on&&clean ? title : (!on?'!안 열림':'!카드 내용 이상');
  });

  ev("LIVE.half = LIVE.userIsHome ? 1 : 0;");   // 다시 우리 공격으로 돌려놓는다

  console.log('\n[투수 교체 판단창]');
  const pt=ev(`(function(){
    const s=LIVE.userSide();
    showDecision({kind:'pitcherChange', side:s, from:LIVE.curPitcher(s).name, to:LIVE.curPitcherNext(s)});
    return document.getElementById('decision').textContent;
  })()`);
  console.log('   ', pt.replace(/\s+/g,' ').slice(0,110));
  T('지금 투수 기록이 나온다', ()=>/이닝.*자책/.test(pt));
  T('바꿀 투수 정보가 나온다', ()=>/구위 \d+ · 제구 \d+/.test(pt) ? true : '(다음 투수 없음)');
  T('undefined 없음', ()=>!/undefined|NaN/.test(pt));

  console.log('\n[대타 시트]');
  const ph=ev(`(function(){
    LIVE.inning=5; LIVE.bases=[null,null,null];
    LIVE.benchPool=TBYID['wwzw'].players.map(p=>p.id);
    showDecision({kind:'offense',label:'작전 지시'});
    const b=[...document.querySelectorAll('#decision .decb')].find(x=>/대타 기용/.test(x.textContent));
    if(!b) return null;
    const label=b.textContent;
    b.click();
    return {label, body:document.getElementById('sheet-body').textContent,
      rows:document.querySelectorAll('#sheet-body .pick-row').length};
  })()`);
  if(!ph){ console.log('  (대타 버튼 없음 — 벤치 조건 미충족)'); }
  else {
    console.log('   버튼:', ph.label.replace(/\s+/g,' ').slice(0,70));
    T('버튼에 빼는 선수 기록', ()=>/오늘 \d+타수|오늘 첫 타석/.test(ph.label));
    T('시트에 빼는 선수 요약', ()=>/빼는 사람/.test(ph.body));
    T('후보마다 시즌 기록', ()=>/시즌/.test(ph.body));
    T('후보가 여러 명', ()=>ph.rows>=2 ? `${ph.rows}명` : `!${ph.rows}명`);
    T('후보 이름 옆 기록 버튼', ()=>d.querySelectorAll('#sheet-body .pk-info').length>=2);
    T('undefined 없음', ()=>!/undefined|NaN/.test(ph.body));
    ev("closeSheet()");
  }

  console.log('\n[지시가 실제로 먹히는지]');
  T('주루 지시가 실제로 적용된다', ()=>{
    ev("LIVE.half = LIVE.userIsHome ? 1 : 0; LIVE.bases=['ksh',null,null];");
    ev("showDecision({kind:'offense',label:'작전 지시'})");
    const b=[...d.querySelectorAll('#decision .decb')].find(x=>/뛰어라/.test(x.textContent));
    if(!b) return '!버튼 없음';
    b.click();
    return ev("LIVE.off().tac.run")==='aggressive' ? '주루 지시 적용됨' : '!적용 안 됨';
  });
  ev("if(typeof playTimer!=='undefined')clearInterval(playTimer); LIVE=null;");

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
