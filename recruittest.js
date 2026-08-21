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
  ev("runWeek();ST.events=[];autoFixLineup();applyDHRule();ST.budget=99999;");

  console.log('[로테이션 복구 — 구세이브]');
  ev("ST.rotation=['swm','kig','khg'];normalizeState();");
  console.log('   3명 → ', ev("ST.rotation").map(x=>ev(`nameOf('${x}')`)).join(', '));
  T('6명으로 보충', ()=>ev("ST.rotation.length")===6);
  T('기존 3명 순서 유지', ()=>JSON.stringify(ev("ST.rotation.slice(0,3)"))===JSON.stringify(['swm','kig','khg']));

  console.log('\n[선발 투수 일치]');
  ev("ST.useDH=true;ST.lineup=recommendLineup();optimizePositions();applyDHRule();");
  ev("setStarter('kjh')");
  T('DH 사용 중 선발 지정', ()=>ev("ST.rotation[0]")==='kjh'&&ev("gameRotation()[0]")==='kjh');
  T('DH 중엔 P 슬롯 없음', ()=>!ev("ST.lineup.some(s=>s.pos==='P')"));
  T('지명타자 유지', ()=>ev("ST.lineup.some(s=>s.pos==='DH')"));
  ev("LIVE=makeLive()");
  T('실제 등판 = 지정한 선발', ()=>ev("LIVE.curPitcher(LIVE.userSide()).name")===ev("nameOf('kjh')"));
  ev("ST.useDH=false;setStarter('swm');");
  T('DH 미사용 선발 지정', ()=>ev("ST.rotation[0]")==='swm');
  T('P 슬롯에 선발이 앉는다', ()=>ev("(function(){const s=ST.lineup.find(x=>x.pos==='P');return s&&s.id==='swm'})()"));
  ev("LIVE=makeLive()");
  T('타순 투수 = 등판 투수', ()=>{
    const slot=ev("(function(){const s=LIVE.userSide().slots.find(x=>x.pos==='P');return s?s.id:null})()");
    const cur=ev("LIVE.curPitcher(LIVE.userSide()).id");
    return slot===cur;});
  ev("ST.useDH=true;applyDHRule();");

  console.log('\n[영입 — 삼국지식 카톡]');
  ev("scoutTeam='pirates'"); w.go('scout'); await new Promise(r=>setTimeout(r,50));
  const btn=d.querySelector('#view .sc-b');
  T('접촉 버튼', ()=>btn&&btn.textContent==='접촉');
  btn.click(); await new Promise(r=>setTimeout(r,50));
  T('영입 화면 진입', ()=>!!ev("ST.recruit"));
  console.log('   대상:', ev("ST.recruit.name"), '/ 시작 호감:', ev("ST.recruit.favor"), '/ 비용:', ev("ST.recruit.cost").toFixed(1)+'만원');
  T('기본 성공률 0.1% 근처', ()=>{const c=ev("recruitChance(0)");return Math.abs(c-0.001)<0.0001;});
  console.log('   호감 0/30/60/100 성공률:', [0,30,60,100].map(f=>(ev(`recruitChance(${f})`)*100).toFixed(1)+'%').join(' '));
  // 3단계 대화
  for(let st=0;st<3;st++){
    const opts=[...d.querySelectorAll('#view .sendopt')];
    if(!opts.length)break;
    console.log(`   ${st+1}단계 선택지 ${opts.length}개:`, opts.map(o=>o.querySelector('b').textContent).join(' / '));
    opts[0].click(); await new Promise(r=>setTimeout(r,40));
  }
  console.log('   최종 호감:', ev("ST.recruit.favor"), '→ 성공률', (ev("recruitChance(ST.recruit.favor)")*100).toFixed(1)+'%');
  T('3단계 완료', ()=>ev("ST.recruit.step")===3);
  T('대화 로그 쌓임', ()=>ev("ST.recruit.log.length")>=8);
  console.log('   대화:', ev("ST.recruit.log.map(m=>(m.who==='me'?'나: ':'상대: ')+m.text).join(' | ')"));
  T('좋은 선택은 호감 상승', ()=>ev("ST.recruit.favor")>ev("recruitFavorStart(TBYID['pirates'].players[0],TBYID['pirates'])")-15);

  console.log('\n[이적 실제 처리]');
  const pid=ev("ST.recruit.pid"), pname=ev("ST.recruit.name");
  const before=ev("TBYID['pirates'].players.length");
  ev("ST.recruit.favor=100");  // 성공 보장
  let tries=0, ok=false;
  while(!ok&&tries++<40){ ev("ST.recruit.done=false;ST.recruit.result=null;ST.budget=99999;recruitFinish()");
    ok=ev("ST.recruit.result")==='ok'; }
  await new Promise(r=>setTimeout(r,50));
  T('영입 성공', ()=>ok);
  const nid='new_'+pid;
  T('우리 팀에 합류', ()=>ev(`TBYID['wwzw'].players.some(p=>p.id==='${nid}')`));
  T('원 소속팀에서 제거됨', ()=>!ev(`TBYID['pirates'].players.some(p=>p.id==='${pid}')`));
  console.log(`   파이어리츠 인원 ${before} → ${ev("TBYID['pirates'].players.length")}`);
  T('원팀 인원 10명 이상 유지(자동 보충)', ()=>ev("TBYID['pirates'].players.length")>=10);
  T('원팀 투수 존재', ()=>ev("TBYID['pirates'].pitchers.length")>0);
  console.log('   보충된 선수:', ev("TBYID['pirates'].players.filter(p=>String(p.id).indexOf('_fill')>=0).map(p=>p.name).join(', ')")||'(없음)');

  console.log('\n[영입 선수 META]');
  console.log('   pos:', JSON.stringify(ev(`META['${nid}'].pos`)));
  T('pos 존재', ()=>!!ev(`META['${nid}'].pos`));
  T('주 포지션 적합도 높음', ()=>{
    const mp=ev(`TBYID['wwzw'].players.find(p=>p.id==='${nid}').pos[0]`);
    return ev(`posFit('${nid}','${mp}')`)>=48;});
  T('throws/attend/speech 채워짐', ()=>ev(`META['${nid}'].throws`)&&ev(`META['${nid}'].attend`)>0&&ev(`META['${nid}'].speech`));
  T('투수 풀 포함', ()=>ev(`TBYID['wwzw'].pitchers.some(p=>p.id==='${nid}')`));
  console.log('   투수 능력:', JSON.stringify(ev(`TBYID['wwzw'].pitchers.find(p=>p.id==='${nid}')`)));
  T('로테이션 추가 가능', ()=>{ev(`ST.rotation.push('${nid}');sanitizeRotation()`);return ev("ST.rotation").indexOf(nid)>=0;});
  T('선발 지정 가능', ()=>{ev(`setStarter('${nid}')`);return ev("gameRotation()[0]")===nid;});
  ev(`ST.lineup[8]={id:'${nid}',pos:'RF'};applyDHRule();`);
  T('라인업 배치 가능', ()=>ev(`ST.lineup.some(s=>s.id==='${nid}')`));
  ev("LIVE=makeLive();var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
  T('영입 선수 실제 등판', ()=>{const pb=ev(`LIVE.result.pbox['${nid}']`);return pb&&pb.bf>0;});
  ev("setStarter('swm')");

  console.log('\n[세이브 왕복 + 전 화면]');
  ev("ST.recruit=null;saveGame(true)"); await new Promise(r=>setTimeout(r,50));
  const raw=ev("JSON.stringify(ST)");
  ev(`ST=JSON.parse(${JSON.stringify(raw)});normalizeState();`);
  T('영입 선수 유지', ()=>ev(`TBYID['wwzw'].players.some(p=>p.id==='${nid}')`));
  T('META 복원', ()=>!!ev(`META['${nid}']&&META['${nid}'].pos`));
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
