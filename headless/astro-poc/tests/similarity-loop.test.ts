import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {it} from 'node:test';
const component=readFileSync(new URL('../src/components/SimilarityLoop.astro',import.meta.url),'utf8');
function triangle(cls:string){
  const path=component.match(new RegExp(`<path d="M([\\d.]+) ([\\d.]+) L([\\d.]+) ([\\d.]+) L([\\d.]+) ([\\d.]+) Z" class="${cls}"`));
  assert.ok(path,cls);
  const [x,y,bx,by,cx,cy]=path.slice(1).map(Number);
  const points=[[x,y],[bx,by],[cx,cy]];
  return {points,sides:[Math.hypot(bx-x,by-y),Math.hypot(cx-x,cy-y),Math.hypot(cx-bx,cy-by)],area:Math.abs((bx-x)*(cy-y)-(by-y)*(cx-x))/2};
}
it('draws every corresponding side at exactly twice its partner, and area four times as large',()=>{
  const a=triangle('small-fill'),b=triangle('large-fill');
  for(let i=0;i<3;i++) assert.equal(b.sides[i]/a.sides[i],2);
  assert.equal(b.area/a.area,4);
  assert.deepEqual(a.sides.map(n=>n/20),[3,4,5]);
  assert.deepEqual(b.sides.map(n=>n/20),[6,8,10]);
  for(let i=1;i<3;i++) {
    const [x,y]=[a.points[i][0]-a.points[0][0],a.points[i][1]-a.points[0][1]];
    assert.deepEqual([b.points[i][0]-b.points[0][0],b.points[i][1]-b.points[0][1]],[-2*y || 0,2*x || 0]);
  }
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

it('doubling both dimensions creates four original square units',()=>{
  const cells=[...component.matchAll(/<rect class="unit-cell" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map(m=>m.slice(1).map(Number));
  assert.equal(cells.length,4);
  const original=component.match(/<rect class="unit-original" x="\d+" y="\d+" width="(\d+)" height="(\d+)"/);assert.ok(original);
  const [w,h]=original.slice(1).map(Number);
  assert.ok(cells.every(c=>c[2]===w&&c[3]===h));
  assert.equal(new Set(cells.map(c=>c.slice(0,2).join(','))).size,4);
  assert.deepEqual([...new Set(cells.map(c=>c[0]))],[220,220+w]);
  assert.deepEqual([...new Set(cells.map(c=>c[1]))],[24,24+h]);
  assert.equal(cells.reduce((s,c)=>s+c[2]*c[3],0),4*w*h);
});
