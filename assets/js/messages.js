import { S } from './state.js';
import { h } from './dom.js';
import { $ } from './dom.js';
import { icon } from './icons.js';
import { scheduleRender } from './utils.js';
import { uploadPrivateMemberMedia } from './supabase.js';
import { accountForm } from './auth.js';

export function messageFromRow(row) {
  return { id: row.id, nama: row.nama, teks: row.message, at: row.created_at ? new Date(row.created_at).getTime() : 0, attachments: row.attachments || [], sender_id: row.sender_id };
}

export function replyFromRow(row) {
  return { id: row.id, message_id: row.message_id, by: row.sender_id, teks: row.message, at: row.created_at ? new Date(row.created_at).getTime() : 0, attachments: row.attachments || [] };
}

export function updateMessageBadges() {
  let unread = 0;
  S.topics.forEach(t => { if (t.status === 'unread') unread++; });
  S.unreadMessages = unread;
}

export function userMessageSeen(messageId) {
}

export function incomingMessageItems() {
  return S.topics.filter(t => t.status === 'unread');
}

export function conversationGroups() {
  const groups = {};
  S.topics.forEach(topic => {
    const key = topic.sender_id || 'unknown';
    if (!groups[key]) groups[key] = { key, name: topic.nama || 'Tidak diketahui', messages: [] };
    groups[key].messages.push(messageFromRow(topic));
  });
  return Object.values(groups);
}

export function conversationUnread(group) {
  return group.messages.filter(m => !m.at).length;
}

export function markMessagesRead(group) {
  group.messages.forEach(m => { m.status = 'read'; });
  updateMessageBadges();
  scheduleRender();
}

export async function loadMessages() {
  if (!S.supabase) return;
  try {
    const { data, error } = await S.supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (error) { console.error(error); return }
    S.topics = (data || []).map(messageFromRow);
    updateMessageBadges();
  } catch (e) { console.error(e); }
}

export async function subscribeToMessages() {
  if (!S.supabase) return;
  S.messageChannel = S.supabase.channel('messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async () => {
      await loadMessages();
    })
    .subscribe();
}

export async function submitMessage({ nama, teks, attachments }) {
  if (!S.supabase) throw new Error('Supabase belum tersedia');
  const { error } = await S.supabase.from('messages').insert({
    name: nama,
    message: teks,
    sender_id: S.uid,
    status: 'unread',
    attachments: attachments || []
  });
  if (error) throw error;
  await loadMessages();
}

export async function submitReply(messageId, { by, teks, attachments }) {
  if (!S.supabase) throw new Error('Supabase belum tersedia');
  const { error } = await S.supabase.from('message_replies').insert({
    message_id: messageId,
    sender_id: by,
    message: teks,
    attachments: attachments || []
  });
  if (error) throw error;
  await loadMessages();
}

export async function uploadMessageFiles(files) {
  if (!files || !files.length) return [];
  const results = [];
  for (const file of files) {
    try {
      const id = await uploadPrivateMemberMedia(file);
      results.push(id);
    } catch (e) { console.error(e); }
  }
  return results;
}

export function attachmentView(attachment) {
  return h('div', { class: 'attachment-preview' }, h('a', { href: attachment, target: '_blank' }, icon('attachment', 16), h('span', {}, attachment)));
}

export function attachmentPicker() {
  const files = [];
  const input = h('input', { type: 'file', multiple: true, style: 'display:none' });
  input.onchange = () => {
    files.push(...Array.from(input.files || []));
    input.value = '';
  };
  const label = h('span', { class: 'attachment-label' }, files.length + ' file');
  const buttons = h('div', { class: 'attachment-buttons' },
    h('button', { class: 'btn s', onclick: () => input.click() }, 'Pilih file')
  );
  return { files, label, buttons };
}

export function replyBox(messageId) {
  const ta = h('textarea', { rows: 2, placeholder: 'Balas pesan...' });
  const picker = attachmentPicker();
  return h('div', { class: 'reply-box' },
    ta,
    picker.buttons, picker.label,
    h('button', { class: 'btn s', onclick: async () => {
      if (!ta.value.trim() && !picker.files.length) return;
      try {
        const attachments = await uploadMessageFiles(picker.files);
        await submitReply(messageId, { by: S.uid, teks: ta.value.trim(), attachments });
        ta.value = '';
      } catch (e) { console.error(e); alert('Gagal mengirim balasan: ' + (e.message || 'periksa koneksi')) }
    } }, 'Kirim')
  );
}

export function vPesan() {
  if (!S.uid) return [h('h1', {}, 'Pesan Masuk'), accountForm()];
  const groups = conversationGroups();
  if (S.admin && !S.openConversation) {
    const cards = groups.length ? groups.map(group => {
      const unread = conversationUnread(group);
      return h('button', { class: 'conversation-row', onclick: () => { S.openConversation = group.key; markMessagesRead(group) } },
        h('div', { class: 'chat-avatar' }, (group.name || '?')[0].toUpperCase()),
        h('div', { style: 'min-width:0;flex:1;text-align:left' }, h('b', {}, group.name)),
        unread > 0 && h('span', { class: 'conversation-badge' }, String(unread)));
    }) : [h('p', { class: 'warn' }, 'Belum ada percakapan.')];
    return [h('h1', {}, 'Pesan Masuk'), h('p', { class: 'sub' }, groups.length + ' user'), ...cards];
  }
  const group = S.admin ? groups.find(item => item.key === S.openConversation) : groups[0];
  if (!group) return [h('h1', {}, 'Pesan Saya'), h('p', { class: 'warn' }, 'Belum ada percakapan.')];
  const messages = group.messages;
  const entries = [];
  messages.forEach(message => {
    entries.push({ at: message.at || 0, incoming: S.admin, message: message.teks || '', attachments: message.attachments || [] });
    (S.replies || []).filter(reply => reply.message_id === message.id).forEach(reply => {
      entries.push({ at: reply.at || 0, incoming: reply.by !== S.uid, message: reply.teks || '', attachments: reply.attachments || [] });
    });
  });
  entries.sort((a, b) => a.at - b.at);
  const chatBody = h('div', { class: 'chat-body' }, ...entries.map(entry => h('div', { class: 'chat-line ' + (entry.incoming ? 'incoming' : 'outgoing') },
    h('div', { class: 'chat-bubble' }, entry.message, ...entry.attachments.map(attachmentView).filter(Boolean))));
  let swipeStartX = 0, swipeStartY = 0;
  chatBody.ontouchstart = e => { swipeStartX = e.changedTouches[0].clientX; swipeStartY = e.changedTouches[0].clientY };
  chatBody.ontouchend = e => {
    const dx = e.changedTouches[0].clientX - swipeStartX, dy = e.changedTouches[0].clientY - swipeStartY;
    if (dx > 80 && Math.abs(dx) > Math.abs(dy)) {
      chatBody.classList.add('swipe-back');
      setTimeout(() => { S.openConversation = null; scheduleRender(); }, 220);
    }
  };
  requestAnimationFrame(() => { chatBody.scrollTop = chatBody.scrollHeight });
  const cards = [
    h('div', { class: 'conversation-toolbar' }, h('b', {}, group.name)),
    h('section', { class: 'chat-card' },
      chatBody,
      replyBox(messages[messages.length - 1]?.id)
    )
  ];
  return cards;
}