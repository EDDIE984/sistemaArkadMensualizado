type SeriesRow={label:string;primary:number;secondary:number};
type StatusRow={label:string;value:number};

export function ComparisonChart({data,primaryLabel,secondaryLabel,format="number"}:{data:SeriesRow[];primaryLabel:string;secondaryLabel:string;format?:"number"|"currency"}){
  const max=Math.max(1,...data.flatMap(x=>[x.primary,x.secondary]));
  return <div><div className="mb-6 flex flex-wrap gap-4 text-xs text-white/55"><Legend color="bg-cyan-300" label={primaryLabel}/><Legend color="bg-blue-500" label={secondaryLabel}/></div><div className="grid gap-4">{data.map(row=><div key={row.label} className="grid min-w-0 grid-cols-[42px_minmax(0,1fr)] items-center gap-3"><span className="text-[11px] font-bold uppercase text-white/42">{row.label}</span><div className="grid gap-1.5"><Bar value={row.primary} max={max} color="bg-cyan-300" format={format}/><Bar value={row.secondary} max={max} color="bg-blue-500" format={format}/></div></div>)}</div></div>
}

export function StatusChart({data,format="number"}:{data:StatusRow[];format?:"number"|"currency"}){const total=data.reduce((sum,x)=>sum+x.value,0);return <div className="grid gap-4">{data.map((row,index)=>{const pct=total?row.value/total*100:0;const colors=["bg-cyan-300","bg-blue-400","bg-amber-300","bg-rose-300"];return <div key={row.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-white/65">{humanize(row.label)}</span><span className="text-white/45">{format==="currency"?compactCurrency(row.value):row.value.toLocaleString("es-EC")} · {pct.toFixed(0)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/8"><div className={`h-full rounded-full ${colors[index%colors.length]}`} style={{width:`${pct}%`}}/></div></div>})}{!data.length&&<p className="py-8 text-center text-sm text-white/45">Aún no hay datos para este indicador.</p>}</div>}

export function TrendArea({data,format="currency"}:{data:{label:string;value:number}[];format?:"number"|"currency"}){
  const values=data.map((d)=>d.value);
  const peak=Math.max(0,...values);
  const max=Math.max(1,peak);
  const n=data.length;
  const points=data.map((d,i)=>{const x=n>1?(i/(n-1))*100:0;const y=32-(d.value/max)*30;return `${x.toFixed(2)},${y.toFixed(2)}`;});
  const line=points.map((p,i)=>`${i===0?"M":"L"}${p}`).join(" ");
  const area=`M0,32 ${points.map((p)=>`L${p}`).join(" ")} L100,32 Z`;
  return <div>
    {peak>0
      ? <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="Tendencia mensual">
          <path d={area} className="fill-cyan-300/15"/>
          <path d={line} className="fill-none stroke-cyan-300" strokeWidth={1} strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
          <line x1={0} y1={32} x2={100} y2={32} className="stroke-white/12" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
        </svg>
      : <p className="py-10 text-center text-sm text-white/45">Sin comisiones en el período.</p>}
    <div className="mt-2 flex justify-between text-[9px] font-bold uppercase text-white/38">{data.map((d)=><span key={d.label}>{humanizeMonth(d.label)}</span>)}</div>
    {peak>0&&<p className="mt-3 text-xs text-white/45">Máximo mensual · <span className="font-bold text-white/70">{format==="currency"?compactCurrency(peak):peak.toLocaleString("es-EC")}</span></p>}
  </div>;
}
function humanizeMonth(value:string){return ({Jan:"Ene",Feb:"Feb",Mar:"Mar",Apr:"Abr",May:"May",Jun:"Jun",Jul:"Jul",Aug:"Ago",Sep:"Sep",Oct:"Oct",Nov:"Nov",Dec:"Dic"} as Record<string,string>)[value]||value}

function Bar({value,max,color,format}:{value:number;max:number;color:string;format:"number"|"currency"}){return <div className="group relative h-4 overflow-visible rounded-r-full bg-white/5"><div className={`h-full min-w-px rounded-r-full ${color}`} style={{width:`${value/max*100}%`}}/><span className="absolute inset-y-0 left-2 flex items-center text-[9px] font-bold text-white mix-blend-difference sm:text-[10px]">{format==="currency"?compactCurrency(value):value.toLocaleString("es-EC")}</span></div>}
function Legend({color,label}:{color:string;label:string}){return <span className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${color}`}/>{label}</span>}
function compactCurrency(value:number){return new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(value)}
function humanize(value:string){return value.toLowerCase().replaceAll("_"," ").replace(/^./,x=>x.toUpperCase())}
