let cars=[];
const grid=document.querySelector('#grid'),q=document.querySelector('#q'),verify=document.querySelector('#verify'),dlg=document.querySelector('#dlg'),detail=document.querySelector('#detail');

const mapLocations={
119:{lat:52.1326,lng:5.2913,scope:'country',label:'Paesi Bassi'},
162:{lat:39.2983,lng:16.2537,scope:'city',label:'Cosenza'},
181:{lat:47.741,lng:0.514,scope:'city',label:'Chahaignes / Sarthe'},
231:{lat:42.4207,lng:12.1077,scope:'city',label:'Viterbo / Lazio'},
260:{lat:45.5345,lng:9.2319,scope:'city',label:'Sesto San Giovanni (MI)'},
340:{lat:43.6158,lng:13.5189,scope:'city',label:'Ancona'},
345:{lat:52.1326,lng:5.2913,scope:'country',label:'Paesi Bassi'},
346:{lat:45.1978,lng:7.6011,scope:'city',label:'Torino / Ciriè'},
365:{lat:41.9252,lng:13.089,scope:'city',label:'Subiaco (Roma)'},
366:{lat:45.9418,lng:13.622,scope:'city',label:'Gorizia / Grado'},
424:{lat:44.1115,lng:9.9586,scope:'city',label:'Sarzana / La Spezia'},
604:{lat:46.023,lng:8.918,scope:'city',label:'Muzzano / Ticino'},
618:{lat:41.9028,lng:12.4964,scope:'city',label:'Roma / Lazio'},
622:{lat:45.1847,lng:9.1582,scope:'city',label:'Pavia / Lombardia'},
749:{lat:47.1625,lng:19.5033,scope:'country',label:'Ungheria'}
};

fetch('data/identified.json',{cache:'no-store'}).then(r=>r.json()).then(d=>{
  cars=d.filter(x=>x.identified);
  document.querySelector('#identified').textContent=d.filter(x=>x.identified).length;
  document.querySelector('#countries').textContent=new Set(d.filter(x=>x.country).map(x=>x.country)).size;
  render();
  initMap();
});

function render(){
  let s=q.value.toLowerCase(),v=verify.value;
  let a=cars.filter(x=>(!s||JSON.stringify(x).toLowerCase().includes(s))&&(!v||x.v===v));
  grid.innerHTML=a.map(x=>'<article class="card" onclick="openCar('+x.number+')"><div class="num">#'+x.numberLabel+'</div><div>'+(x.identified?(x.color||'Colore non documentato'):'Nessuna informazione pubblica')+'</div><div class="muted">'+(x.identified?([x.country,x.city].filter(Boolean).join(' · ')||'Località non documentata'):'')+'</div>'+(x.v?'<span class="tag">Verifica '+x.v+'</span>':'')+'</article>').join('');
}
[q,verify].forEach(e=>e.addEventListener('input',render));

function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

function openCar(n){
  let x=cars.find(c=>c.number===n);
  if(!x)return;
  detail.innerHTML='<h2>#'+x.numberLabel+'</h2>'+(x.identified?'<p><b>Colore:</b> '+esc(x.color||'Non documentato')+'<br><b>Paese:</b> '+esc(x.country||'Non documentato')+'<br><b>Città:</b> '+esc(x.city||'Non documentata')+'<br><b>Km documentati:</b> '+esc(x.km||'—')+'<br><b>Proprietario/nickname pubblico:</b> '+esc(x.owner||'—')+'<br><b>Venditore pubblico:</b> '+esc(x.seller||'—')+'<br><b>Modifiche:</b> '+esc(x.mods||'—')+'<br><b>Livello verifica:</b> '+esc(x.v||'—')+'</p><p><a class="source" target="_blank" rel="noopener" href="'+encodeURI(x.source)+'">Apri fonte: '+esc(x.label)+'</a></p>':'<p>Nessuna informazione pubblica.</p>')+'<button onclick="issue(\'correction\','+n+')">Proponi una correzione</button>';
  dlg.showModal();
}

function initMap(){
  const mapEl=document.querySelector('#map');
  if(typeof L==='undefined'){mapEl.innerHTML='<div class="map-error">Impossibile caricare la mappa. Ricarica la pagina.</div>';return;}
  const map=L.map('map',{scrollWheelZoom:true}).setView([46.5,10.5],5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:18,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
  const bounds=[];
  let count=0;
  cars.filter(x=>x.identified&&mapLocations[x.number]).forEach(x=>{
    const p=mapLocations[x.number];
    const icon=L.divIcon({
      className:'',
      html:'<div class="qv-marker '+(p.scope==='country'?'country-only':'')+'"><span>#'+x.numberLabel+'</span></div>',
      iconSize:[34,34],
      iconAnchor:[17,34],
      popupAnchor:[0,-32]
    });
    const m=L.marker([p.lat,p.lng],{icon}).addTo(map);
    m.bindPopup('<div><b>Giulietta QV #'+x.numberLabel+'</b><br>'+esc(x.color||'Colore non documentato')+'<br>'+esc(p.label)+'<br><span style="color:#aaa">'+(p.scope==='country'?'Posizione indicativa sul paese':'Posizione indicativa su città/area')+'</span><br><a href="#" onclick="openCar('+x.number+');return false;">Apri scheda</a></div>');
    bounds.push([p.lat,p.lng]); count++;
  });
  document.querySelector('#mappedCount').textContent=count;
  if(bounds.length) map.fitBounds(bounds,{padding:[28,28],maxZoom:6});
}

function issue(type,n){
  let num=n||prompt('Numero Launch Edition (1–999):');if(!num)return;
  let url=prompt('URL della fonte/evidenza pubblica:');if(!url)return;
  let note=prompt('Descrivi brevemente la richiesta:')||'';
  let title='['+type+'] Giulietta QV #'+String(num).padStart(3,'0');
  let body='Tipo: '+type+'%0A%0ANumero: '+num+'%0A%0AFonte/evidenza: '+encodeURIComponent(url)+'%0A%0ANote: '+encodeURIComponent(note)+'%0A%0APrivacy: non includere VIN completi, targhe, telefoni o indirizzi.';
  location.href='https://github.com/capaccio78/giulietta-qv-registry/issues/new?title='+encodeURIComponent(title)+'&body='+body;
}