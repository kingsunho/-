/* 갤럭시(삼성인터넷) 제보 재현/검증 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));return !!r;}catch(e){console.log('  ❌ '+n+' :: '+e.message);return false}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SAMSUNG='Mozilla/5.0 (Linux; Android 13; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.5481.154 Mobile Safari/537.36';
let bad=0;

async function run(label,{ua,breakStorage,width}){
  console.log('\n['+label+']');
  const vc=new VirtualConsole();
  const errs=[];
  vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet/.test(e.message))errs.push(e.message)});
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://kingsunho.github.io/kim/',
    virtualConsole:vc, beforeParse(win){
      Object.defineProperty(win.navigator,'userAgent',{value:ua,configurable:true});
    }});
  const w=dom.window,d=w.document,ev=s=>w.eval(s);
  w.scrollTo=()=>{}; w.confirm=()=>true;
  if(width) Object.defineProperty(w,'innerWidth',{value:width,configurable:true});
  if(breakStorage){
    // 삼성인터넷 시크릿 모드 / 사이트 데이터 차단 상황
    Object.defineProperty(w,'localStorage',{configurable:true,get(){throw new Error('SecurityError: storage blocked')}});
  }
  await wait(600);
  if(!T('버전 배지가 뜬다', ()=>/^v\d+\.\d+\.\d+$/.test(d.getElementById('appver').textContent)
       ? true : '배지='+JSON.stringify(d.getElementById('appver').textContent))) bad++;
  if(!T('배지는 안 줄어드는 flex 아이템', ()=>{
    const css=html.match(/\.topbar \.ver\{[^}]*\}/)[0];
    return /flex:0 0 auto/.test(css)&&/white-space:nowrap/.test(css);
  })) bad++;
  if(!T('로딩 화면이 걷힌다', ()=>{
    const l=d.getElementById('loading');
    return l.style.display==='none' || /시작하지 못했다/.test(l.textContent)
      ? (l.style.display==='none'?true:'부팅 실패 화면: '+l.textContent.replace(/\s+/g,' ').slice(0,90)) : '로딩 그대로';
  })) bad++;
  if(!T('브라우저 판별', ()=>{const t=ev('browserTag()');
    return /삼성인터넷/.test(t)&&/갤럭시/.test(t)&&/안드로이드/.test(t)?t:'판별 실패: '+t;})) bad++;
  if(!T('치명적 오류 없음', ()=>errs.length?errs.join(' | '):true)) bad++;
  // 더보기 진단 패널
  try{
    ev("if(!ST){ST=newSeason();ST.lineup=recommendLineup();ST.rotation=recommendRotation();MYID='ksh';}");
    w.go('more'); await wait(120);
    const t=d.getElementById('view').textContent;
    if(!T('환경 정보 패널', ()=>/환경 정보/.test(t)&&/저장소/.test(t)&&/브라우저/.test(t))) bad++;
    if(!T('저장소 상태를 옳게 잡는다', ()=>{
      const m=t.match(/저장소(정상|막힘[^화]*)/);
      if(!m) return '못 찾음';
      return breakStorage ? (/막힘/.test(m[1])?true:'막혔는데 정상이라고 나옴')
                          : (/정상/.test(m[1])?true:'정상인데 막혔다고 나옴');
    })) bad++;
    if(!T('새 버전 확인 버튼', ()=>/지금 새 버전 확인/.test(t))) bad++;
    if(!T('undefined/NaN 없음', ()=>!/undefined|NaN/.test(t))) bad++;
  }catch(e){ console.log('  ❌ 더보기 렌더 :: '+e.message); bad++; }
  dom.window.close();
}

(async()=>{
  await run('삼성인터넷 · 갤럭시 S23 · 360px', {ua:SAMSUNG,width:360});
  await run('삼성인터넷 · 저장소 차단(시크릿)', {ua:SAMSUNG,width:360,breakStorage:true});
  await run('갤럭시 폴드 커버 · 280px', {ua:SAMSUNG,width:280});
  console.log(bad?`\n❌ ${bad}건`:'\n✅ 전부 통과');
  process.exit(bad?1:0);
})();
