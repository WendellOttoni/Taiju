# TASK-017 — Search UI

## Resultado

A página inicial carrega as fontes `pt-BR` e `en` que estão disponíveis no
runtime e exige que a pessoa escolha uma delas antes de pesquisar. Resultados,
detalhes, capítulos e o leitor carregam `sourceId` e `externalId` nos links,
sem suposição de UUID ou de MangaDex.

Se o sidecar não estiver configurado, a interface mostra o erro retornado por
`/api/sources` em vez de mudar silenciosamente para uma fonte diferente.

## Validação

`bun --filter @taiju/web typecheck` e `bun --filter @taiju/web build`.
