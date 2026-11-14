/* Lapisan data: Supabase (app_data) dan cadangan penyimpanan lokal */
function createLocalDb(){
  const listeners={};
  const key=name=>'shikoku-family:'+name;
  const read=name=>{try{return JSON.parse(localStorage.getItem(key(name))||'[]')}catch(e){return []}};
  const write=(name,rows)=>{try{localStorage.setItem(key(name),JSON.stringify(rows))}catch(e){throw new Error('Penyimpanan lokal tidak tersedia')}};
  const notify=name=>(listeners[name]||[]).forEach(fn=>fn({docs:read(name).map(data=>({id:data.id,data:()=>({...data})}))}));
  const collection=name=>({
    onSnapshot(fn){(listeners[name]||(listeners[name]=[])).push(fn);notify(name)},
    add:async data=>{const rows=read(name),id='local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);rows.push({id,...data});write(name,rows);notify(name);return {id}},
    doc:id=>({
      set:async data=>{const rows=read(name),i=rows.findIndex(x=>x.id===id),next={id,...data};if(i<0)rows.push(next);else rows[i]=next;write(name,rows);notify(name)},
      update:async data=>{const rows=read(name),i=rows.findIndex(x=>x.id===id);if(i<0)throw new Error('Data tidak ditemukan');rows[i]={...rows[i],...data};write(name,rows);notify(name)},
      delete:async()=>{write(name,read(name).filter(x=>x.id!==id));notify(name)}
    })
  });
  return {collection};
}
const APP_DATA_COLLECTIONS=new Set(['members','events','topics','cleaning_duties','pin']);
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
        const channel=client.channel('app-data-'+name+'-'+Math.random().toString(36).slice(2));
        channel.on('postgres_changes',{event:'*',schema:'public',table:'app_data',filter:'collection=eq.'+name},()=>{clearTimeout(timer);timer=setTimeout(()=>{void refresh()},300)});
        channel.subscribe(status=>{
          if(status==='SUBSCRIBED')void refresh();
          else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reportError(new Error('Koneksi realtime Supabase gagal ('+status+').'));
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
