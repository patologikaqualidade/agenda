import { API_URL } from '../config/apiConfig.js';

export async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes('COLE_AQUI')) {
    return mock(action, payload);
  }
  const body = new URLSearchParams({ action, ...payload });
  const res = await fetch(API_URL, { method:'POST', body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ========== SESSÃO ==========
export function saveSession(user, units) {
  localStorage.setItem('session', JSON.stringify({ user, units, time: Date.now() }));
}

export function getSession() {
  const session = localStorage.getItem('session');
  return session ? JSON.parse(session) : null;
}

export function saveUnit(unit) {
  localStorage.setItem('currentUnit', JSON.stringify(unit));
}

export function getUnit() {
  const unit = localStorage.getItem('currentUnit');
  return unit ? JSON.parse(unit) : null;
}

export function clearSession() {
  localStorage.removeItem('session');
  localStorage.removeItem('currentUnit');
}

// ========== MOCK ==========
const db = {
  user:{user_id:'USR001',org_id:'ORG001',nome:'João Silva',email:'admin@patologika.com.br',role:'admin'},
  units:[{unidade_id:'UNI001',org_id:'ORG001',nome_unidade:'Matriz - Centro',endereco:'Av. Principal, 123',online:12},{unidade_id:'UNI002',org_id:'ORG001',nome_unidade:'Unidade Hospital Primavera',endereco:'R. Primavera, 456',online:8}],
  hospitais:[{hospital_id:'HOSP001',nome_hospital:'Hospital Primavera'},{hospital_id:'HOSP002',nome_hospital:'Hospital São Lucas'}],
  medicos:[{medico_id:'MED001',nome_medico:'Dr. João Silva'},{medico_id:'MED002',nome_medico:'Dra. Ana Costa'}],
  convenios:[{convenio_id:'CONV001',nome_convenio:'Particular'},{convenio_id:'CONV002',nome_convenio:'Bradesco Saúde'}],
  procedimentos:[{procedimento_id:'PROC001',nome_procedimento:'Congelação'},{procedimento_id:'PROC002',nome_procedimento:'Biópsia'}],
  status:[{status_id:'ST001',nome_status:'Agendado',cor:'#2563EB'},{status_id:'ST002',nome_status:'Confirmado',cor:'#16A34A'},{status_id:'ST003',nome_status:'Realizado',cor:'#22C55E'},{status_id:'ST004',nome_status:'Cancelado',cor:'#DC2626'},{status_id:'ST005',nome_status:'Reagendado',cor:'#F59E0B'},{status_id:'ST006',nome_status:'Pendente',cor:'#EAB308'}],
  agendamentos:[
    {agendamento_id:'AGE001',data_agendamento:'2026-09-23',horario:'08:30',paciente:'Maria da Silva Santos',hospital_id:'HOSP001',medico_id:'MED001',convenio_id:'CONV002',procedimento_id:'PROC001',status_id:'ST001',contato:'(79) 99999-9999',pagamento:'Particular',reagendamento:'NAO',observacao:''},
    {agendamento_id:'AGE002',data_agendamento:'2026-09-23',horario:'10:30',paciente:'José Oliveira',hospital_id:'HOSP002',medico_id:'MED002',convenio_id:'CONV001',procedimento_id:'PROC002',status_id:'ST002',contato:'',pagamento:'Convênio',reagendamento:'NAO',observacao:''}
  ],
  bloqueios:[{bloqueio_id:'BLOQ001',data_inicio:'2026-12-25',data_fim:'2026-12-25',horario_inicio:'00:00',horario_fim:'23:59',motivo:'Feriado - Natal',tipo_bloqueio:'Dia inteiro'}]
};

async function mock(action, payload){
  await new Promise(r=>setTimeout(r,120));
  if(action==='login') return { user:db.user, units:db.units };
  if(action==='getUnits') return { units:db.units };
  if(action==='getLookups') return { hospitais:db.hospitais, medicos:db.medicos, convenios:db.convenios, procedimentos:db.procedimentos, status:db.status };
  if(action==='getAppointments') return { agendamentos:db.agendamentos };
  if(action==='saveAppointment') { const a={...payload, agendamento_id: payload.agendamento_id || `AGE${Date.now()}`}; db.agendamentos = db.agendamentos.filter(x=>x.agendamento_id!==a.agendamento_id).concat(a); return {ok:true, agendamento:a}; }
  if(action==='deleteAppointment') { db.agendamentos = db.agendamentos.filter(x=>x.agendamento_id!==payload.agendamento_id); return {ok:true}; }
  if(action==='getBlockedDates') return { bloqueios:db.bloqueios };
  if(action==='saveBlockedDate') { db.bloqueios.push({...payload,bloqueio_id:`BLOQ${Date.now()}`}); return {ok:true}; }
  return { ok:true };
}
