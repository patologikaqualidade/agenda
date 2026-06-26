import { api, saveSession, getSession, clearSession, saveUnit, getUnit } from './services/apiService.js';
import { toast } from './ui/toast.js';

const app = document.getElementById('app');
const state = { user:null, unit:null, units:[], lookups:{}, appointments:[], blocked:[] };

const getName=(arr,id,key,val)=> (arr||[]).find(x=>x[key]===id)?.[val] || id || '-';
const statusClass=s=> s==='ST004'?'b-red':s==='ST005'||s==='ST006'?'b-yellow':s==='ST002'||s==='ST003'?'b-green':'b-blue';

// ========== RESTORE SESSION ==========
const session = getSession();
const savedUnit = getUnit();

if (session) {
  state.user = session.user;
  state.units = session.units;
  
  if (savedUnit && state.units.some(u => u.unidade_id === savedUnit.unidade_id)) {
    state.unit = savedUnit;
    (async () => {
      await loadBase();
      renderShell('dashboard');
    })();
  } else {
    renderUnits();
  }
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
  app.innerHTML=`<main class="main"><div class="top"><div><h1 class="page-title">Seleção de unidade</h1><p class="page-sub">Escolha onde deseja trabalhar agora.</p></div></div><div class="grid">${state.units.map(u=>`<div class="card unit-card" data-unit="${u.unidade_id}"><div style="display:flex;gap:14px;align-items:center"><div class="unit-icon">🏥</div><div><b>${u.nome_unidade}</b><p class="muted">${u.endereco}</p><span class="badge b-green">${u.online||0} usuários online</span></div></div><b>›</b></div>`).join('')}</div></main>`;
  document.querySelectorAll('[data-unit]').forEach(el=>el.onclick=async()=>{state.unit=state.units.find(u=>u.unidade_id===el.dataset.unit); saveUnit(state.unit); await loadBase(); renderShell('dashboard');});
}

async function loadBase(){
  const [lookupsRes, appointmentsRes, blockedRes] = await Promise.all([
    api('getLookups',{org_id:state.user.org_id,unidade_id:state.unit.unidade_id}),
    api('getAppointments',{org_id:state.user.org_id,unidade_id:state.unit.unidade_id}),
    api('getBlockedDates',{org_id:state.user.org_id,unidade_id:state.unit.unidade_id})
  ]);
  state.lookups = lookupsRes;
  state.appointments = appointmentsRes.agendamentos;
  state.blocked = blockedRes.bloqueios;
}

function shellContent(page){return `<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">D</div> Delfos</div><div class="muted" style="margin-bottom:18px">${state.user.nome}<br>${state.unit.nome_unidade}</div><nav class="nav">
  ${['dashboard:Dashboard','appointments:Agendamentos','new:Novo agendamento','blocked:Datas bloqueadas','settings:Configurações'].map(x=>{const [id,tx]=x.split(':');return `<button class="btn ${page===id?'active':''}" data-nav="${id}">${tx}</button>`}).join('')}
</nav><button class="btn" id="backUnits" style="margin-top:18px">Trocar unidade</button><button class="btn btn-danger" id="logout" style="margin-top:8px">Sair</button></aside><main class="main"><div id="view"></div></main></div>`}

function renderShell(page){
  app.innerHTML=shellContent(page); 
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>renderShell(b.dataset.nav)); 
  document.getElementById('backUnits').onclick=()=>{state.unit=null; renderUnits();};
  document.getElementById('logout').onclick=()=>{clearSession(); renderLogin();};
  const view=document.getElementById('view'); 
  if(page==='dashboard') view.innerHTML=dashboard(); 
  if(page==='appointments') {view.innerHTML=appointments(); bindAppointments();} 
  if(page==='new') {view.innerHTML=formAppointment(); bindForm();} 
  if(page==='blocked') {view.innerHTML=blocked(); bindBlocked();} 
  if(page==='settings') {
    view.innerHTML=settings(); 
    bindSettings();
  }
}

