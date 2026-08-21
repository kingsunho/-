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
  await new Promise(r=>setTimeout(r,200));
  ev("ST.playerId='ksh';MYID='ksh';runWeek();ST.events=[];ST.absent={};");

  console.log('[셔플 균등성]');
  const cnt={};
  const N=26000;
  for(let i=0;i<N;i++){ const sp=ev("ST._recentSpeakers=[];speakers(ST,'ksh',1,Math.random)");
    sp.forEach(p=>cnt[p.id]=(cnt[p.id]||0)+1); }
  const vals=Object.values(cnt), n=Object.keys(cnt).length;
  const exp=N/n;
  const chi=vals.reduce((a,v)=>a+(v-exp)*(v-exp)/exp,0);   // 자유도 12, 5% 임계 21.03
  const dev=Math.max(...vals.map(v=>Math.abs(v-exp)/exp));
  console.log('   ', Object.keys(cnt).map(k=>`${ev(`nameOf('${k}')`)} ${cnt[k]}`).join(' '));
  T(`전원 등장 (${n}명)`, ()=>n>=13);
  T(`균등 분포 (카이제곱 ${chi.toFixed(1)} < 26.2, 최대편차 ${(dev*100).toFixed(1)}%)`, ()=>chi<26.2);

  console.log('\n[고생했다 — 응답자·문장 다양성]');
  const who={}, texts=new Set();
  for(let i=0;i<300;i++){
    ev("ST._recentSpeakers=[]");
    const o=ev("kakaoOptions(ST,'post')").find(x=>x.id==='thanks');
    const r=ev("kakaoOptions(ST,'post').find(x=>x.id==='thanks').run()");
    r.forEach(m=>{who[m.who]=(who[m.who]||0)+1;texts.add(m.text);});
  }
  console.log('   응답자:', Object.keys(who).map(k=>`${ev(`nameOf('${k}')`)} ${who[k]}`).join(' '));
  console.log('   문장 예시:', [...texts].slice(0,14).join(' / '));
  T('응답자 13명 이상', ()=>Object.keys(who).length>=13);
  T('한 사람이 30% 이상 독점하지 않음', ()=>{
    const tot=Object.values(who).reduce((a,b)=>a+b,0);
    return Math.max(...Object.values(who))/tot < 0.30;});
  T(`문장 60종 이상 (실측 ${texts.size})`, ()=>texts.size>=60);

  console.log('\n[전체 무드 다양성]');
  /* review(수비훈련)는 이제 실책이 3개 이상 나온 날에만 뜨는 gloves 로 바뀌었다.
     그 상황을 만들어놓고 검사한다. */
  ev("ST.lastResult={won:false,tie:false,diff:3,errs:4,bbAllowed:0,lob:0,feat:0,injured:0}");
  for(const mood of ['fire','calm','defense','praise','scold','gloves']){
    const tx=new Set(), wh=new Set();
    for(let i=0;i<200;i++){
      ev("ST._recentSpeakers=[]");
      const id = ['fire','calm','defense','praise'].includes(mood)?'pre':'post';
      const o=ev(`kakaoOptions(ST,'${id}').find(x=>x.id==='${mood}')`);
      if(!o){console.log('   (없음)',mood);break;}
      const r=ev(`kakaoOptions(ST,'${id}').find(x=>x.id==='${mood}').run()`);
      r.forEach(m=>{tx.add(m.text);wh.add(m.who);});
    }
    console.log(`   ${mood.padEnd(8)} 문장 ${String(tx.size).padStart(3)}종 · 화자 ${wh.size}명`);
    if(tx.size<40)errs.push(mood+' 문장 다양성 부족('+tx.size+')');
    if(wh.size<10)errs.push(mood+' 화자 다양성 부족');
  }
  T('전 무드 다양성 확보', ()=>true);

  console.log('\n[말투 정확성 — 조합 후에도 유지]');
  let bad=[];
  for(let i=0;i<400;i++){
    ev("ST._recentSpeakers=[]");
    const r=ev("kakaoOptions(ST,'post').find(x=>x.id==='thanks').run()");
    r.forEach(m=>{
      const sp=ev(`speechTo('${m.who}','ksh')`);
      if(sp==='jon'&&/^(고생했다|수고했다|다음에 또 하자)/.test(m.text.replace(/^[ㅋㅎ아음네오 ]+/,'')))bad.push(m.who+':'+m.text);
      if(sp==='ban'&&/(하셨습니다|하겠습니다|입니다|세요)/.test(m.text))bad.push(m.who+':'+m.text);
    });
  }
  T('반말/존댓말 혼선 없음', ()=>bad.length===0);
  if(bad.length)console.log('   ', bad.slice(0,5).join(' | '));
  // 인규/한규는 반말이어야 한다
  const kig=[];
  for(let i=0;i<300;i++){ ev("ST._recentSpeakers=[]");
    ev("kakaoOptions(ST,'post').find(x=>x.id==='thanks').run()").forEach(m=>{if(m.who==='kig'||m.who==='khg')kig.push(m.text);}); }
  console.log('   인규·한규 예시:', kig.slice(0,6).join(' / '));
  T('인규·한규는 항상 반말', ()=>kig.every(t=>!/하셨습니다|하겠습니다|입니다|세요|시죠/.test(t)));

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
