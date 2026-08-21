/* 튜토리얼 · 버전 안내 모달 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
    w.requestAnimationFrame=f=>setTimeout(f,0);}});
const w=dom.window,d=w.document,ev=s=>w.eval(s); w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};

(async()=>{
  await wait(700);
  console.log('[튜토리얼]');
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(320);
  const N=ev("TUTORIAL.length");
  T('새 게임이면 튜토리얼부터', ()=>/이게 무슨 게임이냐/.test(d.getElementById('view').textContent));
  T('단계가 늘었다', ()=>N>=20 ? `${N}단계` : `!${N}단계`);
  T('진행 표시가 단계 수와 맞는다', ()=>d.querySelectorAll('#view .tut-dots i').length===N);
  const titles=[];
  let dirty=[];
  for(let i=0;i<N;i++){
    const t=d.getElementById('view').textContent;
    titles.push(d.querySelector('#view .card-h').textContent);
    if(/undefined|NaN|\[object/.test(t)) dirty.push(i+1);
    if(t.length<120) dirty.push(`${i+1}(내용부실)`);
    const nx=[...d.querySelectorAll('#view .btn')].find(b=>/다음 →|시작한다/.test(b.textContent));
    if(!nx){ dirty.push(`${i+1}(버튼없음)`); break; }
    nx.click(); await wait(35);
  }
  T('전 단계 클린', ()=>dirty.length?('!'+dirty.join(',')):true);
  T('새 기능이 다 들어갔다', ()=>{
    const all=titles.join(' ');
    const need=['화면 보는 법','진기록','리그 전체','감독 액션','소리'];
    const miss=need.filter(x=>!all.includes(x));
    return miss.length?('!빠짐: '+miss.join(',')):`${need.length}개 확인`;
  });
  T('중복 설명이 없다', ()=>{
    const body=ev("TUTORIAL.map(t=>t.b).join('')");
    const dup=['3% 확률로 본인 발을 다친다','헤더를 누르면 정렬']
      .filter(x=>(body.split(x).length-1)>1);
    return dup.length?('!중복: '+dup.join(',')):true;
  });
  T('끝나면 홈으로', ()=>ev("ST.tutDone")===true);

  console.log('\n[변경 내역 데이터]');
  T('CHANGELOG 가 있다', ()=>ev("CHANGELOG.length")>=6 ? `${ev("CHANGELOG.length")}개 버전` : '!부족');
  T('맨 위가 현재 버전', ()=>ev("CHANGELOG[0].v")===ev("APP_VERSION")
    ? ev("CHANGELOG[0].v") : `!${ev("CHANGELOG[0].v")} vs ${ev("APP_VERSION")}`);
  T('버전 사이 변경만 골라낸다', ()=>{
    const n=ev("changesBetween('2.3.0','2.5.0').map(c=>c.v).join(',')");
    return n==='2.5.0,2.4.0' ? n : `!${n}`;
  });
  T('같은 버전이면 빈 배열', ()=>ev("changesBetween(APP_VERSION,APP_VERSION).length")===0);

  console.log('\n[업그레이드 완료 안내]');
  ev("showVerNote('done',{prev:'2.2.0'})"); await wait(60);
  T('모달이 뜬다', ()=>!!d.getElementById('vernote'));
  const vt=()=>d.getElementById('vernote').textContent;
  T('안내역 사진이 있다', ()=>{
    const im=d.querySelector('#vernote .vn-pic img');
    return im && /^data:image/.test(im.src) ? true : '!사진 없음';
  });
  T('바뀐 내용이 나열된다', ()=>{
    const li=d.querySelectorAll('#vernote .vn-ul li').length;
    return li>=5 ? `${li}줄` : `!${li}줄`;
  });
  T('기록이 안 지워진다고 안내', ()=>/기록은 그대로/.test(vt()));
  T('닫기 버튼이 있다', ()=>[...d.querySelectorAll('#vernote .btn')].some(b=>/확인했어요/.test(b.textContent)));
  T('튜토리얼 다시 보기 버튼', ()=>[...d.querySelectorAll('#vernote .btn')].some(b=>/튜토리얼/.test(b.textContent)));
  T('undefined 없음', ()=>!/undefined|NaN/.test(vt()));
  T('닫으면 사라진다', ()=>{
    [...d.querySelectorAll('#vernote .btn')].find(b=>/확인했어요/.test(b.textContent)).click();
    return true;
  });
  await wait(300);
  T('DOM 에서 제거된다', ()=>!d.getElementById('vernote'));

  console.log('\n[새 버전 알림]');
  ev("showVerNote('new',{latest:'9.9.9'})"); await wait(60);
  T('모달이 뜬다', ()=>!!d.getElementById('vernote'));
  T('지금 버전과 새 버전을 같이 보여준다', ()=>{
    const t=d.getElementById('vernote').textContent;
    return t.includes(ev("APP_VERSION"))&&t.includes('9.9.9') ? true : '!버전 표기 없음';
  });
  T('지금 받기 버튼', ()=>[...d.querySelectorAll('#vernote .btn')].some(b=>/지금 받기/.test(b.textContent)));
  T('나중에 버튼', ()=>[...d.querySelectorAll('#vernote .btn')].some(b=>/나중에/.test(b.textContent)));
  T('나중에 누르면 닫힌다', ()=>{
    [...d.querySelectorAll('#vernote .btn')].find(b=>/나중에/.test(b.textContent)).click();
    return true;
  });
  await wait(300);
  T('닫힌다', ()=>!d.getElementById('vernote'));

  console.log('\n[실제 업그레이드 경로]');
  T('세이브 버전이 낮으면 안내가 뜬다', ()=>{
    ev("ST.appVer='2.0.0'; checkVersion();");
    return true;
  });
  await wait(1100);
  T('checkVersion 이 모달을 띄운다', ()=>!!d.getElementById('vernote'));
  T('세이브 버전이 갱신된다', ()=>ev("ST.appVer")===ev("APP_VERSION"));
  ev("closeVerNote()"); await wait(250);

  console.log('\n[더보기에서 다시 보기]');
  w.go('more'); await wait(120);
  const rb=[...d.querySelectorAll('#view .btn')].find(x=>/뭐가 바뀌었나/.test(x.textContent));
  T('버튼이 있다', ()=>!!rb);
  if(rb){ rb.click(); await wait(60);
    T('모달이 뜬다', ()=>!!d.getElementById('vernote'));
    T('undefined 없음', ()=>!/undefined|NaN/.test(d.getElementById('vernote').textContent));
    ev("closeVerNote()"); }

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
