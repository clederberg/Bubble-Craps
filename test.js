const C = require('./engine.js'); const assert = require('assert');
let n=0; const eq=(a,b,m)=>{n++; assert.deepStrictEqual(a,b,m);};
function T(mode, bets, point=null){ const t=C.newTable(mode); t.point=point; Object.assign(t.bets,bets); return t; }

// Craps come-out
let t=T('craps',{pass:1000,dp:1000}); let r=C.roll(t,3,4); eq(r.back,1000,'7 pays pass profit, keeps flat'); eq(t.bets,{pass:1000},'dp lost');
t=T('craps',{pass:1000,dp:1000}); r=C.roll(t,6,6); eq(t.bets,{dp:1000}); eq(r.back,0,'12: pass loses, dp push');
t=T('craps',{pass:1000,dp:1000}); r=C.roll(t,1,2); eq(t.bets,{dp:1000}); eq(r.back,1000);
t=T('craps',{pass:1000}); C.roll(t,2,4); eq(t.point,6);
// Pass odds on 6, 5x cap
eq(C.add(t,'passOdds',10000).added,5000);
r=C.roll(t,4,2); eq(r.back,1000+5000+6000,'point made: flat profit + odds back + 6:5'); eq(t.point,null); eq(t.bets,{pass:1000});
// seven out
t=T('craps',{pass:1000,passOdds:2000,dp:1000,dpOdds:2000},4); r=C.roll(t,3,4); eq(r.back,1000+2000+1000,'dp profit, lay odds 2000 wins 1000'); eq(t.bets,{dp:1000});
eq(C.canAdd(T('craps',{},4),'pass')!=='',true); eq(C.canAdd(T('crapless',{}),'dp')!=='',true);
// Place/buy/lay
t=T('craps',{'place:6':600,'place:4':500,'buy:4':2000,'lay:10':4000},6);
r=C.roll(t,2,2); eq(r.back,900+4000-100,'place4 9:5, buy4 2:1 minus $1'); eq(Object.keys(t.bets).length,4);
r=C.roll(t,3,4); eq(r.back,2000-100,'lay10 wins 2000 minus 5%'); eq(t.bets,{'lay:10':4000});
// place off on come-out
t=T('craps',{'place:6':600,'hard:6':500}); r=C.roll(t,3,4); eq(r.back,0); eq(t.bets,{'place:6':600,'hard:6':500});
// hardways
t=T('craps',{'hard:6':500,'hard:8':500},5); r=C.roll(t,3,3); eq(r.back,4500); r=C.roll(t,2,4); eq(t.bets,{'hard:8':500});
// come bets
t=T('craps',{come:1000},5); r=C.roll(t,5,6); eq(r.back,2000); eq(t.bets,{});
t=T('craps',{come:1000},5); C.roll(t,4,4); eq(t.bets,{'comeOn:8':1000});
C.add(t,'comeOdds:8',5000); r=C.roll(t,4,4); eq(r.back,1000+1000+5000+6000); eq(t.bets,{});
// come odds off on come-out
t=T('craps',{'comeOn:9':1000,'comeOdds:9':2000}); r=C.roll(t,5,2); eq(r.back,2000,'odds returned, flat lost'); eq(t.bets,{});
t=T('craps',{'comeOn:9':1000,'comeOdds:9':2000}); r=C.roll(t,5,4); eq(r.back,2000+2000); eq(t.point,9);
// new come bet does not get paid on same roll as existing come bet on number
t=T('craps',{'comeOn:5':1000,come:1000},8); r=C.roll(t,2,3); eq(r.back,2000); eq(t.bets,{'comeOn:5':1000});
// don't come
t=T('craps',{dc:1000},5); C.roll(t,6,6); eq(t.bets,{dc:1000});
C.roll(t,2,2); eq(t.bets,{'dcOn:4':1000}); C.add(t,'dcOdds:4',100000); eq(t.bets['dcOdds:4'],10000);
r=C.roll(t,3,4); eq(r.back,1000+1000+10000+5000);
// field & props
t=T('craps',{field:1000,'prop:twelve':100,'prop:horn':400,'prop:ce':200,'prop:anyCraps':100}); r=C.roll(t,6,6);
eq(r.back,3000+3000+2700+600+700,'field 3x, twelve 30, horn 27u, ce 3x, craps 7x');
t=T('craps',{field:1000,'prop:any7':100}); r=C.roll(t,3,4); eq(r.back,400); eq(t.bets,{'prop:any7':100});
t=T('craps',{'prop:ce':100,'prop:horn':400}); r=C.roll(t,5,6); eq(r.back,700+1200);
// crapless
t=T('crapless',{pass:1000}); C.roll(t,1,1); eq(t.point,2); C.add(t,'passOdds',1000); r=C.roll(t,1,1); eq(r.back,1000+1000+6000);
t=T('crapless',{pass:1000}); r=C.roll(t,5,6); eq(t.point,11); eq(r.back,0);
t=T('crapless',{come:1000},4); C.roll(t,6,6); eq(t.bets,{'comeOn:12':1000});
t=T('crapless',{'place:3':400,'place:12':200,'buy:2':1000},6); r=C.roll(t,1,2); eq(r.back,1100); r=C.roll(t,1,1); eq(r.back,6000-50);
r=C.roll(t,6,6); eq(r.back,1100);
// ATS
t=T('craps',{'ats:small':100,'ats:all':100}); for (const [a,b] of [[1,1],[1,2],[2,2],[2,3],[3,3]]) r=C.roll(t,a,b);
eq(r.back,100+3400); eq(C.canAdd(t,'ats:tall')!=='',true); eq(C.canRemove(t,'ats:all')!=='',true);
r=C.roll(t,3,4); eq(t.bets,{}); eq(t.atsHits,[]); eq(C.canAdd(t,'ats:tall'),'');
// removal
t=T('craps',{pass:1000,passOdds:2000,'place:6':600},6); eq(C.remove(t,'pass').ok,false); eq(C.removeAll(t),2600); eq(t.bets,{pass:1000});
t=T('craps',{pass:1000,passOdds:0}); eq(C.remove(t,'pass').removed,1000);
// random sim: money conservation (bank + on table changes only by net)
function rnd(){return 1+Math.floor(Math.random()*6);}
for (const mode of ['craps','crapless']) { const t=C.newTable(mode); let bank=1e9;
  const keys=['pass','passOdds','dp','dpOdds','come','dc','field','hard:4','hard:10','prop:horn','prop:ce','prop:any7','ats:all','ats:small',
   ...C.MODES[mode].points.flatMap(n=>['place:'+n,'buy:'+n,'lay:'+n,'comeOdds:'+n,'dcOdds:'+n])];
  for (let i=0;i<200000;i++){ for (let j=0;j<3;j++){ const k=keys[Math.floor(Math.random()*keys.length)]; const a=C.add(t,k,100*(1+Math.floor(Math.random()*20))); if(a.ok) bank-=a.added; }
    if (Math.random()<.05){ bank+=C.removeAll(t);} 
    const before=bank+C.onTable(t); const r=C.roll(t,rnd(),rnd()); bank+=r.back;
    assert.strictEqual(bank+C.onTable(t)-before, r.net, 'conservation '+mode+' '+JSON.stringify(r));
    for (const k in t.bets) assert.ok(t.bets[k]>0 && Number.isInteger(t.bets[k]), k);
  }
}
console.log('all passed', n, 'asserts + 400k sim rolls');
