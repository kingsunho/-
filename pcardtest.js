const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push('JSDOM: '+e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250); ev("ST.tutDone=true");
  ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;");
  w.go('game'); await wait(120);
  [...d.querySelectorAll('#view .btn')].find(x=>/자동 진행/.test(x.textContent)).click();
  for(let i=0;i<400 && !ev("LIVE&&LIVE.over");i++) await wait(20);
  await wait(200);

  console.log('[경기 끝나고 투수 카드]');
  const secs=()=>[...d.querySelectorAll('#sheet-body .ot-sec .ot-h')].map(x=>x.textContent.replace(/현재.*$/,'').trim());
  const openByRow=(cardRe,row)=>{
    const card=[...d.querySelectorAll('#view .card')].find(c=>cardRe.test((c.querySelector('.card-h')||{}).textContent||''));
    const links=card.querySelectorAll('tbody .nml, tr .nml');
    links[row].click();
  };
  // 우리 투수
  openByRow(/우완좌완 투수/,0); await wait(60);
  console.log('   섹션:', secs().join(' → '));
  T('우리 투수는 피칭 레이팅이 먼저', ()=>secs()[0]==='피칭 레이팅');
  T('오늘 투구 기록이 보인다', ()=>/이닝.*자책/.test((d.querySelector('#sheet-body .pcs-today')||{}).textContent||''));
  T('헤더 포지션이 투수', ()=>/· 투수/.test(d.querySelector('#sheet-body .pcs-n2').textContent));
  ev("closeSheet()");
  // 상대 투수
  openByRow(/ 투수$/,0);
  const cards=[...d.querySelectorAll('#view .card-h')].map(x=>x.textContent);
  const oppCard=cards.filter(x=>/ 투수$/.test(x)).find(x=>!/우완좌완/.test(x));
  openByRow(new RegExp(oppCard.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),0); await wait(60);
  console.log('   상대:', d.getElementById('sheet-title').textContent, '|', secs().join(' → '));
  T('상대 투수도 피칭 먼저', ()=>secs()[0]==='피칭 레이팅');
  T('상대 투수 오늘 기록', ()=>/이닝/.test((d.querySelector('#sheet-body .pcs-today')||{}).textContent||''));
  T('상대 투수 이름이 자리표가 아니다', ()=>!/선발/.test(d.getElementById('sheet-title').textContent));
  ev("closeSheet()");
  // 타자
  openByRow(/우완좌완 타격/,0); await wait(60);
  console.log('   타자:', secs().join(' → '));
  T('타자는 배팅 레이팅이 먼저', ()=>secs()[0]==='배팅 레이팅');
  ev("closeSheet()");

  // 확정 후 시즌 기록
  [...d.querySelectorAll('#view .btn')].find(x=>/결과 확정/.test(x.textContent)).click(); await wait(200);
  ev("openPlayerCard('swm')"); await wait(60);
  console.log('\n[확정 후] 송승민:', secs().join(' → '));
  T('던진 투수는 확정 후에도 피칭 먼저', ()=>secs()[0]==='피칭 레이팅');
  T('시즌 투수 표에 WHIP·K/9', ()=>/WHIP/.test(d.getElementById('sheet-body').textContent));
  ev("closeSheet()");

  console.log('\n[김한규 특성]');
  ev("openPlayerCard('khg')"); await wait(60);
  const body=d.getElementById('sheet-body').textContent;
  ev("closeSheet()");
  w.go('squad'); await wait(80);
  const sq=d.getElementById('view').textContent;
  T('선수단 카드에 똥차', ()=>/똥차/.test(sq));
  T('선수단 카드에 똑딱이', ()=>/똑딱이/.test(sq));
  ev("openPlayer('khg')"); await wait(80);
  const prof=d.getElementById('view').textContent;
  T('프로필 성격에 똥차 설명', ()=>/똥차.*발이 느리다/.test(prof.replace(/\s+/g,' ')));
  T('프로필 성격에 똑딱이 설명', ()=>/똑딱이.*장타가 안 나온다/.test(prof.replace(/\s+/g,' ')));
  T('히든이 아니다', ()=>ev("shownTraits('khg').includes('똥차')&&shownTraits('khg').includes('똑딱이')"));

  console.log('\n[전 화면 클린]');
  for(const v of ['home','squad','lineup','kakao','stand','stats','records','train','scout','recruit','hall','more']){
    w.go(v); await wait(50);
    if(/undefined|NaN/.test(d.getElementById('view').textContent)) errs.push(v+' undefined/NaN');
  }
  T('전 화면 클린', ()=>!errs.some(e=>/undefined\/NaN/.test(e)));
  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
