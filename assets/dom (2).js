/* Perilaku kerangka: menu samping, tombol pengaturan admin, navigasi go() */
function isAdminSettingsView(){return ADMIN_MENU.some(([view])=>view===S.view)}
function syncAdminTheme(){
  document.body.classList.toggle('admin-dark',S.mainAdmin&&(S.adminMenuOpen||isAdminSettingsView()));
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
}
function go(v){S.view=v;S.adminMenuOpen=false;S.form=S.detail=S.dutyForm=null;S.detailOrigin=null;if(v==='pesan'&&S.admin)S.openConversation=null;document.body.classList.remove('open');syncAdminTheme();render();if(v==='pesan'&&!S.admin)markMessagesRead()}
$('#mn').onclick=()=>document.body.classList.add('open');
$('#mn').replaceChildren(icon('menu',21));
$('#st').replaceChildren(icon('settings',19));
document.querySelector('.logo')?.replaceChildren(icon('check',19));
$('#ov').onclick=()=>{
  document.body.classList.remove('open');
  if(S.adminMenuOpen){S.adminMenuOpen=false;render()}else syncAdminTheme();
};
$('#st').onclick=()=>{
  if(!S.mainAdmin)return;
  S.adminMenuOpen=!S.adminMenuOpen;
  document.body.classList.toggle('open',S.adminMenuOpen);
  $('#st').setAttribute('aria-expanded',String(S.adminMenuOpen));
  syncAdminTheme();
  render();
};

