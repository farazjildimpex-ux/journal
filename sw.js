const CACHE='journal-shell-v146';
const SHELL=['./app.html','./icons/icon-192.png','./icons/icon-512.png','./icons/badge-96.png','./icons/blank-96.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&x!=='journal-cdn-v1').map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin){ // keep the Supabase library and fonts on the phone so the app opens fast
    if(/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)){
      e.respondWith(caches.open('journal-cdn-v1').then(c=>c.match(r).then(h=>{
        const n=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>h);
        return h||n})));
    }
    return; // Supabase API etc. always go to the network
  }
  if(/\/manifest\.json$/.test(u.pathname)){ // never serve an old install manifest (it holds the splash colour)
    e.respondWith(fetch(r,{cache:'no-store'}).catch(()=>caches.match(r)));
    return;
  }
  if(r.mode==='navigate'){
    // the app lives at /app; the public landing page is at /. Offline, any page opens the saved app.
    const isApp=/\/(app|app\.html|login)$/.test(u.pathname);
    e.respondWith(fetch(r).then(res=>{if(isApp&&res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put('./app.html',cp))}return res}).catch(()=>caches.match('./app.html')));
    return;
  }
  e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res})));
});

// Notifications arrive here even when the app is closed.
// On Android the small J on the left (the badge) already says it is the Journal, so nothing shows on the right.
// Chrome draws a grey letter there when a notification has no picture, so Android gets a fully transparent one.
// On a computer the icon is the only picture, so it stays.
const ANDROID=/Android/i.test((self.navigator&&self.navigator.userAgent)||'');
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{}}catch(x){d={title:'Journal',body:e.data?e.data.text():''}}
  const o={body:d.body||'',tag:d.tag||undefined,renotify:!!d.tag,badge:'./icons/badge-96.png',
    data:{url:d.url||'./app'},requireInteraction:!!d.urgent};
  o.icon=ANDROID?'./icons/blank-96.png':'./icons/icon-192.png';
  e.waitUntil(self.registration.showNotification(d.title||'Journal',o));
});
// Tapping one opens the app at the right place: an open window is reused, otherwise a new one opens.
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=new URL((e.notification.data||{}).url||'./app',self.location.origin).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const w=list.find(c=>/\/(app|app\.html|login)(\?|$)/.test(new URL(c.url).pathname+new URL(c.url).search))||list[0];
    if(w){w.postMessage({type:'open',url});return w.focus()}
    return self.clients.openWindow(url);
  }));
});
