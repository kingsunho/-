/* v2.0.2 사진 검증 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc, beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};

(async()=>{
  await wait(700);
  console.log('[선수 선택 화면]');
  const cards=[...d.querySelectorAll('.pickcard')];
  T('선수 선택 카드가 뜬다', ()=>cards.length>0?`${cards.length}장`:'!0장');
  // 선수 선택 화면은 원래 사진을 안 쓴다(텍스트 목록). 깨지지만 않으면 된다.
  T('선택 카드에 이름·포지션이 다 있다', ()=>{
    const miss=cards.filter(c=>!c.querySelector('.pk-nm')||!c.textContent.trim());
    return miss.length===0 ? true : `!${miss.length}장 비었다`;
  });

  cards[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  console.log('\n[사진이 실제로 붙는 자리]');
  const check=(label,fn)=>T(label,fn);
  for(const pid of ['ksh','kig','khg']){
    const nm=ev(`nameOf('${pid}')`);
    // 프로필
    ev(`profileId='${pid}'`); w.go('player'); await wait(80);
    const pImg=d.querySelector('#view .ot-pic img.pf-photo');
    check(`${nm} 프로필 사진`, ()=>pImg && /^data:image\/jpeg;base64,/.test(pImg.src)
      ? `${Math.round(pImg.src.length/1024)}KB` : '!사진 없음');
    // 선수 카드(시트)
    ev(`openPlayerCard('${pid}')`); await wait(60);
    const cImg=d.querySelector('#sheet-body .pcs-av img');
    check(`${nm} 선수 카드 사진`, ()=>cImg && /^data:image/.test(cImg.src) ? true : '!사진 없음');
    ev("closeSheet()");
    // 전시장
    ev(`hallWho='${pid}'`); w.go('hall'); await wait(80);
    const hImg=d.querySelector('#view .ot-pic img.pf-photo');
    check(`${nm} 전시장 사진`, ()=>hImg && /^data:image/.test(hImg.src) ? true : '!사진 없음');
  }

  console.log('\n[사진 없는 선수는 안 깨지나]');
  for(const pid of ['swm','lg','lmh']){
    const nm=ev(`nameOf('${pid}')`);
    ev(`profileId='${pid}'`); w.go('player'); await wait(70);
    const t=d.getElementById('view').textContent;
    const box=d.querySelector('#view .ot-pic');
    T(`${nm} — 대체 아바타`, ()=>box && box.children.length>0 && !/undefined/.test(t)
      ? true : '!아바타 자리가 비었다');
  }

  console.log('\n[사진이 세이브를 부풀리지 않나]');
  T('세이브에 사진이 안 들어간다', ()=>{
    const j=JSON.stringify(ev("ST"));
    return !/data:image/.test(j) ? `세이브 ${Math.round(j.length/1024)}KB` : '!세이브에 base64 가 섞였다';
  });
  T('내보내기 코드에도 안 들어간다', ()=>{
    const code=ev("packSave(JSON.stringify(ST))");
    return code.length<200000 ? `${Math.round(code.length/1024)}KB` : `!${Math.round(code.length/1024)}KB — 너무 크다`;
  });

  console.log('\n[전 화면]');
  const views=['home','squad','lineup','kakao','game','stand','stats','records','train','scout','recruit','hall','more','player'];
  const dirty=[];
  for(const v of views){
    w.go(v); await wait(55);
    const t=(d.getElementById('view')||{}).textContent||'';
    if(/undefined|NaN|\[object Object\]/.test(t)) dirty.push(v);
    // 깨진 이미지 태그 탐지
    const broken=[...d.querySelectorAll('#view img')].filter(i=>!i.getAttribute('src'));
    if(broken.length) dirty.push(`${v}: src 없는 img ${broken.length}개`);
  }
  T('전 화면 클린', ()=>dirty.length===0?true:'!'+dirty.join(', '));
  T('치명적 오류 없음', ()=>bad.filter(x=>/JSDOM/.test(x)).length===0);

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