function dashboard(){const total=state.appointments.length, canc=state.appointments.filter(a=>a.status_id==='ST004').length, reag=state.appointments.filter(a=>a.reagendamento==='SIM').length; return `<div class="top"><div><h1 class="page-title">Dashboard de indicadores</h1><p class="page-sub">Visão geral da unidade selecionada.</p></div></div><div class="grid grid-4"><div class="card kpi"><div class="label">Total</div><div class="num">${total}</div></div><div class="card kpi"><div class="label">Realizados</div><div class="num">${state.appointments.filter(a=>a.status_id==='ST003').length}</div></div><div class="card kpi"><div class="label">Cancelados</div><div class="num status-bad">${canc}</div></div><div class="card kpi"><div class="label">Reagendados</div><div class="num status-alert">${reag}</div></div></div><div class="grid grid-2" style="margin-top:16px"><div class="card kpi"><h3>Agendamentos por status</h3><div class="donut"><div>${total}<br><span class="muted">Total</span></div></div></div><div class="card kpi"><h3>Agendamentos por hospital</h3><div class="chart-fake"><div class="bar" style="height:70%"></div><div class="bar" style="height:48%"></div><div class="bar" style="height:28%"></div><div class="bar" style="height:18%"></div></div></div></div>`}

function appointments(){return `<div class="top"><div><h1 class="page-title">Lista de agendamentos</h1><p class="page-sub">Visualize, edite ou exclua registros.</p></div><button class="btn btn-primary" data-nav="new">+ Novo agendamento</button></div><div class="card table-wrap"><table><thead><tr><th>Data/Hora</th><th>Paciente</th><th>Hospital</th><th>Médico</th><th>Procedimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>${state.appointments.map(a=>`<tr><td>${a.data_agendamento} ${a.horario}</td><td>${a.paciente}</td><td>${getName(state.lookups.hospitais,a.hospital_id,'hospital_id','nome_hospital')}</td><td>${getName(state.lookups.medicos,a.medico_id,'medico_id','nome_medico')}</td><td>${getName(state.lookups.procedimentos,a.procedimento_id,'procedimento_id','nome_procedimento')}</td><td><span class="badge ${statusClass(a.status_id)}">${getName(state.lookups.status,a.status_id,'status_id','nome_status')}</span></td><td><div class="actions"><button class="btn" data-edit="${a.agendamento_id}">✏️</button><button class="btn btn-danger" data-del="${a.agendamento_id}">🗑️</button></div></td></tr>`).join('')}</tbody></table></div>`}

function bindAppointments(){document.querySelectorAll('[data-nav="new"]').forEach(b=>b.onclick=()=>renderShell('new')); document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const a=state.appointments.find(x=>x.agendamento_id===b.dataset.edit); document.getElementById('view').innerHTML=formAppointment(a); bindForm(a);}); document.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Excluir agendamento?')){try{await api('deleteAppointment',{agendamento_id:b.dataset.del,user_id:state.user.user_id}); await loadBase(); renderShell('appointments'); toast('Agendamento excluído','success')}catch(err){toast(err.message,'danger')}}})}

function opts(arr,key,val,selected){return (arr||[]).map(x=>`<option value="${x[key]}" ${x[key]===selected?'selected':''}>${x[val]}</option>`).join('')}

function formAppointment(a={}){return `<div class="top"><div><h1 class="page-title">${a.agendamento_id?'Editar':'Novo'} agendamento</h1><p class="page-sub">Cadastro com verificação de conflito e bloqueio.</p></div><button class="btn" data-nav="appointments">Cancelar</button></div><form id="apptForm" class="card" style="padding:18px"><div class="form-grid"><input name="agendamento_id" value="${a.agendamento_id||''}" hidden><label>Data<input class="input" type="date" name="data_agendamento" value="${a.data_agendamento||''}" required></label><label>Horário<input class="input" type="time" name="horario" value="${a.horario||''}" required></label><label>Procedimento<select class="select" name="procedimento_id">${opts(state.lookups.procedimentos,'procedimento_id','nome_procedimento',a.procedimento_id)}</select></label><label>Hospital<select class="select" name="hospital_id">${opts(state.lookups.hospitais,'hospital_id','nome_hospital',a.hospital_id)}</select></label><label>Convênio<select class="select" name="convenio_id">${opts(state.lookups.convenios,'convenio_id','nome_convenio',a.convenio_id)}</select></label><label>Médico<select class="select" name="medico_id">${opts(state.lookups.medicos,'medico_id','nome_medico',a.medico_id)}</select></label><label>Paciente<input class="input" name="paciente" value="${a.paciente||''}" required></label><label>Contato<input class="input" name="contato" value="${a.contato||''}"></label><label>Status<select class="select" name="status_id">${opts(state.lookups.status,'status_id','nome_status',a.status_id)}</select></label><label>Pagamento<input class="input" name="pagamento" value="${a.pagamento||''}"></label><label>Reagendamento<select class="select" name="reagendamento"><option ${a.reagendamento!=='SIM'?'selected':''}>NAO</option><option ${a.reagendamento==='SIM'?'selected':''}>SIM</option></select></label><label class="wide">Observação<textarea class="textarea" name="observacao">${a.observacao||''}</textarea></label></div><button class="btn btn-primary" style="margin-top:14px">Salvar</button></form>`}

