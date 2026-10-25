export async function api(path, options={}) {
 let res;
 try { res=await fetch('/api'+path,{
     credentials:'same-origin',
     headers: {'Content-Type':'application/json',...options.headers},
     ...options,
     body: options.body===undefined ? undefined:JSON.stringify(options.body)
 }); }
 catch {throw new Error('No se pudo conectar con la API. Comprueba que el servidor esté iniciado.');}
 let data;
 try { data=await res.json();} catch {throw new Error('Respuesta no válida del servidor.');}
 if(!res.ok) throw Object.assign(new Error(data?.error||'La operación no pudo realizarse.'),{status:res.status});
 return data;
}
export const formatearFecha=(date,withDate=true)=>{
 if(!date)return '—';
 const input=String(date).replace(' ','T')+(String(date).endsWith('Z')?'':'Z');
 const d=new Date(input);
 return Number.isNaN(d.valueOf())?String(date):new Intl.DateTimeFormat('es-CO',{
   timeZone:'America/Bogota',
   ...(withDate?{day:'2-digit',month:'short',year:'numeric'}:{}),
   hour:'2-digit',minute:'2-digit',hour12:true
 }).format(d);
};
export const tiempo=(n)=>{
 const m=Math.max(0,Number(n)||0);return m>=60?`${Math.floor(m/60)} h ${m%60} min`:`${m} min`;
};
