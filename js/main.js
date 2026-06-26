import { api, saveSession, getSession, clearSession } from './services/apiService.js';
import { toast } from './ui/toast.js';

const app = document.getElementById('app');
const state = { user:null, unit:null, units:[], lookups:{}, appointments:[], blocked:[] };

const getName=(arr,id,key,val)=> (arr||[]).find(x=>x[key]===id)?.[val] || id || '-';
const statusClass=s=> s==='ST004'?'b-red':s==='ST005'||s==='ST006'?'b-yellow':s==='ST002'||s==='ST003'?'b-green':'b-blue';

// ========== RESTORE SESSION ==========
const session = getSession();
if (session) {
  state.user = session.user;
  state.units = session.units;
  renderUnits();
} else {
  renderLogin();
}

function renderLogin(){
  app.innerHTML = `<section class="auth">
    <div class="auth-panel">
      <div class="login-logo">🧬 Agenda Congelação</div>
      <h1 class="page-title">Bem-vindo de volta</h1><p class="page-sub">Acesse sua agenda cirúrgica com segurança.</p>
      <form id="loginForm" class="grid" style="margin-top:22px">
        <input class="input" name="email" type="email" placeholder="E-mail" value="admin@patologika.com.br" required>
        <input class="input" name="senha" type="password" placeholder="Senha" value="123456" required>
        <button class="btn btn-primary">Entrar</button>
      </form>
      <button class="btn" id="themeBtn" style="margin-top:12px">Alternar tema</button>
    </div>
    <div class="hero"><div class="hero-box"><h1>Gestão completa da agenda de congelação</h1><p>Multiempresa, multiunidade e multiusuário, com bloqueios de datas, controle de status, cadastros e dashboard.</p></div></div>
  </section>`;
  document.getElementById('themeBtn').onclick=toggleTheme;
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault(); const fd=Object.fromEntries(new FormData(e.target)); try{const d=await api('login',fd); state.user=d.user; state.units=d.units; saveSession(d.user, d.units); renderUnits();}catch(err){toast(err.message,'danger')}};
}

function toggleTheme(){document.documentElement.dataset.theme = document.documentElement.dataset.theme==='light'?'dark':'light'}

function renderUnits(){
  app.innerHTML=`<main class="main"><div class="top"><div><h1 class="page-title">Seleção de unidade</h1><p class="page-sub">Escolha onde deseja trabalhar agora.</p></div><button class="btn" id="logout">Sair</button></div><div class="grid">${state.units.map(u=>`<div class="card unit-card" data-unit="${u.unidade_id}"><div style="display:flex;gap:14px;align-items:center"><div class="unit-icon">🏥</div><div><b>${u.nome_unidade}</b><p class="muted">${u.endereco}</p><span class="badge b-green">${u.online||0} usuários online</span></div></div><b>›</b></div>`).join('')}</div></main>`;
  document.getElementById('logout').onclick=()=>{clearSession(); renderLogin();};
  document.querySelectorAll('[data-unit]').forEach(el=>el.onclick=async()=>{state.unit=state.units.find(u=>u.unidade_id===el.dataset.unit); await loadBase(); renderShell('dashboard');});
}

async function loadBase(){state.lookups=await api('getLookups',{org_id:state.user.org_id,unidade_id:state.unit.unidade_id}); state.appointments=(await api('getAppointments',{org_id:state.user.org_id,unidade_id:state.unit.unidade_id})).agendamentos; state.blocked=(await api('getBlockedDates',{org_id:state.user.org_id,unidade_id:state.unit.unidade_id})).bloqueios;}

function shellContent(page){return `<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">S</div> SmartLink</div><div class="muted" style="margin-bottom:18px">${state.user.nome}<br>${state.unit.nome_unidade}</div><nav class="nav">
  ${['dashboard:Dashboard','appointments:Agendamentos','new:Novo agendamento','blocked:Datas bloqueadas','settings:Configurações'].map(x=>{const [id,tx]=x.split(':');return `<button class="btn ${page===id?'active':''}" data-nav="${id}">${tx}</button>`}).join('')}
</nav><button class="btn" id="backUnits" style="margin-top:18px">Trocar unidade</button></aside><main class="main"><div id="view"></div></main></div>`}

