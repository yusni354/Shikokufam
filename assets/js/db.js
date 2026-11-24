/* Lapisan data: Supabase (app_data) dan cadangan penyimpanan lokal */
function createLocalDb(){
  const listeners={};
  const key=name=>'shikoku-family:'+name;
  /* Cermin data di ingatan: bila localStorage terblokir (mis. pratinjau
     artefak dalam iframe sandbox), data lokal tetap hidup selama sesi
     berjalan alih-alih gagal ditulis. Di peramban biasa localStorage
     tetap menjadi sumber utama seperti sebelumnya. */
  const memory={};
  const read=name=>{
    try{
      const raw=localStorage.getItem(key(name));
      if(raw!==null)return JSON.parse(raw)||[];
    }catch(e){}
    return (memory[name]||[]).map(row=>({...row}));
  };
  const write=(name,rows)=>{
    memory[name]=rows.map(row=>({...row}));
    try{localStorage.setItem(key(name),JSON.stringify(rows))}catch(e){/* penyimpanan terblokir: data tetap tersimpan di ingatan untuk sesi ini */}
  };
  const notify=name=>(listeners[name]||[]).forEach(fn=>fn({docs:read(name).map(data=>({id:data.id,data:()=>({...data})}))}));
  const collection=name=>({
    onSnapshot(fn){(listeners[name]||(listeners[name]=[])).push(fn);notify(name);return ()=>{const list=listeners[name]||[],index=list.indexOf(fn);if(index>=0)list.splice(index,1)}},
    add:async data=>{const rows=read(name),id='local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);rows.push({id,...data});write(name,rows);notify(name);return {id}},
    doc:id=>({
      set:async data=>{const rows=read(name),i=rows.findIndex(x=>x.id===id),next={id,...data};if(i<0)rows.push(next);else rows[i]=next;write(name,rows);notify(name)},
      update:async data=>{const rows=read(name),i=rows.findIndex(x=>x.id===id);if(i<0)throw new Error('Data tidak ditemukan');rows[i]={...rows[i],...data};write(name,rows);notify(name)},
      delete:async()=>{write(name,read(name).filter(x=>x.id!==id));notify(name)}
    })
  });
  return {collection};
}
const APP_DATA_COLLECTIONS=new Set(['members','events','topics','cleaning_duties','pin','musyawarah','pengaturan','keuangan','inventaris','meeting']);
function createSupabaseDb(client){
  const collection=name=>{
    if(!APP_DATA_COLLECTIONS.has(name))throw new Error('Koleksi aplikasi tidak dikenal: '+name);
    return {
      onSnapshot(callback,onError){
        let active=true,request=0,timer=null;
        const reportError=error=>{if(active&&typeof onError==='function')onError(error)};
        const refresh=async()=>{
          const current=++request;
          try{
            const {data,error}=await client.from('app_data').select('id,data').eq('collection',name);
            if(!active||current!==request)return;
            if(error){reportError(error);return}
            callback({docs:(data||[]).map(row=>({id:row.id,data:()=>({...row.data})}))});
          }catch(error){reportError(error)}
        };
        /* Data SELALU diambil lewat REST lebih dulu. Kanal realtime hanya
           pemicu penyegaran tambahan: bila websocket gagal/tertutup, daftar
           tetap terisi dari pengambilan REST ini dan berikutnya. Dulu
           pengambilan pertama menunggu status SUBSCRIBED, jadi sekali
           realtime gagal, seluruh data tidak pernah dimuat. */
        void refresh();
        const channel=client.channel('app-data-'+name+'-'+Math.random().toString(36).slice(2));
        channel.on('postgres_changes',{event:'*',schema:'public',table:'app_data',filter:'collection=eq.'+name},()=>{clearTimeout(timer);timer=setTimeout(()=>{void refresh()},300)});
        channel.subscribe(status=>{
          if(status==='SUBSCRIBED')void refresh();
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED')console.warn('Realtime Supabase tidak tersedia untuk koleksi '+name+' ('+status+'); data tetap dimuat lewat REST.');
        });
        return ()=>{active=false;request++;clearTimeout(timer);void client.removeChannel(channel)};
      },
      add:async data=>{
        const id=crypto.randomUUID();
        const {error}=await client.from('app_data').insert({collection:name,id,data});
        if(error)throw error;
        return {id};
      },
      doc:id=>({
        set:async data=>{
          const {error}=await client.from('app_data').upsert({collection:name,id:String(id),data,updated_at:new Date().toISOString()},{onConflict:'collection,id'});
          if(error)throw error;
        },
        update:async data=>{
          const {error}=await client.rpc('merge_app_data',{p_collection:name,p_id:String(id),p_patch:data});
          if(error)throw error;
        },
        delete:async()=>{
          const {error}=await client.from('app_data').delete().eq('collection',name).eq('id',String(id));
          if(error)throw error;
        }
      })
    };
  };
  return {collection};
}
