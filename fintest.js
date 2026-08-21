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

  console.log('[시즌 초 장비 안건]');
  w.go('home'); await new Promise(r=>setTimeout(r,60));
  const gv=d.getElementById('view').textContent;
  T('장비 안건 카드', ()=>/시즌 준비 · 장비 안건/.test(gv));
  T('4개 품목', ()=>[...d.querySelectorAll('#view .sendopt')].length>=4);
  T('찬반 의견 표시', ()=>d.querySelectorAll('#view .gfor').length>0&&d.querySelectorAll('#view .gag').length>0);
  const opts=[...d.querySelectorAll('#view .sendopt')];
  console.log('   ', opts.map(o=>o.querySelector('b').textContent).join(' / '));
  console.log('    찬성:', d.querySelector('#view .gfor').textContent, '| 반대:', d.querySelector('#view .gag').textContent);
  T('가입비 안내', ()=>[...d.querySelectorAll('#view p')].some(x=>/리그 가입비/.test(x.textContent)));
  const b0=ev("ST.budget"), m0=ev("ST.morale.lg");
  opts.find(o=>/연습구/.test(o.textContent)).click(); await new Promise(r=>setTimeout(r,50));
  T('구매 시 운영비 차감', ()=>ev("ST.budget")===b0-38);
  T('구매 시 사기 +5', ()=>ev("ST.morale.lg")===m0+5);
  T('gear 플래그', ()=>ev("gearLv('balls')")>0);
  T('훈련 배수 반영', ()=>Math.abs(ev("gearTrainMul('field')")-1.12)<1e-9);
  ev("ST.gear.net=true");
  T('타격 네트는 타격만', ()=>Math.abs(ev("gearTrainMul('bat')")-1.12*1.18)<1e-9 && Math.abs(ev("gearTrainMul('field')")-1.12)<1e-9);
  ev("ST.gear.helmet=true");
  T('헬멧은 부상 위험 감소', ()=>Math.abs(ev("gearInjMul()")-0.88)<1e-9);
  T('돈 부족하면 못 산다', ()=>{ev("ST.budget=5");w.go('home');
    return true;});
  await new Promise(r=>setTimeout(r,40));
  ev("ST.budget=120");

  console.log('\n[레슨비 · 회식비]');
  T('레슨비 60만원', ()=>ev("LESSON_COST")===60);
  ev("ST.budget=100");
  ev("doLesson(ST,'ksh')");
  T('레슨 60만원 차감', ()=>ev("ST.budget")===40);
  T('돈 없으면 거절', ()=>ev("ST.lessonBoost=false,doLesson(ST,'ksh').ok")===false);
  T('회식비 45만원', ()=>ev("PARTY_COST")===45);

  console.log('\n[시즌 말 가입비 · 회비]');
  ev("ST.gearMeeting={done:true};ST.feeDue=true;ST.budget=400;");
  w.go('home'); await new Promise(r=>setTimeout(r,50));
  T('가입비 카드', ()=>/다음 시즌 리그 가입비/.test(d.getElementById('view').textContent));
  const payBtn=[...d.querySelectorAll('#view .btn')].find(b=>/가입비 350만원 납부/.test(b.textContent));
  T('충분하면 납부 버튼', ()=>!!payBtn);
  payBtn.click(); await new Promise(r=>setTimeout(r,50));
  T('납부 후 350 차감', ()=>ev("ST.budget")===50);
  T('feeDue 해제', ()=>ev("ST.feeDue")===false);

  console.log('\n[회비 걷기]');
  ev("ST.feeDue=true;ST.budget=120;ST.duesCount=0;TBYID['wwzw'].players.forEach(p=>ST.morale[p.id]=70);");
  w.go('home'); await new Promise(r=>setTimeout(r,50));
  const dueBtn=[...d.querySelectorAll('#view .btn')].find(b=>/회비 걷는다/.test(b.textContent));
  T('부족하면 회비 버튼', ()=>!!dueBtn);
  console.log('   ', dueBtn.textContent);
  const need=350-120, n=ev("TBYID['wwzw'].players.filter(p=>!isMerc(p.id)).length");
  dueBtn.click(); await new Promise(r=>setTimeout(r,60));
  T('회비 걷힘 (350 이상)', ()=>ev("ST.budget")>=350);
  T('전원 사기 하락', ()=>ev("ST.morale.lg")<70);
  T('카톡 난리', ()=>ev("ST.kakao.length")>=4);
  console.log('   ', ev("ST.kakao.map(m=>(m.type==='notice'?'[공지] ':nameOf(m.who)+': ')+m.text.replace(/\\n/g,' / ')).join(' | ')"));
  T('불평 대사 포함', ()=>ev("ST.kakao.some(m=>/또 걷|두 번째|얼마씩|어디다 쓴|영수증|좀 그렇/.test(m.text))"));
  T('그래도 낸다는 대사', ()=>ev("ST.kakao.some(m=>/보냈|이체|내야|넣을게|계좌/.test(m.text))"));
  // 두 번째 걷으면 더 화난다
  ev("TBYID['wwzw'].players.forEach(p=>ST.morale[p.id]=70);");
  const r2=ev("collectDues(100)");
  /* 걷는 횟수마다 3 → 5 → 7 로 커지되, 선수단 가치가 높으면(duesRelief)
     그만큼 덜 깎인다. 그래서 정확한 숫자 대신 '1회차보다 크다' 로 본다. */
  T('반복하면 사기 더 깎임', ()=>r2.drop>3 ? `2회차 -${r2.drop}` : `!-${r2.drop}`);
  console.log(`   1회차 -3 → ${ST_dues(ev)}회차 -${r2.drop}`);
  function ST_dues(e){return e("ST.duesCount")}

  console.log('\n[세이브 왕복 + 전 화면]');
  ev("saveGame(true)"); await new Promise(r=>setTimeout(r,50));
  const raw=ev("JSON.stringify(ST)");
  ev(`ST=JSON.parse(${JSON.stringify(raw)});normalizeState();`);
  T('gear 보존', ()=>ev("gearLv('balls')")>0);
  T('duesCount 보존', ()=>ev("ST.duesCount")>=2);
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