function bindForm(){document.querySelector('[data-nav="appointments"]').onclick=()=>renderShell('appointments'); document.getElementById('apptForm').onsubmit=async e=>{e.preventDefault(); const p=Object.fromEntries(new FormData(e.target)); p.org_id=state.user.org_id;p.unidade_id=state.unit.unidade_id;p.criado_por_user_id=p.agendamento_id?state.appointments.find(x=>x.agendamento_id===p.agendamento_id)?.criado_por_user_id:state.user.user_id;p.user_id=state.user.user_id; const blocked=state.blocked.some(b=>p.data_agendamento>=b.data_inicio&&p.data_agendamento<=b.data_fim); if(blocked&&!confirm('Existe bloqueio para esta data. Deseja salvar mesmo assim?')) return; try{await api('saveAppointment',p); await loadBase(); renderShell('appointments'); toast('Agendamento salvo','success');}catch(err){toast(err.message,'danger')}}}

function blocked(){return `<div class="top"><div><h1 class="page-title">Datas bloqueadas</h1><p class="page-sub">Dias e horários indisponíveis para agendamento.</p></div></div><form id="blockForm" class="card" style="padding:18px;margin-bottom:16px"><div class="form-grid"><input class="input" type="date" name="data_inicio" required><input class="input" type="date" name="data_fim" required><select class="select" name="tipo_bloqueio"><option>Dia inteiro</option><option>Intervalo de horário</option></select><input class="input" type="time" name="horario_inicio" value="00:00"><input class="input" type="time" name="horario_fim" value="23:59"><input class="input" name="motivo" placeholder="Motivo" required></div><button class="btn btn-primary" style="margin-top:14px">+ Novo bloqueio</button></form><div class="card table-wrap"><table><thead><tr><th>Período</th><th>Horário</th><th>Tipo</th><th>Motivo</th></tr></thead><tbody>${state.blocked.map(b=>`<tr><td>${b.data_inicio} até ${b.data_fim}</td><td>${b.horario_inicio} - ${b.horario_fim}</td><td>${b.tipo_bloqueio}</td><td>${b.motivo}</td></tr>`).join('')}</tbody></table></div>`}

function bindBlocked(){document.getElementById('blockForm').onsubmit=async e=>{e.preventDefault(); const p=Object.fromEntries(new FormData(e.target)); p.org_id=state.user.org_id;p.unidade_id=state.unit.unidade_id;p.criado_por_user_id=state.user.user_id; try{await api('saveBlockedDate',p); await loadBase(); renderShell('blocked'); toast('Bloqueio cadastrado','success');}catch(err){toast(err.message,'danger')}}}

// ========== SETTINGS ==========
function settings(){
  return `<div class="top"><div><h1 class="page-title">Módulo de configurações</h1><p class="page-sub">Cadastros e permissões do sistema.</p></div></div><div class="grid grid-4">${['Usuários:usuarios','Hospitais:hospitais','Médicos:medicos','Convênios:convenios','Procedimentos:procedimentos','Status:status','Motivos cancelamento:motivos','Config. agenda:configAgenda'].map((x,i)=>{const [tx,id]=x.split(':');const icons=['👤','🏥','🩺','💳','🧫','✅','❌','📅'];return `<div class="card kpi"><div class="unit-icon">${icons[i]}</div><h3>${tx}</h3><p class="muted">Cadastrar, editar</p><button class="btn" data-config="${id}">Abrir</button></div>`}).join('')}</div>`;
}

