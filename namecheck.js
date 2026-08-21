const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(require('fs').readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole()});
dom.window.scrollTo=()=>{};
const ev=s=>dom.window.eval(s);
setTimeout(()=>{
  const r=ev(`(function(){
    const T=buildAllTeams();
    const bad=[], dup=[];
    const out=T.filter(t=>t.id!=='wwzw').map(t=>{
      const ns=(t.pitchers||[]).map(p=>p.name);
      ns.forEach(n=>{ if(/선발|선수\\d/.test(n)) bad.push(t.name+':'+n); });
      const seen={}; ns.forEach(n=>{ if(seen[n])dup.push(t.name+':'+n); seen[n]=1; });
      // 야수와 투수 이름이 겹치는지도 본다
      return t.name+' → '+ns.join(', ');
    });
    // 두 번 빌드해서 같은 이름이 나오는지(결정성)
    const T2=buildAllTeams();
    const stable=T.every((t,i)=>(t.pitchers||[]).every((p,j)=>p.name===T2[i].pitchers[j].name));
    return {out,bad,dup,stable};
  })()`);
  r.out.forEach(x=>console.log('  '+x));
  console.log('\n자리표 이름 남음:', r.bad.length?r.bad:'없음');
  console.log('팀 내 중복:', r.dup.length?r.dup:'없음');
  console.log('재빌드 시 동일:', r.stable);
  process.exit((r.bad.length||r.dup.length||!r.stable)?1:0);
},500);
