export function memoryColour(index){return `hsl(${(index*137.508+265)%360} 62% 48%)`;}
export function prepare(canvas){
 const rect=canvas.getBoundingClientRect(),w=rect.width||650,h=rect.height||220,dpr=globalThis.devicePixelRatio||1;
 canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);return {ctx,w,h};
}
export function plot(canvas,samples,series,{window='all',fixedY=null,empty='Start a simulation to see the trajectory'}={}){
 const {ctx,w,h}=prepare(canvas),pad={l:55,r:12,t:16,b:36},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
 if(!samples.length){ctx.fillStyle='#b6b2bd';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(empty,w/2,h/2);return;}
 const end=samples.at(-1).time,xmin=window==='all'?0:Math.max(0,end-Number(window)),xmax=Math.max(end,xmin+1);
 const visible=samples.filter(s=>s.time>=xmin);let ymin=fixedY?.[0]??Infinity,ymax=fixedY?.[1]??-Infinity;
 if(!fixedY)for(const sample of visible)for(const line of series){const v=line.value(sample);if(Number.isFinite(v)){ymin=Math.min(ymin,v);ymax=Math.max(ymax,v);}}
 if(!Number.isFinite(ymin))ymin=0;if(!Number.isFinite(ymax))ymax=1;
 if(!fixedY){const margin=Math.max((ymax-ymin)*.12,Math.abs(ymax)*.001,1e-7);ymin-=margin;ymax+=margin;}
 const x=t=>pad.l+(t-xmin)/(xmax-xmin)*pw,y=v=>pad.t+(ymax-v)/(ymax-ymin)*ph;
 ctx.font='10px system-ui';ctx.textAlign='right';ctx.lineWidth=1;
 for(let i=0;i<=4;i++){
  const v=ymin+(ymax-ymin)*i/4,yy=y(v);ctx.strokeStyle='#f0eef3';ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(w-pad.r,yy);ctx.stroke();ctx.fillStyle='#9ca3af';ctx.fillText(format(v),pad.l-8,yy+3);
 }
 ctx.textAlign='center';for(let i=0;i<=5;i++){const t=xmin+(xmax-xmin)*i/5;ctx.fillText(format(t),x(t),h-16);}
 ctx.fillStyle='#9ca3af';ctx.fillText('Physical time',pad.l+pw/2,h-2);
 ctx.save();ctx.beginPath();ctx.rect(pad.l,pad.t,pw,ph);ctx.clip();
 for(const line of series){ctx.strokeStyle=line.colour;ctx.lineWidth=line.width??1.35;ctx.beginPath();let first=true;const stride=Math.max(1,Math.floor(visible.length/(pw*2)));
  for(let i=0;i<visible.length;i+=stride){const v=line.value(visible[i]);if(!Number.isFinite(v))continue;const xx=x(visible[i].time),yy=y(v);if(first){ctx.moveTo(xx,yy);first=false;}else ctx.lineTo(xx,yy);}
  const last=visible.at(-1);if(last&&Number.isFinite(line.value(last)))ctx.lineTo(x(last.time),y(line.value(last)));ctx.stroke();
 }ctx.restore();
 return {xmin,xmax,ymin,ymax,pad,pw,ph};
}
export function format(v){if(v===0)return '0';if(Math.abs(v)<.0001||Math.abs(v)>=1e5)return v.toExponential(1);return Number(v.toPrecision(4)).toString();}
export function heatmap(canvas,samples,np,window){
 const {ctx,w,h}=prepare(canvas),pad=28,pw=w-pad-8,ph=h-24;
 if(!samples.length){ctx.fillStyle='#b6b2bd';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('Memory activity will appear here',w/2,h/2);return;}
 const end=samples.at(-1).time,start=window==='all'?0:Math.max(0,end-Number(window)),range=Math.max(end-start,1),visible=samples.filter(s=>s.time>=start);
 for(let m=0;m<np;m++){for(let c=0;c<visible.length;c++){
  const point=visible[c],next=visible[c+1]?.time??end,x=pad+(point.time-start)/range*pw,cw=Math.max(1,(next-point.time)/range*pw),v=Math.max(0,Math.min(1,point.overlaps[m]));
  ctx.fillStyle=`rgb(${Math.round(250-130*v)},${Math.round(247-206*v)},${Math.round(255-70*v)})`;ctx.fillRect(x,m/np*ph,cw,Math.ceil(ph/np));
 }if(m===0||m===np-1||np<12){ctx.fillStyle='#9ca3af';ctx.font='9px system-ui';ctx.textAlign='right';ctx.fillText(m+1,pad-5,(m+.6)/np*ph);}}
 ctx.font='9px system-ui';ctx.textAlign='left';ctx.fillStyle='#9ca3af';ctx.fillText(format(start),pad,h-5);ctx.textAlign='right';ctx.fillText(format(end),w-8,h-5);
}
export function network(canvas,q,d){
 const {ctx,w,h}=prepare(canvas),cols=25,rows=10,cw=Math.min(w/cols,h/rows),left=(w-cols*cw)/2,top=(h-rows*cw)/2;
 if(!q){ctx.fillStyle='#b6b2bd';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('250 units',w/2,h/2);return;}
 for(let i=0;i<250;i++){let best=0,v=q[i*d];for(let k=1;k<d;k++)if(q[i*d+k]>v){v=q[i*d+k];best=k;}ctx.globalAlpha=.2+.8*v;ctx.fillStyle=best?memoryColour(best-1):'#9ca3af';ctx.fillRect(left+(i%cols)*cw+1,top+Math.floor(i/cols)*cw+1,cw-2,cw-2);}ctx.globalAlpha=1;
}