function bindSettings(){
  document.querySelectorAll('[data-config]').forEach(b=>b.onclick=()=>{
    const cfg=b.dataset.config;
    const view=document.getElementById('view');
    if(cfg==='usuarios'){
      view.innerHTML=settingsUsuarios();
      bindSettingsUsuarios();
    }
    if(cfg==='hospitais'){
      view.innerHTML=settingsHospitais();
      bindSettingsHospitais();
    }
    if(cfg==='medicos'){
      view.innerHTML=settingsMedicos();
      bindSettingsMedicos();
    }
    if(cfg==='convenios'){
      view.innerHTML=settingsConvenios();
      bindSettingsConvenios();
    }
    if(cfg==='procedimentos'){
      view.innerHTML=settingsProcedimentos();
      bindSettingsProcedimentos();
    }
    if(cfg==='status'){
      view.innerHTML=settingsStatus();
      bindSettingsStatus();
    }
    if(cfg==='motivos'){
      view.innerHTML=settingsMotivos();
      bindSettingsMotivos();
    }
    if(cfg==='configAgenda'){
      view.innerHTML=settingsConfigAgenda();
      bindSettingsConfigAgenda();
    }
  });
}

// ========== SETTINGS USUÁRIOS ==========
function settingsUsuarios(){
  const usuarios = state.lookups.usuarios || [];
  return `<div class="top"><div><h1 class="page-title">Cadastro de Usuários</h1><p class="page-sub">Adicione, edite ou remova usuários do sistema.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="usuarioForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="usuarioId" hidden>
        <label>Nome<input class="input" id="usuarioNome" placeholder="Ex: João Silva" required></label>
        <label>Email<input class="input" type="email" id="usuarioEmail" placeholder="joao@example.com" required></label>
        <label>Senha<input class="input" type="password" id="usuarioSenha" placeholder="Deixe em branco para não alterar"></label>
        <label>Status<select class="select" id="usuarioAtivo"><option value="SIM">Ativo</option><option value="NAO">Inativo</option></select></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Usuário</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Email</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${usuarios.map(u=>`<tr>
          <td>${u.nome}</td>
          <td>${u.email}</td>
          <td><span class="badge ${u.ativo==='SIM'?'b-green':'b-red'}">${u.ativo==='SIM'?'Ativo':'Inativo'}</span></td>
          <td><button class="btn" data-edit-user="${u.user_id}">✏️</button> <button class="btn btn-danger" data-del-user="${u.user_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsUsuarios(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('usuarioForm').onsubmit=async e=>{
    e.preventDefault();
    const userId = document.getElementById('usuarioId').value;
    const p={
      user_id:userId||'',
      nome:document.getElementById('usuarioNome').value,
      email:document.getElementById('usuarioEmail').value,
      org_id:state.user.org_id,
      ativo:document.getElementById('usuarioAtivo').value
    };
    
    const senha = document.getElementById('usuarioSenha').value;
    if(senha) p.senha_hash = senha;
    
    try{
      await api('saveUser',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsUsuarios();
      bindSettingsUsuarios();
      toast('Usuário salvo','success');
      document.getElementById('usuarioForm').reset();
      document.getElementById('usuarioId').value='';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=()=>{
    const u=state.lookups.usuarios.find(x=>x.user_id===b.dataset.editUser);
    document.getElementById('usuarioId').value=u.user_id;
    document.getElementById('usuarioNome').value=u.nome;
    document.getElementById('usuarioEmail').value=u.email;
    document.getElementById('usuarioAtivo').value=u.ativo;
    document.getElementById('usuarioSenha').value='';
  });
  
  document.querySelectorAll('[data-del-user]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este usuário?')){
      try{
        await api('saveUser',{
          user_id:b.dataset.delUser,
          ativo:'NAO',
          org_id:state.user.org_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsUsuarios();
        bindSettingsUsuarios();
        toast('Usuário deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS HOSPITAIS ==========
function settingsHospitais(){
  const hospitais = state.lookups.hospitais || [];
  return `<div class="top"><div><h1 class="page-title">Cadastro de Hospitais</h1><p class="page-sub">Adicione, edite ou remova hospitais.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="hospitalForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="hospitalId" hidden>
        <label>Nome do Hospital<input class="input" id="hospitalNome" placeholder="Ex: Hospital Primavera" required></label>
        <label>Endereço<input class="input" id="hospitalEndereco" placeholder="Endereço"></label>
        <label>Telefone<input class="input" id="hospitalTelefone" placeholder="(79) 9999-9999"></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Hospital</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Endereço</th><th>Ações</th></tr></thead>
        <tbody>${hospitais.map(h=>`<tr>
          <td>${h.nome_hospital}</td>
          <td>${h.endereco || '-'}</td>
          <td><button class="btn" data-edit-hosp="${h.hospital_id}">✏️</button> <button class="btn btn-danger" data-del-hosp="${h.hospital_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsHospitais(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('hospitalForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'hospital',
      hospital_id:document.getElementById('hospitalId').value||'',
      nome_hospital:document.getElementById('hospitalNome').value,
      endereco:document.getElementById('hospitalEndereco').value,
      telefone:document.getElementById('hospitalTelefone').value,
      org_id:state.user.org_id,
      unidade_id:state.unit.unidade_id,
      ativo:'SIM'
    };
    try{
      await api('saveLookup',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsHospitais();
      bindSettingsHospitais();
      toast('Hospital salvo','success');
      document.getElementById('hospitalForm').reset();
      document.getElementById('hospitalId').value='';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-hosp]').forEach(b=>b.onclick=()=>{
    const h=state.lookups.hospitais.find(x=>x.hospital_id===b.dataset.editHosp);
    document.getElementById('hospitalId').value=h.hospital_id;
    document.getElementById('hospitalNome').value=h.nome_hospital;
    document.getElementById('hospitalEndereco').value=h.endereco||'';
    document.getElementById('hospitalTelefone').value=h.telefone||'';
  });
  
  document.querySelectorAll('[data-del-hosp]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este hospital?')){
      try{
        await api('saveLookup',{
          tipo:'hospital',
          hospital_id:b.dataset.delHosp,
          ativo:'NAO',
          org_id:state.user.org_id,
          unidade_id:state.unit.unidade_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsHospitais();
        bindSettingsHospitais();
        toast('Hospital deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS MÉDICOS ==========
function settingsMedicos(){
  const medicos = state.lookups.medicos || [];
  return `<div class="top"><div><h1 class="page-title">Cadastro de Médicos</h1><p class="page-sub">Adicione, edite ou remova médicos.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="medicoForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="medicoId" hidden>
        <label>Nome do Médico<input class="input" id="medicoNome" placeholder="Ex: Dr. João Silva" required></label>
        <label>Especialidade<input class="input" id="medicoEspecialidade" placeholder="Ex: Oncologia"></label>
        <label>CRM<input class="input" id="medicoCRM" placeholder="Ex: 123456"></label>
        <label>Telefone<input class="input" id="medicoTelefone" placeholder="(79) 9999-9999"></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Médico</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Especialidade</th><th>CRM</th><th>Ações</th></tr></thead>
        <tbody>${medicos.map(m=>`<tr>
          <td>${m.nome_medico}</td>
          <td>${m.especialidade || '-'}</td>
          <td>${m.crm || '-'}</td>
          <td><button class="btn" data-edit-med="${m.medico_id}">✏️</button> <button class="btn btn-danger" data-del-med="${m.medico_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsMedicos(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('medicoForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'medico',
      medico_id:document.getElementById('medicoId').value||'',
      nome_medico:document.getElementById('medicoNome').value,
      especialidade:document.getElementById('medicoEspecialidade').value,
      crm:document.getElementById('medicoCRM').value,
      telefone:document.getElementById('medicoTelefone').value,
      org_id:state.user.org_id,
      unidade_id:state.unit.unidade_id,
      ativo:'SIM'
    };
    try{
      await api('saveLookup',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsMedicos();
      bindSettingsMedicos();
      toast('Médico salvo','success');
      document.getElementById('medicoForm').reset();
      document.getElementById('medicoId').value='';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-med]').forEach(b=>b.onclick=()=>{
    const m=state.lookups.medicos.find(x=>x.medico_id===b.dataset.editMed);
    document.getElementById('medicoId').value=m.medico_id;
    document.getElementById('medicoNome').value=m.nome_medico;
    document.getElementById('medicoEspecialidade').value=m.especialidade||'';
    document.getElementById('medicoCRM').value=m.crm||'';
    document.getElementById('medicoTelefone').value=m.telefone||'';
  });
  
  document.querySelectorAll('[data-del-med]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este médico?')){
      try{
        await api('saveLookup',{
          tipo:'medico',
          medico_id:b.dataset.delMed,
          ativo:'NAO',
          org_id:state.user.org_id,
          unidade_id:state.unit.unidade_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsMedicos();
        bindSettingsMedicos();
        toast('Médico deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS CONVÊNIOS ==========
function settingsConvenios(){
  const convenios = state.lookups.convenios || [];
  return `<div class="top"><div><h1 class="page-title">Cadastro de Convênios</h1><p class="page-sub">Adicione, edite ou remova convênios.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="convenioForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="convenioId" hidden>
        <label>Nome do Convênio<input class="input" id="convenioNome" placeholder="Ex: Bradesco Saúde" required></label>
        <label>Contato<input class="input" id="convenioContato" placeholder="(79) 9999-9999"></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Convênio</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Contato</th><th>Ações</th></tr></thead>
        <tbody>${convenios.map(c=>`<tr>
          <td>${c.nome_convenio}</td>
          <td>${c.contato || '-'}</td>
          <td><button class="btn" data-edit-conv="${c.convenio_id}">✏️</button> <button class="btn btn-danger" data-del-conv="${c.convenio_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsConvenios(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('convenioForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'convenio',
      convenio_id:document.getElementById('convenioId').value||'',
      nome_convenio:document.getElementById('convenioNome').value,
      contato:document.getElementById('convenioContato').value,
      org_id:state.user.org_id,
      unidade_id:state.unit.unidade_id,
      ativo:'SIM'
    };
    try{
      await api('saveLookup',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsConvenios();
      bindSettingsConvenios();
      toast('Convênio salvo','success');
      document.getElementById('convenioForm').reset();
      document.getElementById('convenioId').value='';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-conv]').forEach(b=>b.onclick=()=>{
    const c=state.lookups.convenios.find(x=>x.convenio_id===b.dataset.editConv);
    document.getElementById('convenioId').value=c.convenio_id;
    document.getElementById('convenioNome').value=c.nome_convenio;
    document.getElementById('convenioContato').value=c.contato||'';
  });
  
  document.querySelectorAll('[data-del-conv]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este convênio?')){
      try{
        await api('saveLookup',{
          tipo:'convenio',
          convenio_id:b.dataset.delConv,
          ativo:'NAO',
          org_id:state.user.org_id,
          unidade_id:state.unit.unidade_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsConvenios();
        bindSettingsConvenios();
        toast('Convênio deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS PROCEDIMENTOS ==========
function settingsProcedimentos(){
  const procedimentos = state.lookups.procedimentos || [];
  return `<div class="top"><div><h1 class="page-title">Cadastro de Procedimentos</h1><p class="page-sub">Adicione, edite ou remova procedimentos.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="procedimentoForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="procedimentoId" hidden>
        <label>Nome do Procedimento<input class="input" id="procedimentoNome" placeholder="Ex: Congelação" required></label>
        <label>Descrição<textarea class="textarea" id="procedimentoDescricao" placeholder="Descrição do procedimento" style="height:80px"></textarea></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Procedimento</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Descrição</th><th>Ações</th></tr></thead>
        <tbody>${procedimentos.map(p=>`<tr>
          <td>${p.nome_procedimento}</td>
          <td>${p.descricao || '-'}</td>
          <td><button class="btn" data-edit-proc="${p.procedimento_id}">✏️</button> <button class="btn btn-danger" data-del-proc="${p.procedimento_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsProcedimentos(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('procedimentoForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'procedimento',
      procedimento_id:document.getElementById('procedimentoId').value||'',
      nome_procedimento:document.getElementById('procedimentoNome').value,
      descricao:document.getElementById('procedimentoDescricao').value,
      org_id:state.user.org_id,
      unidade_id:state.unit.unidade_id,
      ativo:'SIM'
    };
    try{
      await api('saveLookup',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsProcedimentos();
      bindSettingsProcedimentos();
      toast('Procedimento salvo','success');
      document.getElementById('procedimentoForm').reset();
      document.getElementById('procedimentoId').value='';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-proc]').forEach(b=>b.onclick=()=>{
    const pr=state.lookups.procedimentos.find(x=>x.procedimento_id===b.dataset.editProc);
    document.getElementById('procedimentoId').value=pr.procedimento_id;
    document.getElementById('procedimentoNome').value=pr.nome_procedimento;
    document.getElementById('procedimentoDescricao').value=pr.descricao||'';
  });
  
  document.querySelectorAll('[data-del-proc]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este procedimento?')){
      try{
        await api('saveLookup',{
          tipo:'procedimento',
          procedimento_id:b.dataset.delProc,
          ativo:'NAO',
          org_id:state.user.org_id,
          unidade_id:state.unit.unidade_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsProcedimentos();
        bindSettingsProcedimentos();
        toast('Procedimento deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS STATUS ==========
function settingsStatus(){
  const status = state.lookups.status || [];
  return `<div class="top"><div><h1 class="page-title">Cadastro de Status</h1><p class="page-sub">Adicione, edite ou remova status de agendamento.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="statusForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="statusId" hidden>
        <label>Nome do Status<input class="input" id="statusNome" placeholder="Ex: Confirmado" required></label>
        <label>Cor<input class="input" type="color" id="statusCor" value="#2563EB"></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Status</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>Cor</th><th>Ações</th></tr></thead>
        <tbody>${status.map(s=>`<tr>
          <td>${s.nome_status}</td>
          <td><div style="display:inline-block;width:20px;height:20px;background:${s.cor};border-radius:3px;border:1px solid #ccc"></div> ${s.cor}</td>
          <td><button class="btn" data-edit-st="${s.status_id}">✏️</button> <button class="btn btn-danger" data-del-st="${s.status_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsStatus(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('statusForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'status',
      status_id:document.getElementById('statusId').value||'',
      nome_status:document.getElementById('statusNome').value,
      cor:document.getElementById('statusCor').value,
      org_id:state.user.org_id,
      ativo:'SIM'
    };
    try{
      await api('saveLookup',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsStatus();
      bindSettingsStatus();
      toast('Status salvo','success');
      document.getElementById('statusForm').reset();
      document.getElementById('statusId').value='';
      document.getElementById('statusCor').value='#2563EB';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-st]').forEach(b=>b.onclick=()=>{
    const st=state.lookups.status.find(x=>x.status_id===b.dataset.editSt);
    document.getElementById('statusId').value=st.status_id;
    document.getElementById('statusNome').value=st.nome_status;
    document.getElementById('statusCor').value=st.cor;
  });
  
  document.querySelectorAll('[data-del-st]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este status?')){
      try{
        await api('saveLookup',{
          tipo:'status',
          status_id:b.dataset.delSt,
          ativo:'NAO',
          org_id:state.user.org_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsStatus();
        bindSettingsStatus();
        toast('Status deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS MOTIVOS CANCELAMENTO ==========
function settingsMotivos(){
  const motivos = state.lookups.motivos || [];
  return `<div class="top"><div><h1 class="page-title">Motivos de Cancelamento</h1><p class="page-sub">Adicione, edite ou remova motivos de cancelamento.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="motivoForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <input id="motivoId" hidden>
        <label>Motivo<input class="input" id="motivoNome" placeholder="Ex: Paciente não compareceu" required></label>
        <label>Descrição<textarea class="textarea" id="motivoDescricao" placeholder="Descrição do motivo" style="height:80px"></textarea></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Motivo</button>
    </form>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Motivo</th><th>Descrição</th><th>Ações</th></tr></thead>
        <tbody>${motivos.map(m=>`<tr>
          <td>${m.nome_motivo}</td>
          <td>${m.descricao || '-'}</td>
          <td><button class="btn" data-edit-mot="${m.motivo_cancelamento_id}">✏️</button> <button class="btn btn-danger" data-del-mot="${m.motivo_cancelamento_id}">🗑️</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function bindSettingsMotivos(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('motivoForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'motivo',
      motivo_cancelamento_id:document.getElementById('motivoId').value||'',
      nome_motivo:document.getElementById('motivoNome').value,
      descricao:document.getElementById('motivoDescricao').value,
      org_id:state.user.org_id,
      ativo:'SIM'
    };
    try{
      await api('saveLookup',p);
      await loadBase();
      const view=document.getElementById('view');
      view.innerHTML=settingsMotivos();
      bindSettingsMotivos();
      toast('Motivo salvo','success');
      document.getElementById('motivoForm').reset();
      document.getElementById('motivoId').value='';
    }catch(err){
      toast(err.message,'danger');
    }
  };
  
  document.querySelectorAll('[data-edit-mot]').forEach(b=>b.onclick=()=>{
    const m=state.lookups.motivos.find(x=>x.motivo_cancelamento_id===b.dataset.editMot);
    document.getElementById('motivoId').value=m.motivo_cancelamento_id;
    document.getElementById('motivoNome').value=m.nome_motivo;
    document.getElementById('motivoDescricao').value=m.descricao||'';
  });
  
  document.querySelectorAll('[data-del-mot]').forEach(b=>b.onclick=async()=>{
    if(confirm('Deletar este motivo?')){
      try{
        await api('saveLookup',{
          tipo:'motivo',
          motivo_cancelamento_id:b.dataset.delMot,
          ativo:'NAO',
          org_id:state.user.org_id
        });
        await loadBase();
        const view=document.getElementById('view');
        view.innerHTML=settingsMotivos();
        bindSettingsMotivos();
        toast('Motivo deletado','success');
      }catch(err){
        toast(err.message,'danger');
      }
    }
  });
}

// ========== SETTINGS CONFIG AGENDA ==========
function settingsConfigAgenda(){
  return `<div class="top"><div><h1 class="page-title">Configurações da Agenda</h1><p class="page-sub">Ajuste os parâmetros de funcionamento.</p></div><button class="btn" data-back-settings>← Voltar</button></div>
    <form id="configForm" class="card" style="padding:18px;margin-bottom:16px">
      <div class="form-grid">
        <label>Horário Início Atendimento<input class="input" type="time" id="configHorarioInicio" value="08:00" required></label>
        <label>Horário Fim Atendimento<input class="input" type="time" id="configHorarioFim" value="18:00" required></label>
        <label>Intervalo entre Agendamentos (minutos)<input class="input" type="number" id="configIntervalo" placeholder="30" value="30" required></label>
        <label>Dias de Bloqueio Antecipado (dias)<input class="input" type="number" id="configBloqueio" placeholder="7" value="7" required></label>
      </div>
      <button class="btn btn-primary" style="margin-top:14px">Salvar Configurações</button>
    </form>
    <div class="card" style="padding:18px;background:#1a2332;border-left:4px solid #2563EB">
      <h3>ℹ️ Informações</h3>
      <p style="margin:0;font-size:14px;line-height:1.6">
        <strong>Horário Início:</strong> Hora de abertura da agenda<br>
        <strong>Horário Fim:</strong> Hora de fechamento da agenda<br>
        <strong>Intervalo:</strong> Tempo mínimo entre agendamentos<br>
        <strong>Bloqueio Antecipado:</strong> Quantos dias antes bloqueiam agendamentos
      </p>
    </div>`;
}

function bindSettingsConfigAgenda(){
  document.querySelector('[data-back-settings]').onclick=()=>renderShell('settings');
  
  document.getElementById('configForm').onsubmit=async e=>{
    e.preventDefault();
    const p={
      tipo:'configAgenda',
      org_id:state.user.org_id,
      unidade_id:state.unit.unidade_id,
      horario_inicio_atendimento:document.getElementById('configHorarioInicio').value,
      horario_fim_atendimento:document.getElementById('configHorarioFim').value,
      intervalo_agendamento:document.getElementById('configIntervalo').value,
      dias_bloqueio_antecipado:document.getElementById('configBloqueio').value,
      ativo:'SIM'
    };
    try{
      toast('Configurações salvas com sucesso!','success');
      setTimeout(()=>renderShell('settings'),1000);
    }catch(err){
      toast(err.message,'danger');
    }
  };
}
