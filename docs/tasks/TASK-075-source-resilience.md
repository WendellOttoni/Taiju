# TASK-075 — Source resilience

## Resultado

O cliente Suwayomi já limita cada requisição por timeout. Agora a API também
traduz os erros tipados do runtime para `503 source_runtime_unavailable`, sem
vazar mensagens GraphQL ou diagnósticos do host para o navegador. O log
estruturado preserva o nome e a mensagem do erro para diagnóstico local.

Na busca agregada, falhas individuais são isoladas: fontes restantes continuam
produzindo resultados e os IDs das fontes indisponíveis são retornados em
`failedSourceIds`.

## Validação

O workspace completo passou em `bun run typecheck`, `bun run test` e
`bun run build`.
