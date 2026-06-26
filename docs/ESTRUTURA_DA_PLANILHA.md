# Estrutura da base de dados

Todas as abas principais usam `org_id` para isolar empresas. As abas operacionais também usam `unidade_id` para isolar unidades.

## Abas criadas

- Organizations
- Unidades
- Users
- UsuariosUnidades
- PermissoesUsuarios
- Agendamentos
- Hospitais
- Medicos
- Convenios
- Procedimentos
- StatusAgendamento
- MotivosCancelamento
- DatasBloqueadas
- ConfiguracoesAgenda
- HistoricoAgendamentos
- LogsAuditoria
- Notificacoes
- Dashboard

## Regra principal

Nunca buscar dados apenas pelo nome. Sempre buscar por ID.

Exemplo:

- Hospital: `hospital_id`
- Médico: `medico_id`
- Convênio: `convenio_id`
- Status: `status_id`
- Unidade: `unidade_id`
- Empresa: `org_id`
