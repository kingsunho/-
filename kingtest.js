const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet/.test(e.message))errs.push('JSDOM: '+e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
process.on('unhandledRejection',()=>{});   // jsdom 의 비동기 저장 잡음 무시
setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250); ev("ST.tutDone=true");

  console.log('[시즌 시상 · 종합왕]');
  // 시즌 기록을 인위적으로 채운다
  ev(`(function(){
    const us=TBYID['wwzw'];
    us.players.forEach((p,i)=>{
      ST.bat[p.id]={g:12+i%3,pa:30+i,ab:26+i,h:8+((i*3)%12),d2:i%4,d3:i%2,hr:(i===1?4:(i===3?2:0)),
        bb:2+(i%5),hbp:i%3,k:3+(i%7),rbi:5+((i*2)%11),r:4+(i%9),sb:(i===2?14:i%6),cs:i%2};
      ST.lgBat[p.id]={...ST.bat[p.id]};
    });
    us.pitchers.forEach((p,i)=>{
      ST.pit[p.id]={g:5,gs:3,w:(i===0?6:i%3),l:2,outs:30+i*9,h:12+i*3,r:8+i*2,er:6+i*2,
        bb:5+i,k:(i===1?31:10+i*3),hbp:1,sbA:2};
      ST.lgPit[p.id]={...ST.pit[p.id]};
    });
    ST.caStart={}; us.players.forEach(p=>ST.caStart[p.id]=(ST.ca[p.id]||50)-1);
    ST.awards=buildAwards(ST);
    return true;
  })()`);
  const aw=ev("JSON.parse(JSON.stringify(ST.awards))");
  const main=aw.filter(a=>!a.king&&!a.league);
  const kings=aw.filter(a=>a.king);
  console.log('   본상:', main.map(a=>`${a.label}=${a.name}(${a.value})`).join(' · '));
  console.log('   종합왕:', kings.map(a=>`${a.label}=${a.name}(${a.value})`).join(' · '));

  T('시즌 MVP 가 WAR 기준', ()=>{const m=main.find(a=>a.label==='시즌 MVP'); return m&&/WAR/.test(m.value);});
  T('타격상이 wRC+ 기준', ()=>{const m=main.find(a=>a.label==='타격상'); return m&&/wRC\+/.test(m.value);});
  T('투수상이 WAR 기준', ()=>{const m=main.find(a=>a.label==='투수상'); return m&&/WAR/.test(m.value);});
  T('본상에서 타점상·도루상·다승상이 빠졌다', ()=>!main.some(a=>/타점상|도루상|다승상/.test(a.label)));
  const need=['수위타자','홈런왕','타점왕','득점왕','최다안타','도루왕','출루왕','장타왕','선구왕','삼진왕','평균자책왕','다승왕','이닝왕','WHIP왕'];
  T('종합왕 14부문이 다 나온다', ()=>{
    const miss=need.filter(n=>!kings.some(k=>k.label===n));
    return miss.length?('빠짐: '+miss.join(',')):true;
  });
  T('홈런왕이 실제 홈런 1위', ()=>{
    const k=kings.find(x=>x.label==='홈런왕');
    const max=ev("Math.max(...TBYID['wwzw'].players.map(p=>ST.bat[p.id].hr))");
    return k && k.value===`${max}홈런`;
  });
  T('삼진왕이 실제 탈삼진 1위', ()=>{
    const k=kings.find(x=>x.label==='삼진왕');
    const max=ev("Math.max(...TBYID['wwzw'].pitchers.map(p=>ST.pit[p.id].k))");
    return k && k.value===`${max}탈삼진`;
  });
  T('도루왕이 실제 도루 1위', ()=>{
    const k=kings.find(x=>x.label==='도루왕');
    const max=ev("Math.max(...TBYID['wwzw'].players.map(p=>ST.bat[p.id].sb))");
    return k && k.value===`${max}도루`;
  });
  T('평균자책왕이 ERA 최저', ()=>{
    const k=kings.find(x=>x.label==='평균자책왕');
    const min=ev("Math.min(...TBYID['wwzw'].pitchers.filter(p=>ST.pit[p.id].outs>=21).map(p=>era(ST.pit[p.id])))");
    return k && k.value===`ERA ${min.toFixed(2)}`;
  });

  console.log('\n[시상식 화면]');
  // 전시장 적재는 renderHome 이 직접 buildAwards 를 부를 때만 돈다
  ev("ST.awards=null; ST.hall=[]; ST.seasonOver=true;"); w.go('home'); await wait(300);
  const t=d.getElementById('view').textContent;
  T('시즌 시상식이 뜬다', ()=>/시즌 시상식/.test(t));
  T('종합왕 섹션이 따로 있다', ()=>/종합왕 · 타이틀홀더/.test(t));
  T('삼진왕이 화면에 나온다', ()=>/삼진왕/.test(t));
  T('undefined 없음', ()=>!/undefined|NaN/.test(t));
  T('전시장에 종합왕이 남는다', ()=>ev("(ST.hall||[]).some(h=>h.kind==='king')"));
  const kh=ev("JSON.parse(JSON.stringify((ST.hall||[]).filter(h=>h.kind==='king').slice(0,2)))");
  console.log('   전시장:', kh.map(h=>`${h.label}/${h.name}/${h.value}`).join(' · '));
  T('종합왕에도 선정 기준이 붙는다', ()=>kh.every(h=>h.criteria&&h.criteria.length>3));

  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
