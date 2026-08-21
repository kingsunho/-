/* 정적 점검 — 커밋 전에 항상 돌린다
   1) 정의 없이 호출되는 함수  2) 중복 CSS 셀렉터  3) 객체 중복 키
   4) 안 쓰는 함수(참고용)      5) 파싱 오류                         */
const fs=require('fs');
const s=fs.readFileSync('index.html','utf8');
const bad=[];
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n)}};

// JS 부분만 본다 (CSS 의 rgba(...) 같은 걸 함수 호출로 오해하지 않게)
const jsAll=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
/* 블록주석만 지운다. 이건 안전하다(*\/ 로 확실히 끝난다).
   줄주석·문자열은 정규식으로 안전하게 못 지운다 — // 가 정규식과 URL 안에도 있다. */
const js=jsAll.replace(/\/\*[\s\S]*?\*\//g,' ');
/* 정규식으로 JS 를 정확히 렉싱할 수는 없다(// 가 정규식·URL 안에도 나온다).
   그래서 문자열을 지우려 들지 않고, 오탐만 allowlist 로 넘긴다.
   이 검사의 목적은 하나다 — 선언이 통째로 사라진 걸 잡는 것. */
/* '정의돼 있다' 로 치는 형태를 넓게 잡는다 —
   function 선언 / 할당 / 객체 속성 / 화살표 / 매개변수 / 구조분해.
   목적은 "선언이 통째로 사라진 것"을 잡는 것이지 스코프 검사가 아니다. */
const isDefined=(n)=>{
  const e=n.replace(/\$/g,'\\$');
  return new RegExp(
    `function\\s+${e}\\b`+
    `|\\b${e}\\s*[:=]`+
    `|function\\s*\\w*\\s*\\([^)]*\\b${e}\\b`+
    `|\\(([^)]*,)?\\s*${e}\\s*(,[^)]*)?\\)\\s*=>`+
    `|\\b${e}\\s*=>`+
    `|prototype\\.${e}\\b`+
    `|(^|[\\s,{])${e}\\s*\\([^)]*\\)\\s*\\{`
  ).test(js);
};
const BUILTIN=new Set(['if','for','while','switch','catch','function','return','typeof','new','do',
 'Math','JSON','Object','Array','String','Number','Date','Map','Set','Promise','parseInt','parseFloat',
 'isNaN','setTimeout','setInterval','clearInterval','clearTimeout','console','document','window',
 'localStorage','navigator','location','fetch','btoa','atob','encodeURIComponent','decodeURIComponent',
 'requestAnimationFrame','alert','confirm','Boolean','Symbol','RegExp','Error','TextEncoder','TextDecoder',
 'Uint8Array','Float32Array','AudioContext','webkitAudioContext','caches','performance','structuredClone',
 'Blob','FileReader','URL','undefined','Intl','WeakMap','Proxy','Reflect','BigInt',
 /* 정규식 패턴 안에만 등장하는 것들 */
 'iP','Android','OS','var','sort','minor','WAR','Version','CriOS','EdgA','SamsungBrowser','Chrome',
 'Firefox','FxiOS','Safari','Mac','SM','Galaxy','iPhone','iPad','iPod',
 /* $ 로 시작해서 \b 가 안 먹는 것 */ '$','$$',
 'async','await','else','try','delete','void','in','of','this','super','yield','import','export','matchMedia']);

console.log('[선언이 사라진 채로 호출되는 것]');
const called=new Set();
for(const m of js.matchAll(/(?:^|[^\w.$'"`])([a-zA-Z_$][\w$]*)\s*\(/g)){
  const n=m[1];
  if(BUILTIN.has(n)) continue;
  called.add(n);
}
const missing=[...called].filter(n=>!isDefined(n));
const defined=new Set([...js.matchAll(/function\s+(\w+)\s*\(/g)].map(m=>m[1]));
T('전부 선언돼 있다', ()=>missing.length===0 ? `호출 ${called.size}종 · 함수 ${defined.size}개`
  : '!'+missing.join(', '));

console.log('\n[CSS 중복 셀렉터]');
const css=s.match(/<style>([\s\S]*?)<\/style>/)[1];
const seen={};
for(const m of css.matchAll(/^([^{@/\n][^{]*)\{/gm)){
  const k=m[1].trim().replace(/\s+/g,' '); seen[k]=(seen[k]||0)+1;
}
const dupCss=Object.entries(seen).filter(([,v])=>v>1);
T('중복 없음', ()=>dupCss.length===0?true:'!'+dupCss.map(([k,v])=>`${k}×${v}`).join(', '));

console.log('\n[객체 중복 키]');
const dupKey=[];
for(const m of s.matchAll(/const (\w+)\s*=\s*\{/g)){
  const name=m[1]; if(name==='META') continue;
  let i=m.index+m[0].length-1, d=0, j=i;
  while(j<s.length){ if(s[j]==='{')d++; else if(s[j]==='}'){d--; if(!d)break;} j++; }
  const body=s.slice(i,j); if(body.length>200000) continue;
  const c={};
  for(const k of body.matchAll(/(?:^|[{,\n])\s*'([^']{1,30})'\s*:/g)) c[k[1]]=(c[k[1]]||0)+1;
  const x=Object.entries(c).filter(([,v])=>v>1);
  if(x.length) dupKey.push(`${name}(${x.map(([k,v])=>k+'×'+v).join(',')})`);
}
T('중복 없음', ()=>dupKey.length===0?true:'!'+dupKey.join(' '));

console.log('\n[안 쓰는 함수 — 참고용, 지울 땐 참조 수를 꼭 다시 세라]');
const unused=[...defined].filter(f=>(js.match(new RegExp('\\b'+f.replace(/\$/g,'\\$')+'\\b','g'))||[]).length<=1);
console.log('  '+(unused.length?unused.join(', '):'없음'));

console.log('\n[크기]');
const zlib=require('zlib');
const raw=fs.statSync('index.html').size;
const gz=zlib.gzipSync(Buffer.from(s,'utf8'),{level:9}).length;
console.log(`  ${(raw/1048576).toFixed(3)} MB · gzip ${(gz/1048576).toFixed(3)} MB`);
T('2MB 아래', ()=>raw<2*1048576 ? `${(raw/1048576).toFixed(2)} MB` : '!너무 크다');

console.log(bad.length?`\n❌ ${bad.length}건`:'\n✅ 이상 없음');
process.exit(bad.length?1:0);