function renderShell(page){app.innerHTML=shellContent(page); document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>renderShell(b.dataset.nav)); document.getElementById('backUnits').onclick=renderUnits; const view=document.getElementById('view'); if(page==='dashboard') view.innerHTML=dashboard(); if(page==='appointments') {view.innerHTML=appointments(); bindAppointments();} if(page==='new') {view.innerHTML=formAppointment(); bindForm();} if(page==='blocked') {view.innerHTML=blocked(); bindBlocked();} if(page==='settings') view.innerHTML=settings();}

function dashboard(){const total=state.appointments.length, canc=state.appointments.filter(a=>a.status_id==='ST004').length, reag=state.appointments.filter(a=>a.reagendamento==='SIM').length; return `<div class="top"><div><h1 class="page-title">Dashboard de indicadores</h1><p class="page-sub">Visão geral da unidade selecionada.</p></div></div><div class="grid grid-4"><div class="card kpi"><div class="label">Total</div><div class="num">${total}</div></div><div class="card kpi"><div class="label">Realizados</div><div class="num">${state.appointments.filter(a=>a.status_id==='ST003').length}</div></div><div class="card kpi"><div class="label">Cancelados</div><div class="num status-bad">${canc}</div></div><div class="card kpi"><div class="label">Reagendados</div><div class="num status-alert">${reag}</div></div></div><div class="grid grid-2" style="margin-top:16px"><div class="card kpi"><h3>Agendamentos por status</h3><div class="donut"><div>${total}<br><span class="muted">Total</span></div></div></div><div class="card kpi"><h3>Agendamentos por hospital</h3><div class="chart-fake"><div class="bar" style="height:70%"></div><div class="bar" style="height:48%"></div><div class="bar" style="height:28%"></div><div class="bar" style="height:18%"></div></div></div></div>`}

function appointments(){return `<div class="top"><div><h1 class="page-title">Lista de agendamentos</h1><p class="page-sub">Visualize, edite ou exclua registros.</p></div><button class="btn btn-primary" data-nav="new">+ Novo agendamento</button></div><div class="card table-wrap"><table><thead><tr><th>Data/Hora</th><th>Paciente</th><th>Hospital</th><th>Médico</th><th>Procedimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${state.appointments.map(a=>`<tr><td>${a.data_agendamento} ${a.horario}</td><td>${a.paciente}</td><td>${getName(state.lookups.hospitais,a.hospital_id,'hospital_id','nome_hospital')}</td><td>${getName(state.lookups.medicos,a.medico_id,'medico_id','nome_medico')}</td><td>${getName(state.lookups.procedimentos,a.procedimento_id,'procedimento_id','nome_procedimento')}</td><td><span class="badge ${statusClass(a.status_id)}">${getName(state.lookups.status,a.status_id,'status_id','nome_status')}</span></td><td><div class="actions"><button class="btn" data-edit="${a.agendamento_id}">✏️</button><button class="btn btn-danger" data-del="${a.agendamento_id}">🗑️</button></div></td></tr>`).join('')}</tbody></table></div>`}

function bindAppointments(){document.querySelectorAll('[data-nav="new"]').forEach(b=>b.onclick=()=>renderShell('new')); document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const a=state.appointments.find(x=>x.agendamento_id===b.dataset.edit); document.getElementById('view').innerHTML=formAppointment(a); bindForm(a);}); document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Excluir agendamento?')){try{await api('deleteAppointment',{agendamento_id:b.dataset.del,user_id:state.user.user_id}); await loadBase(); renderShell('appointments'); toast('Agendamento excluído','success')}catch(err){toast(err.message,'danger')}}})}

function opts(arr,key,val,selected){return (arr||[]).map(x=>`<option value="${x[key]}" ${x[key]===selected?'selected':''}>${x[val]}</option>`).join('')}

