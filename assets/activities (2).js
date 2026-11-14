/* Daftar wilayah, menu, prefektur, provinsi, dan aturan pengenal lokasi Jepang */
const WILAYAH=[['Tokushima','#d95763'],['Takamatsu','#3985c6'],['Marugame','#e28b36'],['Zentsuji / Takuma','#8e68b5'],['Kagawa','#3985c6'],['Kochi','#24947e'],['Matsuyama','#d45e9f'],['Ehime','#6f9e3b'],['Niihama','#6073c4'],['Okayama','#c87945']];
const ALL=[['landing','Home','','','home'],['dash','Ringkasan','','','chart'],['members','Daftar Anggota','','','users'],['kegiatan','Kegiatan','','','calendar'],['piket','Jadwal Piket','','','brush'],['peta','Peta & Wilayah','','','map'],['forum','Forum','','','messages'],['pesan','Pesan Masuk','','','inbox']];
const ADMIN_MENU=[['map-settings','Pengaturan Peta','map'],['approvals','Persetujuan Akun','users']];

const PREF=['Tokushima','Kagawa','Ehime','Kochi','Okayama'];
const PREFECTURE_ALIASES=[
  ['Tokushima',['tokushima','tokushima ken','徳島県','徳島']],
  ['Kagawa',['kagawa','kagawa ken','香川県','香川']],
  ['Ehime',['ehime','ehime ken','愛媛県','愛媛']],
  ['Kochi',['kochi','kochi ken','高知県','高知']],
  ['Okayama',['okayama','okayama ken','岡山県','岡山']]
];
const LOCALITY_ALIASES=[
  ['Tokushima','Tokushima','Tokushima',['tokushima city','tokushima','徳島市']],
  ['Tokushima','Tokushima','Tokushima',['naruto','鳴門市']],
  ['Tokushima','Tokushima','Tokushima',['anan','阿南市']],
  ['Tokushima','Tokushima','Tokushima',['komatsushima','小松島市']],
  ['Tokushima','Tokushima','Tokushima',['yoshinogawa','吉野川市']],
  ['Tokushima','Tokushima','Tokushima',['mima','美馬市']],
  ['Tokushima','Tokushima','Tokushima',['miyoshi tokushima','三好市']],
  ['Kagawa','Takamatsu','Takamatsu',['takamatsu','高松市']],
  ['Kagawa','Marugame','Marugame',['marugame','丸亀市']],
  ['Kagawa','Zentsuji / Takuma','Zentsuji / Takuma',['zentsuji','善通寺市']],
  ['Kagawa','Zentsuji / Takuma','Zentsuji / Takuma',['takuma','詫間']],
  ['Kagawa','Kagawa','Tadotsu',['tadotsu','多度津町']],
  ['Kagawa','Kagawa','Sakaide',['sakaide','坂出市']],
  ['Kagawa','Kagawa','Mitoyo',['mitoyo','三豊市']],
  ['Kagawa','Kagawa','Kanonji',['kanonji','観音寺市']],
  ['Kagawa','Kagawa','Sanuki',['sanuki','さぬき市']],
  ['Kagawa','Kagawa','Higashikagawa',['higashikagawa','東かがわ市']],
  ['Ehime','Matsuyama','Matsuyama',['matsuyama','松山市']],
  ['Ehime','Niihama','Niihama',['niihama','nihama','新居浜市']],
  ['Ehime','Ehime','Imabari',['imabari','今治市']],
  ['Ehime','Ehime','Saijo',['saijo','西条市']],
  ['Ehime','Ehime','Shikokuchuo',['shikokuchuo','四国中央市']],
  ['Ehime','Ehime','Ozu',['ozu','大洲市']],
  ['Ehime','Ehime','Uwajima',['uwajima','宇和島市']],
  ['Kochi','Kochi','Kochi',['kochi city','kochi','高知市']],
  ['Kochi','Kochi','Nankoku',['nankoku','南国市']],
  ['Kochi','Kochi','Shimanto',['shimanto','四万十市']],
  ['Kochi','Kochi','Aki',['aki kochi','安芸市']],
  ['Kochi','Kochi','Susaki',['susaki','須崎市']],
  ['Okayama','Okayama','Okayama',['okayama city','okayama','岡山市']],
  ['Okayama','Okayama','Kurashiki',['kurashiki','倉敷市']],
  ['Okayama','Okayama','Tsuyama',['tsuyama','津山市']],
  ['Okayama','Okayama','Tamano',['tamano','玉野市']],
  ['Okayama','Okayama','Soja',['soja','総社市']],
  ['Okayama','Okayama','Bizen',['bizen','備前市']],
  ['Okayama','Okayama','Setouchi',['setouchi','瀬戸内市']],
  ['Okayama','Okayama','Kasaoka',['kasaoka','笠岡市']],
  ['Okayama','Okayama','Ibara',['ibara','井原市']],
  ['Okayama','Okayama','Akaiwa',['akaiwa','赤磐市']]
];
function inferJapanLocation(...values){
  const raw=values.filter(value=>value!==null&&value!==undefined&&String(value).trim()).map(String).join(' ');
  if(!raw)return null;
  const normalized=normalizeImportLabel(raw);
  const aliasLength=alias=>{
    if(/[^\u0000-\u007f]/.test(alias))return raw.includes(alias)?alias.length:0;
    const phrase=normalizeImportLabel(alias).split(' ').map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
    return new RegExp('(?:^|\\s)'+phrase+'(?:$|\\s)').test(normalized)?phrase.length:0;
  };
  const hasAlias=alias=>{
    return aliasLength(alias)>0;
  };
  const fromPref=PREFECTURE_ALIASES.find(([,aliases])=>aliases.some(hasAlias))?.[0];
  const locality=LOCALITY_ALIASES
    .filter(([pref,,,aliases])=>(!fromPref||fromPref===pref)&&aliases.some(hasAlias))
    .sort((a,b)=>Math.max(...b[3].map(aliasLength))-Math.max(...a[3].map(aliasLength)))[0];
  const postal=raw.match(/\b\d{3}[- ]?\d{4}\b/);
  const postalPrefix=postal?.[0].replace(/\D/g,'').slice(0,2);
  const fromPostal=postalPrefix==='70'||postalPrefix==='71'?'Okayama':
    postalPrefix==='76'?'Kagawa':postalPrefix==='77'?'Tokushima':
    postalPrefix==='78'?'Kochi':postalPrefix==='79'?'Ehime':'';
  const pref=fromPref||locality?.[0]||fromPostal;
  if(!pref)return null;
  const matchingLocality=locality||null;
  const wilayah=matchingLocality?.[1]||pref;
  const kota=matchingLocality?.[2]||'';
  return {pref,wilayah,kota};
}
const PROV=['Aceh','Sumatera Utara','Sumatera Barat','Riau','Kepulauan Riau','Jambi','Sumatera Selatan','Bangka Belitung','Bengkulu','Lampung','DKI Jakarta','Banten','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Bali','Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan','Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Gorontalo','Sulawesi Tengah','Sulawesi Barat','Sulawesi Selatan','Sulawesi Tenggara','Maluku','Maluku Utara','Papua','Papua Barat','Papua Barat Daya','Papua Selatan','Papua Tengah','Papua Pegunungan'];
const BLN=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const TGL=['Technical Intern (Ginou Jisshu)','Specified Skilled Worker (Tokutei Ginou)','Engineer/Specialist','Pelajar','Permanent Resident','Dependent/Keluarga','Lainnya'];
