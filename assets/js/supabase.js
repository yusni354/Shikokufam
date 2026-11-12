import { S } from './state.js';

export function createSupabaseDb(supabase) {
  return {
    collection: name => ({
      doc: id => ({
        get: async () => {
          const { data, error } = await supabase.from(name).select('*').eq('id', id).maybeSingle();
          if (error) throw error;
          return { exists: !!data, data: data || null, id };
        },
        set: async data => {
          const { error } = await supabase.from(name).upsert({ id, ...data });
          if (error) throw error;
        },
        update: async data => {
          const { error } = await supabase.from(name).update(data).eq('id', id);
          if (error) throw error;
        },
        delete: async () => {
          const { error } = await supabase.from(name).delete().eq('id', id);
          if (error) throw error;
        }
      }),
      add: async data => {
        const { data: inserted, error } = await supabase.from(name).insert(data).select().single();
        if (error) throw error;
        return { id: inserted.id };
      },
      onSnapshot: callback => {
        const channel = supabase.channel(name).on(
          'postgres_changes',
          { event: '*', schema: 'public', table: name },
          payload => {
            const { data, error } = supabase.from(name).select('*').eq('id', payload.new?.id).maybeSingle();
            if (!error && data) callback({ docs: [{ id: data.id, ...data }] });
          }
        ).subscribe();
        return () => { supabase.removeChannel(channel); };
      }
    })
  };
}

export function createLocalDb() {
  return {
    collection: name => ({
      doc: id => ({
        get: async () => {
          const raw = localStorage.getItem('sf_local_' + name + '_' + id);
          return { exists: !!raw, data: raw ? JSON.parse(raw) : null, id };
        },
        set: async data => {
          localStorage.setItem('sf_local_' + name + '_' + id, JSON.stringify(data));
        },
        update: async data => {
          const raw = localStorage.getItem('sf_local_' + name + '_' + id);
          const cur = raw ? JSON.parse(raw) : {};
          localStorage.setItem('sf_local_' + name + '_' + id, JSON.stringify({ ...cur, ...data }));
        },
        delete: async () => {
          localStorage.removeItem('sf_local_' + name + '_' + id);
        }
      }),
      add: async data => {
        const id = 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        localStorage.setItem('sf_local_' + name + '_' + id, JSON.stringify(data));
        return { id };
      },
      onSnapshot: callback => {
        return () => {};
      }
    })
  };
}

export function isPrivateMemberMedia(path) {
  return path && String(path).startsWith('member-files/');
}

export function memberMediaAttributes(id, attr) {
  if (!id) return {};
  if (isPrivateMemberMedia(id)) {
    return { [attr]: '/api/media/' + encodeURIComponent(id) };
  }
  return { [attr]: id };
}

export async function hydrateMemberMedia() {
  if (!S.supabase) return;
  for (const [id] of S.memberMediaPending) {
    try {
      const { data } = await S.supabase.storage.from('member-files').download(id);
      if (data) {
        const url = URL.createObjectURL(data);
        S.memberMediaUrls.set(id, url);
        S.memberMediaPending.delete(id);
      }
    } catch (error) {
      console.error('Gagal memuat media:', error);
      S.memberMediaFailed.add(id);
      S.memberMediaPending.delete(id);
    }
  }
}

export async function uploadPrivateMemberMedia(file) {
  if (!S.supabase) throw new Error('Supabase belum tersedia');
  const fileName = 'member-files/' + S.uid + '/' + Date.now() + '_' + file.name;
  const { error } = await S.supabase.storage.from('member-files').upload(fileName, file);
  if (error) throw error;
  return fileName;
}

export function migrateLegacyMemberMedia(member) {
  if (!member) return;
  const legacy = S.legacyMediaPaths.get(member.id);
  if (!legacy) return;
  const newId = 'member-files/' + S.uid + '/legacy_' + Date.now();
  S.legacyMediaPaths.set(member.id, newId);
  S.memberMediaUrls.set(newId, legacy);
  S.memberMediaPending.delete(newId);
}

export function migrateMemberMediaFields(member) {
  if (!member) return;
  if (member.foto && !isPrivateMemberMedia(member.foto)) {
    migrateLegacyMemberMedia(member);
    member.foto = S.legacyMediaPaths.get(member.id);
  }
  if (member.surat && Array.isArray(member.surat)) {
    member.surat = member.surat.map(id => {
      if (!isPrivateMemberMedia(id)) {
        migrateLegacyMemberMedia({ id });
        return S.legacyMediaPaths.get(member.id);
      }
      return id;
    });
  }
}

export function readLocalCollection(name) {
  const prefix = 'sf_local_' + name + '_';
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      const id = key.slice(prefix.length);
      try {
        const data = JSON.parse(localStorage.getItem(key));
        results.push({ id, ...data });
      } catch (e) { /* skip */ }
    }
  }
  return results;
}

export function readLegacyCollection(name) {
  return readLocalCollection(name);
}

export function legacyMemberMediaCount() {
  let count = 0;
  S.members.forEach(member => {
    if (member.foto && !isPrivateMemberMedia(member.foto)) count++;
    if (member.surat && Array.isArray(member.surat)) {
      member.surat.forEach(id => { if (!isPrivateMemberMedia(id)) count++; });
    }
  });
  return count;
}

export async function migrateExistingMemberMedia() {
  if (!S.admin) return;
  S.members.forEach(member => {
    migrateMemberMediaFields(member);
  });
  S.memberMediaError = '';
  render();
}