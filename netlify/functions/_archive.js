// Archivio prezzi EPA Dental: accesso server-side al repository PRIVATO.
const PATH='EPA_Dental_Pacchetto_Archivio_e_Codice/dati/PREZZI_CANDIDATI.csv';
let cache={time:0,rows:[]};
function csv(text){
 const out=[];let row=[],v='',q=false;
 for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){v+='"';i++}else q=!q}
 else if(c===';'&&!q){row.push(v);v=''}
 else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v);v='';if(row.length>1)out.push(row);row=[]}
 else v+=c}
 if(v||row.length){row.push(v);out.push(row)}
 const keys=(out.shift()||[]).map(s=>s.replace(/^\uFEFF/,''));
 return out.map(a=>Object.fromEntries(keys.map((k,i)=>[k,a[i]||''])));
}
async function load(){
 if(cache.rows.length&&Date.now()-cache.time<900000)return cache.rows;
 const token=process.env.EPA_GITHUB_TOKEN;if(!token)return cache.rows;
 const repo='charitablecorti/epadental-archivio-prezzi';
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),2200);
 try{
 const url='https://api.github.com/repos/'+repo+'/contents/'+PATH+'?ref=main';
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'},signal:ctl.signal});
 if(!r.ok)throw Error('GitHub '+r.status);
 const rows=csv(await r.text()).filter(x=>x.Decisione==='INCLUDERE');
 cache={time:Date.now(),rows};return rows;
 }catch{return cache.rows}finally{clearTimeout(timer)}
}
function matches(rows,query,max=10){
 const stop=new Set(['della','delle','degli','dente','denti','singolo','multiplo','impianto','materiali','laboratorio']);
 const terms=String(query).toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter(x=>x.length>3&&!stop.has(x));
 return rows.map(r=>{const s=(r['Descrizione originale']||'').toLowerCase();const score=terms.filter(t=>s.includes(t)).length;return {r,score}})
 .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,max).map(({r})=>({
 descrizione:r['Descrizione originale'],categoria:r.Categoria,fornitore:r.Fornitore,
 prezzo_fatturato_eur:Number(String(r['Prezzo unitario netto sconti (€)']||'').replace(',','.')),
 costo_per_prestazione_verificato_eur:Number(String(r['Costo per prestazione verificato (€)']||'').replace(',','.'))||null,
 confezione:r['Confezione / pezzi']||'',data:r['Data documento'],fonte:r['Tipo fonte']
 })).filter(x=>Number.isFinite(x.prezzo_fatturato_eur)&&x.prezzo_fatturato_eur>0);
}
module.exports={load,matches};
