const documentedArchive=require('./_archive');
// EPA Dental — motore stime: separa fonti reali, ricerca web e inferenza.
const known={
'OTT. M.O.D.':[[18,32,24],[0,0,0]],'OTT 2° CLASSE**':[[12,22,16],[0,0,0]],
'ENDODONZIA MONORADICOLATO':[[18,35,25],[0,0,0]],'ENDODONZIA BIRADICOLARE':[[24,45,33],[0,0,0]],'ENDODONZIA PLURIRADICOLATO':[[30,60,42],[0,0,0]],
'IGIENE':[[5,12,8],[0,0,0]],'SCALING E ROOT-PLANNING (SC-RP) QUADRANTE':[[8,18,12],[0,0,0]],
'ESTRAZIONE (EX)':[[8,18,12],[0,0,0]],'ESTRAZIONE CHIRURGICA (EX CH)':[[18,45,30],[0,0,0]],
'GRANDE RIALZO SENO MASCELLARE':[[150,350,230],[0,0,0]],
'ALLINEATORI EXPRESS':[[15,35,22],[350,900,600]],'ALLINEATORI LIGHT':[[15,35,22],[350,900,600]],'ALLINEATORI COMPREHENSIVE':[[20,45,30],[900,1800,1300]],
'PROTESI TOTALE':[[25,60,40],[326.6,383.4,355]],'PROTESI SCHELETRATA':[[20,50,35],[400.2,469.8,435]],
'RIBASATURA':[[5,15,8],[101.2,118.8,110]],'RIPARAZIONE PROTESI':[[3,10,6],[30.36,35.64,33]],
'CORONA MONOLITICA DENTE':[[12,30,20],[156.4,183.6,170]],'CORONA MONOLITICA IMPIANTO':[[18,45,30],[156.4,183.6,170]]
};
function range(a){return {min:a[0],max:a[1],suggested:a[2]}}
function valid(o){if(!o||!['min','max','suggested'].every(k=>typeof o[k]==='number'&&Number.isFinite(o[k])&&o[k]>=0))return false;return o.min<=o.suggested&&o.suggested<=o.max}
function parseJSON(s){const m=s.match(/\{[\s\S]*\}/);if(!m)return null;try{return JSON.parse(m[0])}catch{return null}}
function respond(code,data){return {statusCode:code,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},body:JSON.stringify(data)}}
async function estimateAI(input,archive){
 const key=process.env.ANTHROPIC_API_KEY;if(!key)return null;
 const prompt=`Sei un analista di costi odontoiatrici italiani. Stima il costo VARIABILE per UNA prestazione, separando (A) materiali effettivamente consumati nello studio (non intera confezione) e (B) fattura laboratorio odontotecnico esterno. Non includere personale, tempo poltrona, costi fissi, IVA, prezzi al paziente. Se il laboratorio non è richiesto per la prestazione e l'utente non lo menziona, costo 0; altrimenti non supporre automaticamente 0. Usa preferibilmente i prezzi delle fatture fornite in archive, poi i listini, poi il web, e per ultimo stime prudenziali. Attenzione a CHF vs EUR, confezioni vs unità, prezzi lordi vs netti e anno. Non inventare fonti né citazioni. Per la ricerca web usa fonti di fornitori accessibili; se non hai cercato, dichiara web_used=false. Fornisci range ampi se mancano quantità. Se non è possibile stimare una categoria, usa null invece di zero. Rispondi SOLO con un oggetto JSON: {"materials":{"min":number,"max":number,"suggested":number}|null,"external":{"min":number,"max":number,"suggested":number}|null,"materials_source":string,"external_source":string,"web_used":boolean,"note":string}.\nINPUT: ${JSON.stringify(input)}\nARCHIVIO (solo righe disponibili): ${JSON.stringify(archive.records).slice(0,12500)}`;
 const body={model:'claude-sonnet-4-6',max_tokens:1800,messages:[{role:'user',content:prompt}]};
 // Anthropic web search: se il servizio non è abilitato, riprova senza web.
 const invoke=async web=>{const b={...body};if(web)b.tools=[{type:'web_search_20250305',name:'web_search',max_uses:3}];const c=new AbortController(),t=setTimeout(()=>c.abort(),6500);try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify(b),signal:c.signal});if(!r.ok)return null;const d=await r.json();const text=(d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');const o=parseJSON(text);if(!o)return null;const webUsed=(d.content||[]).some(x=>x.type==='server_tool_use'&&x.name==='web_search');o.web_used=webUsed;return o}finally{clearTimeout(t)}};
 try{return await invoke(archive.records.length===0)}catch{return null}
}
exports.handler=async event=>{
 if(event.httpMethod!=='POST')return respond(405,{error:'Metodo non consentito'});
 let x;try{x=JSON.parse(event.body||'{}')}catch{return respond(400,{error:'JSON non valido'})}
 const p=String(x.prestazione||'').trim().slice(0,180);
 if(!p)return respond(400,{error:'Seleziona una prestazione'});
 const input={prestazione:p,materiali:String(x.materials_used||'').slice(0,2000),laboratorio:String(x.lab_used||'').slice(0,2000),variante:String(x.variant||'').slice(0,100)};
 const rows=await documentedArchive.load();
 const records=documentedArchive.matches(rows,[p,input.materiali,input.laboratorio].filter(Boolean).join(' '),12);
 const archive={available:rows.length>0,records};
 // Prezzo per confezione NON è un costo per trattamento: usare i prezzi documentati
 // solo come contesto AI, salvo costi per prestazione esplicitamente verificati.
 const ai=await estimateAI(input,archive);
 if(ai&&(valid(ai.materials)||valid(ai.external))){
   const materials=valid(ai.materials)?ai.materials:null,external=valid(ai.external)?ai.external:null;
   if(materials&&external)return respond(200,{materials,external,materials_source:String(ai.materials_source||'Stima AI').slice(0,180),external_source:String(ai.external_source||'Stima AI').slice(0,180),note:String(ai.note||'').slice(0,900)+' | Ricerca web: '+(ai.web_used?'effettuata':'non disponibile')+'. Archivio privato: '+(archive.available?'disponibile':'non collegato')+'.'});
   // Risposta AI parziale: usa il fallback invece di bloccare il calcolo.
 }
 // Continuità del calcolo: se AI non risponde, fornire stime orientative NON validate.
 // I range sono ipotesi per categoria, NON prezzi di fatture o benchmark di mercato.
 if(known[p]){const [m,e]=known[p];return respond(200,{materials:range(m),external:range(e),materials_source:'Stima preliminare, non verificata',external_source:e[2]===0?'Laboratorio non previsto nel caso standard (da confermare)':'Stima preliminare, non verificata',note:'Fonte: valori guida preesistenti; costo per prestazione non validato con fatture.'})}
 const area=String(x.area||'').toUpperCase();
 const text=p.toLocaleLowerCase('it');
 // Valori guida volutamente ampi; usati solo in assenza di dati affidabili.
 const baseline={
  CON:[[6,65,24],[0,0,0]],END:[[10,85,32],[0,0,0]],
  PAR:[[5,180,42],[0,0,0]],CHI:[[8,300,65],[0,0,0]],
  PRF:[[8,90,30],[80,650,240]],PRM:[[5,70,25],[40,650,230]],
  IGI:[[3,35,12],[0,0,0]],ORT:[[8,130,45],[70,1600,420]],
  IMP:[[35,480,185],[0,450,140]],DIA:[[1,45,10],[0,0,0]]
 };
 let v=baseline[area];
 if(!v)return respond(422,{error:'Branca della prestazione non riconosciuta: seleziona una prestazione dal menu.'});
 // Per prestazioni chiaramente senza laboratorio, il valore è 0; altrimenti il
 // laboratorio resta un'ipotesi da confermare, non una certezza di delega.
 if(/visita|radiografia|cbct|scansion|impronta|igiene|sondaggio|cartella|estrazion|biopsi|apicectomia|gengivectomia|sbiancamento|scaling|levigatura|incappucciamento|pulpotomia|fixture|inserimento impianto|chirurgia implantare/i.test(text)&&!input.laboratorio.trim())v=[v[0],[0,0,0]];
 const m=range(v[0]),e=range(v[1]);
 return respond(200,{materials:m,external:e,materials_source:'Ipotesi generica per branca · affidabilità bassa',external_source:e.suggested===0?'Nessun laboratorio ipotizzato · da confermare':'Ipotesi generica per branca · affidabilità bassa',note:'Fonte: stima generale per branca; non è un prezzo documentato per la prestazione. Archivio privato '+(archive.available?'disponibile':'non collegato')+'.'});
};