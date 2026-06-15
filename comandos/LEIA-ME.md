# Comandos clicáveis — Maestro v3

Clique 2x em cada `.command` (na ordem). Cada um pede confirmação antes de qualquer ação que altere/publique algo.

| Ordem | Arquivo | O que faz | Altera algo? |
|---|---|---|---|
| 1 | `1-validar-maestro.command` | Roda testes da API + typecheck/build do Web | Não (só lê) |
| 2 | `2-merge-maestro-na-main.command` | Mescla a branch na `main` **local** e valida (sem push) | Sim (git local) |
| 3 | `3-aplicar-migracao-db.command` | `prisma migrate deploy` (cria `flow_node_stats`) | Sim (banco) |
| 4 | `4-deploy-api-fly.command` | Deploy da API no Fly (migrações rodam no release) | Sim (publica) |
| 5 | `5-deploy-web-vercel.command` | Deploy do Web no Vercel (produção) | Sim (publica) |

**Fluxo típico para publicar o Pacote 1:** 1 → 2 → 4 → 5. (O passo 3 é opcional/manual; o deploy da API já aplica as migrações.)

## Validação manual (WhatsApp sandbox) — não dá para automatizar
Depois do deploy, rode os roteiros de smoke (cada um lista os passos):
- `docs/maestro/smoke-1a.md` — fluxos ricos (ask, botões, condições, horário, mídia)
- `docs/maestro/smoke-1b.md` — geração rica por IA
- `docs/maestro/smoke-1b-analytics.md` — funil por nó (toggle "Métricas")
- `docs/maestro/smoke-1c.md` — subfluxos call/return

## Observações
- A branch `maestro-v3-spec1a-motor` tem **56 commits só do Maestro v3** — limpos.
- Arquivos não-commitados (`vozHumanaFilter.ts`, `agentOrchestrator.ts`, `coreAgentRules.ts`) são da skill **voz-humana** (trabalho paralelo) e **não entram** no merge da branch.
- A única falha de teste esperada é `izaTurnRouter` (pré-existente, não relacionada).
