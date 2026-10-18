import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {it} from 'node:test';
const close=(a:number,b:number,tolerance=1e-4)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
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
  for(let i=0;i<3;i++) close(b.sides[i]/a.sides[i],2);
  close(b.area/a.area,4);
  a.sides.forEach((side,i)=>close(side/50,[1,2,1.8][i]));
  b.sides.forEach((side,i)=>close(side/50,[2,4,3.6][i]));
  for(let i=1;i<3;i++) {
    const [x,y]=[a.points[i][0]-a.points[0][0],a.points[i][1]-a.points[0][1]];
    close(b.points[i][0]-b.points[0][0],-2*y);close(b.points[i][1]-b.points[0][1],2*x);
  }
});
it('triangle area uses the same unit grid and one complete cell becomes four cells inside the larger triangle',()=>{
  const cells=[...component.matchAll(/<rect class="unit-cell" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map(m=>m.slice(1).map(Number));
  assert.equal(cells.length,4);
  const original=component.match(/<rect class="unit-original" x="\d+" y="\d+" width="(\d+)" height="(\d+)"/);assert.ok(original);
  const [w,h]=original.slice(1).map(Number);
  assert.ok(cells.every(c=>c[2]===w&&c[3]===h));
  assert.equal(new Set(cells.map(c=>c.slice(0,2).join(','))).size,4);
  assert.deepEqual([...new Set(cells.map(c=>c[0]))],[190,190+w]);
  assert.deepEqual([...new Set(cells.map(c=>c[1]))],[75,75+h]);
  assert.equal(cells.reduce((s,c)=>s+c[2]*c[3],0),4*w*h);
  assert.equal(w,28);assert.equal(h,28);
  assert.equal((component.match(/class="square-unit-pattern" width="28" height="28"/g)||[]).length,2);
  for(const cls of ['small','large']){
    const gridPath=component.match(new RegExp('<path d="([^"<>]+)" class="area-'+cls+'"'))?.[1];
    assert.equal(gridPath,component.match(new RegExp('<path d="([^"<>]+)" class="'+cls+'-fill"'))?.[1]);
    assert.ok(component.includes('class="triangle-unit-grid" fill={`url(#${gridId}-'+cls+')`}'));
  }
  const inside=(point:number[],vertices:number[][])=>{
    const cross=vertices.map((a,i)=>{const b=vertices[(i+1)%3];return (b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);});
    return cross.every(v=>v>=0)||cross.every(v=>v<=0);
  };
  for(const [x,y,cw,ch] of cells)for(const point of [[x,y],[x+cw,y],[x,y+ch],[x+cw,y+ch]])assert.ok(inside(point,triangle('large-fill').points));
  const originalPosition=component.match(/<rect class="unit-original" x="(\d+)" y="(\d+)"/);assert.ok(originalPosition);
  const [ox,oy]=originalPosition.slice(1).map(Number);
  const [A]=triangle('small-fill').points,[D]=triangle('large-fill').points;
  const mapped=[];
  for(const point of [[ox,oy],[ox+w,oy],[ox,oy+h],[ox+w,oy+h]]){
    assert.ok(inside(point,triangle('small-fill').points));
    mapped.push([D[0]-2*(point[1]-A[1]),D[1]+2*(point[0]-A[0])]);
  }
  close(Math.min(...mapped.map(p=>p[0])),190);close(Math.max(...mapped.map(p=>p[0])),190+2*w);
  close(Math.min(...mapped.map(p=>p[1])),75);close(Math.max(...mapped.map(p=>p[1])),75+2*h);

});

// Verify the actual drawn endpoints rather than merely asserting named classes.
it('corresponding heights, angle bisectors and medians obey their definitions and scale by two',()=>{
  const [A,B,C]=triangle('small-fill').points,[D]=triangle('large-fill').points;
  const endpoints=(cls:string)=>{
    const group=component.split('class="construction '+cls+'"')[1];assert.ok(group);
    const m=group.match(/class="segment" d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)"/);assert.ok(m);
    const n=m.slice(1).map(Number);return {a:n.slice(0,2),p:n.slice(2,4),d:n.slice(4,6),q:n.slice(6,8)};
  };
  for(const name of ['height-pair','bisector-pair','median-pair']){
    const {a,p,d,q}=endpoints(name);assert.deepEqual(a,name==='height-pair'?B:A);assert.deepEqual(d,name==='height-pair'?triangle('large-fill').points[1]:D);
    close(q[0]-D[0],-2*(p[1]-A[1]));close(q[1]-D[1],2*(p[0]-A[0]));
    // Height is drawn from B onto AC so it is visually distinct from the outline.
    const [baseStart,baseEnd]=name==='height-pair'?[A,C]:[B,C];
    close((p[0]-baseStart[0])*(baseEnd[1]-baseStart[1]),(p[1]-baseStart[1])*(baseEnd[0]-baseStart[0]));
    if(name==='height-pair')close((p[0]-B[0])*(C[0]-A[0])+(p[1]-B[1])*(C[1]-A[1]),0);
    if(name==='median-pair'){close(p[0],(B[0]+C[0])/2);close(p[1],(B[1]+C[1])/2);}
    if(name==='bisector-pair'){
      const len=(x:number[],y:number[])=>Math.hypot(x[0]-y[0],x[1]-y[1]);
      close(len(B,p)/len(p,C),len(A,B)/len(A,C));
      const cosine=(v:number[])=>((p[0]-A[0])*(v[0]-A[0])+(p[1]-A[1])*(v[1]-A[1]))/(len(A,p)*len(A,v));
      close(cosine(B),cosine(C));
    }
  }
});
it('perimeter traces match the triangles and perimeter doubles, not stays equal',()=>{
  const a=triangle('small-fill'),b=triangle('large-fill');
  close(a.sides.reduce((s,x)=>s+x,0)/50,4.8);
  close(b.sides.reduce((s,x)=>s+x,0)/50,9.6);
  const paths=[...component.matchAll(/class="perimeter" pathLength="1" d="([^"]+)"/g)].map(m=>m[1]);
  for(const [i,cls] of ['small-fill','large-fill'].entries())assert.equal(paths[i],component.match(new RegExp('<path d="([^"]+)" class="'+cls+'"'))?.[1]);
});

it('uses scalene acute triangles and Greek equal-angle labels instead of right-angle givens',()=>{
  for(const cls of ['small-fill','large-fill']){
    const {points,sides}=triangle(cls);
    assert.equal(new Set(sides.map(x=>x.toFixed(4))).size,3);
    for(let i=0;i<3;i++){
      const p=points[i],a=points[(i+1)%3],b=points[(i+2)%3];
      assert.ok((a[0]-p[0])*(b[0]-p[0])+(a[1]-p[1])*(b[1]-p[1])>1, 'every triangle angle must be acute and not 90 degrees');
    }
  }
  for(const name of ['alpha','beta']){
    const block=component.split('class="angle-pair angle-'+name+'"')[1].split('</g>')[0];
    assert.equal((block.match(/ A/g)||[]).length,2,'both matching angles use arcs');
    assert.equal((block.match(new RegExp('>'+({alpha:'α',beta:'β'}[name])+ '</text>','g'))||[]).length,2);
    assert.doesNotMatch(block,/ H| V/,'no right-angle corner in similarity givens');
  }
});
