# Atualização pendente na VPS

**Status: pendente.** O código da correção de playback de anime já está em
`origin/main` (commits `91d615c` e `f4d6409`), e o frontend da Vercel já foi
atualizado. A API da VPS ainda precisa receber essa versão para ativar as
sessões de reprodução independentes.

Quando estiver em casa, acesse a VPS por SSH e execute **na VPS**:

```bash
cd ~/Taiju
git pull --ff-only origin main
docker compose --env-file deployment/.env.production -f compose.production.yml up -d --build
docker compose --env-file deployment/.env.production -f compose.production.yml ps
```

O `git pull` baixa o código. O `docker compose` recompila e atualiza os serviços;
o último comando mostra se os containers estão ativos. Esta correção não exige
migração de banco. O procedimento completo está em [DEPLOYMENT.md](DEPLOYMENT.md).

Depois de executar, atualize o status deste lembrete para **concluído**.
