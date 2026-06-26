/**
 * Agenda de Congelação - Google Apps Script API
 * Cole este arquivo no Apps Script vinculado à planilha.
 * Implante como Web App: Executar como você / Acesso: qualquer pessoa com link.
 */
const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';

const SHEETS = {
  Organizations:'Organizations', Unidades:'Unidades', Users:'Users', UsuariosUnidades:'UsuariosUnidades',
  PermissoesUsuarios:'PermissoesUsuarios', Agendamentos:'Agendamentos', Hospitais:'Hospitais', Medicos:'Medicos',
  Convenios:'Convenios', Procedimentos:'Procedimentos', StatusAgendamento:'StatusAgendamento', MotivosCancelamento:'MotivosCancelamento',
  DatasBloqueadas:'DatasBloqueadas', ConfiguracoesAgenda:'ConfiguracoesAgenda', HistoricoAgendamentos:'HistoricoAgendamentos', LogsAuditoria:'LogsAuditoria', Notificacoes:'Notificacoes'
};

function doGet(e){ return handle(e); }
function doPost(e){ return handle(e); }
function handle(e){
  try {
    const p = e.parameter || {};
    const action = p.action;
    let out;
    if (action === 'login') out = login(p.email, p.senha);
    else if (action === 'getUnits') out = getUnits(p.user_id, p.org_id);
    else if (action === 'getLookups') out = getLookups(p.org_id, p.unidade_id);
    else if (action === 'getAppointments') out = { agendamentos: filterRows(SHEETS.Agendamentos, { org_id:p.org_id, unidade_id:p.unidade_id, excluido_logico:'NAO' }) };
    else if (action === 'saveAppointment') out = saveAppointment(p);
    else if (action === 'deleteAppointment') out = deleteAppointment(p.agendamento_id, p.user_id);
    else if (action === 'getBlockedDates') out = { bloqueios: filterRows(SHEETS.DatasBloqueadas, { org_id:p.org_id, unidade_id:p.unidade_id, ativo:'SIM' }) };
    else if (action === 'saveBlockedDate') out = saveRow(SHEETS.DatasBloqueadas, p, 'bloqueio_id', 'BLOQ');
    else if (action === 'saveLookup') out = saveLookup(p);
    else out = { error:'Ação não encontrada: ' + action };
    return json(out);
  } catch(err) { return json({ error:String(err && err.message ? err.message : err) }); }
}
function json(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function ss(){ return SpreadsheetApp.openById(SPREADSHEET_ID); }
function sheet(name){ const s = ss().getSheetByName(name); if(!s) throw new Error('Aba não encontrada: '+name); return s; }
function rows(name){
  const sh = sheet(name); const values = sh.getDataRange().getValues(); if(values.length < 1) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.some(c => c !== '')).map(r => Object.fromEntries(headers.map((h,i)=>[h, normalize(r[i])])));
}
function normalize(v){ if(v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return v === null ? '' : String(v); }
function append(name, obj){ const sh = sheet(name); const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); sh.appendRow(headers.map(h => obj[h] || '')); }
function updateById(name, idField, id, obj){
  const sh = sheet(name); const values = sh.getDataRange().getValues(); const headers = values[0].map(String); const idCol = headers.indexOf(idField);
  for(let r=1;r<values.length;r++) if(String(values[r][idCol]) === String(id)){ headers.forEach((h,c)=>{ if(obj[h] !== undefined) sh.getRange(r+1,c+1).setValue(obj[h]); }); return true; }
  return false;
}
function filterRows(name, criteria){
  return rows(name).filter(row => Object.entries(criteria).every(([k,v]) => !v || String(row[k]) === String(v)));
}
function uid(prefix){ return prefix + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') + Math.floor(Math.random()*999); }

function login(email, senha){
  const user = rows(SHEETS.Users).find(u => String(u.email).toLowerCase() === String(email).toLowerCase() && String(u.senha_hash) === String(senha) && u.ativo === 'SIM');
  if(!user) return { error:'Usuário ou senha inválidos' };
  const links = rows(SHEETS.UsuariosUnidades).filter(x => x.user_id === user.user_id && x.ativo === 'SIM');
  const allUnits = rows(SHEETS.Unidades).filter(u => u.org_id === user.org_id && u.ativo === 'SIM');
  const units = allUnits.filter(u => links.some(l => l.unidade_id === u.unidade_id));
  log(user.org_id, '', user.user_id, 'LOGIN', 'Auth', 'Usuário acessou o sistema');
  return { user, units };
}
function getUnits(user_id, org_id){
  const links = rows(SHEETS.UsuariosUnidades).filter(x => x.user_id === user_id && x.org_id === org_id && x.ativo === 'SIM');
  const units = rows(SHEETS.Unidades).filter(u => u.org_id === org_id && links.some(l => l.unidade_id === u.unidade_id));
  return { units };
}
function getLookups(org_id, unidade_id){
  const f = (name) => rows(name).filter(x => x.org_id === org_id && (!x.unidade_id || x.unidade_id === unidade_id || x.unidade_id === '') && x.ativo !== 'NAO');
  return { hospitais:f(SHEETS.Hospitais), medicos:f(SHEETS.Medicos), convenios:f(SHEETS.Convenios), procedimentos:f(SHEETS.Procedimentos), status:rows(SHEETS.StatusAgendamento).filter(x=>x.org_id===org_id && x.ativo==='SIM'), motivos:rows(SHEETS.MotivosCancelamento).filter(x=>x.org_id===org_id && x.ativo==='SIM') };
}
function saveAppointment(p){
  const now = new Date();
  const obj = {
    agendamento_id:p.agendamento_id || uid('AGE'), org_id:p.org_id, unidade_id:p.unidade_id, data_agendamento:p.data_agendamento, horario:p.horario,
    hospital_id:p.hospital_id, convenio_id:p.convenio_id, medico_id:p.medico_id, procedimento_id:p.procedimento_id, paciente:p.paciente,
    contato:p.contato, reagendamento:p.reagendamento || 'NAO', status_id:p.status_id, motivo_cancelamento_id:p.motivo_cancelamento_id || '', pagamento:p.pagamento,
    observacao:p.observacao, criado_por_user_id:p.criado_por_user_id, editado_por_user_id:p.user_id || '', criado_em:p.criado_em || now, atualizado_em:now, excluido_logico:'NAO'
  };
  if(p.agendamento_id) { updateById(SHEETS.Agendamentos, 'agendamento_id', p.agendamento_id, obj); historico(obj, p.user_id || p.criado_por_user_id, 'EDITAR', 'Registro editado'); }
  else { append(SHEETS.Agendamentos, obj); historico(obj, p.criado_por_user_id, 'CRIAR', 'Registro criado'); }
  return { ok:true, agendamento:obj };
}
function deleteAppointment(id, user_id){
  updateById(SHEETS.Agendamentos, 'agendamento_id', id, { excluido_logico:'SIM', atualizado_em:new Date(), editado_por_user_id:user_id || '' });
  return { ok:true };
}
function saveRow(sheetName, p, idField, prefix){
  const obj = Object.assign({}, p); delete obj.action; obj[idField] = obj[idField] || uid(prefix); obj.criado_em = obj.criado_em || new Date(); obj.ativo = obj.ativo || 'SIM';
  if(p[idField]) updateById(sheetName, idField, p[idField], obj); else append(sheetName, obj);
  return { ok:true, item:obj };
}
function saveLookup(p){
  const map = { hospital:SHEETS.Hospitais, medico:SHEETS.Medicos, convenio:SHEETS.Convenios, procedimento:SHEETS.Procedimentos, status:SHEETS.StatusAgendamento };
  const idMap = { hospital:['hospital_id','HOSP'], medico:['medico_id','MED'], convenio:['convenio_id','CONV'], procedimento:['procedimento_id','PROC'], status:['status_id','ST'] };
  const target = map[p.tipo]; if(!target) return { error:'Tipo inválido' };
  const [field,prefix] = idMap[p.tipo]; return saveRow(target, p, field, prefix);
}
function historico(appt, user_id, acao, obs){
  append(SHEETS.HistoricoAgendamentos, { historico_id:uid('HIST'), agendamento_id:appt.agendamento_id, org_id:appt.org_id, unidade_id:appt.unidade_id, user_id:user_id || '', acao, campo_alterado:'', valor_antigo:'', valor_novo:'', data_hora:new Date(), observacao:obs });
}
function log(org_id, unidade_id, user_id, acao, modulo, descricao){
  append(SHEETS.LogsAuditoria, { log_id:uid('LOG'), org_id, unidade_id, user_id, acao, modulo, descricao, data_hora:new Date(), ip:'', dispositivo:'' });
}
