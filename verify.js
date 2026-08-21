const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(require('fs').readFileSync(process.argv[2]||'index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole()});
dom.window.scrollTo=()=>{};
const ev=s=>dom.window.eval(s);
const SEEDS=[20260820,777,131313,4242,99991,20250101,555555,31337];
setTimeout(()=>{
  const rs=SEEDS.map(seed=>ev(`(function(){
    const T=buildAllTeams(); const rng=makeRng(${seed});
    let pa=0,ab=0,h=0,d2=0,d3=0,hr=0,bb=0,k=0,g=0,cold=0,runs=0;
    for(let s=0;s<8;s++)for(let i=0;i<T.length;i++)for(let j=0;j<T.length;j++){
      if(i===j)continue; if(((i*31+j*17+s*7)%9)!==0)continue;
      const res=simGame(T[j],T[i],{rng,innings:7,awayLineup:aiLineup(T[i]),awayRotation:aiRotation(T[i]),
        homeLineup:aiLineup(T[j]),homeRotation:aiRotation(T[j])});
      g++; if(res.mercy)cold++; runs+=res.away.runs+res.home.runs;
      for(const pid in res.box){const b=res.box[pid];
        pa+=b.pa;ab+=b.ab;h+=b.h;d2+=b.d2;d3+=b.d3;hr+=b.hr;bb+=b.bb;k+=b.k;}
    }
    return {g,pa,K:k/pa*100,BB:bb/pa*100,BABIP:(h-hr)/(ab-k-hr),d2r:d2/h*100,d3r:d3/h*100,hrr:hr/h*100,
      cold:cold/g*100, rpg:runs/g/2};
  })()`));
  const m=k=>rs.reduce((a,r)=>a+r[k],0)/rs.length;
  const rows=[
    ['삼진율 K%',   m('K'),    15.30, 0.5, v=>v.toFixed(2)],
    ['볼넷율 BB%',  m('BB'),   15.60, 0.5, v=>v.toFixed(2)],
    ['BABIP',       m('BABIP'), .451, .010, v=>v.toFixed(3)],
    ['2루타/안타%', m('d2r'),  16.3, 1.5, v=>v.toFixed(2)],
    ['3루타/안타%', m('d3r'),   7.5, 1.0, v=>v.toFixed(2)],
    ['홈런/안타%',  m('hrr'),   1.0, 0.5, v=>v.toFixed(2)],
  ];
  console.log(`시드 8개 · ${rs.reduce((a,r)=>a+r.g,0)}경기 · ${rs.reduce((a,r)=>a+r.pa,0)}타석\n`);
  let bad=0;
  rows.forEach(([n,v,t,tol,f])=>{
    const ok=Math.abs(v-t)<=tol; if(!ok)bad++;
    console.log(`  ${ok?'✅':'❌'} ${n.padEnd(13)} ${f(v).padStart(7)}  (목표 ${f(t)} ±${tol})`);
  });
  console.log(`\n  참고: 팀당 평균 ${m('rpg').toFixed(2)}득점 · 콜드게임 ${m('cold').toFixed(1)}%`);
  console.log(bad?`\n❌ ${bad}개 이탈`:'\n✅ 전 지표 목표 범위 내');
  process.exit(bad?1:0);
},400);
