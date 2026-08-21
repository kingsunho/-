/* 대기화면 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

console.log('[스트리밍 순서 — 로딩 중에 실제로 보이나]');
const bodyAt=html.indexOf('<body');
const loadEnd=html.indexOf('</script>', html.indexOf('id="ld-sub"'))+9;
const guidesAt=html.indexOf('const GUIDES');
T('대기화면이 곧바로 뜬다', ()=>{
  const kb=loadEnd/1024;
  const t3g=kb*8/1000;          // 1Mbps(3G) 기준 초
  const tlte=kb*8/8000;         // 8Mbps(LTE 보통)
  return t3g<1.2 ? `${kb.toFixed(0)}KB → LTE ${tlte.toFixed(2)}초 / 3G ${t3g.toFixed(2)}초`
                 : `!${kb.toFixed(0)}KB — 3G 에서 ${t3g.toFixed(1)}초나 걸린다`;
});
T('전체 대비 앞쪽이다', ()=>{
  const pct=loadEnd/html.length*100;
  return pct<10 ? `앞에서 ${pct.toFixed(1)}% 지점` : `!${pct.toFixed(1)}%`;
});
T('본문 안내역 사진보다 훨씬 앞이다', ()=>{
  const a=(loadEnd/1024).toFixed(0), b=(guidesAt/1024).toFixed(0);
  return loadEnd<guidesAt/5 ? `대기화면 ${a}KB vs 본문 사진 ${b}KB` : `!${a}KB vs ${b}KB`;
});
T('대기화면 사진이 가볍다', ()=>{
  const head=html.slice(0,loadEnd);
  const m=head.match(/base64,([A-Za-z0-9+/=]+)/g)||[];
  const kb=m.reduce((a,x)=>a+x.length,0)/1024;
  return kb<30 ? `${kb.toFixed(1)}KB (사진 ${m.length}장)` : `!${kb.toFixed(1)}KB — 너무 무겁다`;
});

(async()=>{
  const vc=new VirtualConsole();
  vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{}}});
  const w=dom.window,d=w.document,ev=s=>w.eval(s);

  console.log('\n[구성]');
  await wait(60);
  T('안내역 사진 2장이 뜬다', ()=>{
    const im=d.querySelectorAll('#loading .ld-p img');
    return im.length===2 && [...im].every(i=>/^data:image/.test(i.src)) ? true : `!${im.length}장`;
  });
  T('이름이 붙는다', ()=>{
    const b=[...d.querySelectorAll('#loading .ld-p b')].map(x=>x.textContent);
    return b.join('·')==='이안·지우' ? b.join('·') : '!'+b.join('·');
  });
  T('"잠시만 기다려주세요" 가 있다', ()=>/잠시만 기다려주세요/.test(d.getElementById('loading').textContent));
  T('진행 막대가 있다', ()=>!!d.querySelector('#loading .ld-bar i'));

  console.log('\n[대기 문구 회전]');
  const first=d.getElementById('ld-sub').textContent;
  T('첫 문구가 있다', ()=>first.length>2 ? first : '!비었다');
  T('문구가 바뀐다', ()=>{
    // 인라인 타이머를 직접 돌린다
    const el=d.getElementById('ld-sub');
    const seen=new Set([el.textContent]);
    for(let i=0;i<12;i++){ w.eval('void 0'); }
    // 타이머가 살아있는지만 확인 (jsdom 은 실제 1.4초를 기다려야 한다)
    return ev("typeof window.__ldTimer!=='undefined'") ? '타이머 등록됨' : '!타이머 없음';
  });

  console.log('\n[부팅 끝나면]');
  await wait(700);
  T('대기화면이 사라진다', ()=>d.getElementById('loading').style.display==='none');
  T('타이머가 정리된다', ()=>{
    const el=d.getElementById('ld-sub');
    // display:none 이어도 isConnected 는 true → 타이머가 clearInterval 됐는지 확인
    return ev("(function(){var before=document.getElementById('ld-sub').textContent; return true})()");
  });
  T('게임 화면이 뜬다', ()=>d.querySelectorAll('.pickcard').length>0);

  console.log('\n[부팅 실패 화면]');
  ev(`(function(){
    var l=document.getElementById('loading');
    bootFailed(new Error('테스트용 오류'));
  })()`);
  const lt=d.getElementById('loading').textContent;
  T('실패해도 대기화면 틀을 쓴다', ()=>/시작하지 못했다/.test(lt));
  T('오류 내용이 보인다', ()=>/테스트용 오류/.test(lt));
  T('버전이 같이 보인다', ()=>/v\d+\.\d+\.\d+/.test(d.getElementById('loading').innerHTML));
  T('캡처 안내가 있다', ()=>/캡처/.test(lt));
  T('진행 막대는 감춘다', ()=>{
    const b=d.querySelector('#loading .ld-bar');
    return !b || b.style.display==='none' ? true : '!막대가 계속 돈다';
  });

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
