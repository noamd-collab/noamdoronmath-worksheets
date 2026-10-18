import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {it} from 'node:test';
const component=readFileSync(new URL('../src/components/SimilarityLoop.astro',import.meta.url),'utf8');
function triangle(cls:string){
  const path=component.match(new RegExp(`<path d="M([\\d.]+) ([\\d.]+) V([\\d.]+) L([\\d.]+) ([\\d.]+) Z" class="${cls}"`));
  assert.ok(path,cls);
  const [x,y,top,right,bottom]=path.slice(1).map(Number);
  return {sides:[Math.abs(y-top),Math.abs(right-x),Math.hypot(right-x,bottom-top)],area:Math.abs(y-top)*Math.abs(right-x)/2};
}
it('draws every corresponding side at exactly twice its partner, and area four times as large',()=>{
  const a=triangle('small-fill'),b=triangle('large-fill');
  for(let i=0;i<3;i++) assert.equal(b.sides[i]/a.sides[i],2);
  assert.equal(b.area/a.area,4);
  assert.deepEqual(a.sides.map(n=>n/20),[3,4,5]);
  assert.deepEqual(b.sides.map(n=>n/20),[6,8,10]);
});
it('the area dissection really contains four copies of the small triangle',()=>{
  const paths=[...component.matchAll(/<path d="([^"]+)" class="tile-(?:one|two|three|four)"/g)].map(m=>m[1]);
  assert.equal(paths.length,4);
  const areas=paths.map(path=>{
    let x=0,y=0;
    const points:number[][]=[];
    for(const cmd of path.matchAll(/([MLHV])([\d. ]+)/g)){
      const n=cmd[2].trim().split(/\s+/).map(Number);
      if(cmd[1]==='M'||cmd[1]==='L'){x=n[0];y=n[1];}
      if(cmd[1]==='H')x=n[0];
      if(cmd[1]==='V')y=n[0];
      points.push([x,y]);
    }
    return Math.abs(points.reduce((sum,p,i)=>{const next=points[(i+1)%points.length];return sum+p[0]*next[1]-next[0]*p[1];},0))/2;
  });
  assert.ok(areas.every(a=>a===triangle('small-fill').area));
  assert.equal(areas.reduce((a,b)=>a+b,0),triangle('large-fill').area);
});