function formAppointment(a={}){return `<div class="top"><div><h1 class="page-title">${a.agendamento_id?'Editar':'Novo'} agendamento</h1><p class="page-sub">Cadastro com verificação de conflito e bloqueio.</p></div><button class="btn" data-nav="appointments">Cancelar</button></div><form id="apptForm" class="card" style="padding:18px"><div class="form-grid"><input name="agendamento_id" value="${a.agendamento_id||''}" hidden><label>Data<input class="input" type="date" name="data_agendamento" value="${a.data_agendamento||''}" required></label><label>Horário<input class="input" type="time" name="horario" value="${a.horario||''}" required></label><label>Procedimento<select class="select" name="procedimento_id">${opts(state.lookups.procedimentos,'procedimento_id','nome_procedimento',a.procedimento_id)}</select></label><label>Hospital<select class="select" name="hospital_id">${opts(state.lookups.hospitais,'hospital_id','nome_hospital',a.hospital_id)}</select></label><label>Convênio<select class="select" name="convenio_id">${opts(state.lookups.convenios,'convenio_id','nome_convenio',a.convenio_id)}</select></label><label>Médico<select class="select" name="medico_id">${opts(state.lookups.medicos,'medico_id','nome_medico',a.medico_id)}</select></label><label>Paciente<input class="input" name="paciente" value="${a.paciente||''}" required></label><label>Contato<input class="input" name="contato" value="${a.contato||''}"></label><label>Status<select class="select" name="status_id">${opts(state.lookups.status,'status_id','nome_status',a.status_id)}</select></label><label>Pagamento<input class="input" name="pagamento" value="${a.pagamento||''}"></label><label>Reagendamento<select class="select" name="reagendamento"><option ${a.reagendamento!=='SIM'?'selected':''}>NAO</option><option ${a.reagendamento==='SIM'?'selected':''}>SIM</option></select></label><label class="wide">Observação<textarea class="textarea" name="observacao">${a.observacao||''}</textarea></label></div><button class="btn btn-primary" style="margin-top:14px">Salvar</button></form>`}

function bindForm(){document.querySelector('[data-nav="appointments"]').onclick=()=>renderShell('appointments'); document.getElementById('apptForm').onsubmit=async e=>{e.preventDefault(); const p=Object.fromEntries(new FormData(e.target)); p.org_id=state.user.org_id;p.unidade_id=state.unit.unidade_id;p.criado_por_user_id=p.agendamento_id?state.appointments.find(x=>x.agendamento_id===p.agendamento_id)?.criado_por_user_id:state.user.user_id;p.user_id=state.user.user_id; const blocked=state.blocked.some(b=>p.data_agendamento>=b.data_inicio&&p.data_agendamento<=b.data_fim); if(blocked&&!confirm('Existe bloqueio para esta data. Deseja salvar mesmo assim?')) return; try{await api('saveAppointment',p); await loadBase(); renderShell('appointments'); toast('Agendamento salvo','success');}catch(err){toast(err.message,'danger')}}}

function blocked(){return `<div class="top"><div><h1 class="page-title">Datas bloqueadas</h1><p class="page-sub">Dias e horários indisponíveis para agendamento.</p></div></div><form id="blockForm" class="card" style="padding:18px;margin-bottom:16px"><div class="form-grid"><input class="input" type="date" name="data_inicio" required><input class="input" type="date" name="data_fim" required><select class="select" name="tipo_bloqueio"><option>Dia inteiro</option><option>Intervalo de horário</option></select><input class="input" type="time" name="horario_inicio" value="00:00"><input class="input" type="time" name="horario_fim" value="23:59"><input class="input" name="motivo" placeholder="Motivo" required></div><button class="btn btn-primary" style="margin-top:14px">+ Novo bloqueio</button></form><div class="card table-wrap"><table><thead><tr><th>Período</th><th>Horário</th><th>Tipo</th><th>Motivo</th></tr></thead><tbody>${state.blocked.map(b=>`<tr><td>${b.data_inicio} até ${b.data_fim}</td><td>${b.horario_inicio} - ${b.horario_fim}</td><td>${b.tipo_bloqueio}</td><td>${b.motivo}</td></tr>`).join('')}</tbody></table></div>`}

function bindBlocked(){document.getElementById('blockForm').onsubmit=async e=>{e.preventDefault(); const p=Object.fromEntries(new FormData(e.target)); p.org_id=state.user.org_id;p.unidade_id=state.unit.unidade_id;p.criado_por_user_id=state.user.user_id; try{await api('saveBlockedDate',p); await loadBase(); renderShell('blocked'); toast('Bloqueio cadastrado','success');}catch(err){toast(err.message,'danger')}}}

function settings(){return `<div class="top"><div><h1 class="page-title">Módulo de configurações</h1><p class="page-sub">Cadastros e permissões do sistema.</p></div></div><div class="grid grid-4">${['Usuários','Hospitais','Médicos','Convênios','Procedimentos','Status','Motivos cancelamento','Config. agenda'].map((x,i)=>`<div class="card kpi"><div class="unit-icon">${['👤','🏥','🩺','💳','🧫','✅','❌','📅'][i]}</div><h3>${x}</h3><p class="muted">Cadastrar, editar e desativar</p><button class="btn">Abrir</button></div>`).join('')}</div>`}
