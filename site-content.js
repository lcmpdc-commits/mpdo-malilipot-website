(function(){
  const API='https://mpdc-admin.lcmpdc.workers.dev';
  function setText(key,value){document.querySelectorAll('[data-cms="'+key+'"]').forEach(el=>{if(typeof value==='string')el.textContent=value;});}
  async function load(){try{const r=await fetch(API+'/api/content',{cache:'no-store'});if(!r.ok)return;const d=await r.json();const c=d.content||{};Object.entries(c.text||{}).forEach(([k,v])=>setText(k,v));if(c.files&&Array.isArray(c.files)){document.querySelectorAll('[data-cms-files]').forEach(el=>{const group=el.getAttribute('data-cms-files');const items=c.files.filter(x=>x.group===group);if(!items.length)return;el.innerHTML=items.map(x=>'<li><a href="'+encodeURI(x.url)+'" target="_blank" rel="noopener">'+escapeHtml(x.title)+'</a></li>').join('');});}}catch(e){console.warn('MPDO live content unavailable; showing built-in page content.',e);}}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
