# TASK-013 — Sources API

## Resultado

`GET /api/sources` expõe apenas descritores Taiju de fontes carregadas pelo
sidecar Suwayomi. A rota aceita `language` repetido para filtrar idiomas e
retorna `source_runtime_unavailable` quando `SUWAYOMI_URL` não está
configurada ou o host não responde.

Os IDs combinam o pacote de extensão com o identificador da fonte do runtime,
preservando a proveniência. A rota não baixa nem habilita extensões; isso fica
fora do transporte HTTP e permanece responsabilidade do operador do sidecar.

## Validação

- teste da rota API com diretório de fontes injetado;
- teste determinístico do diretório Suwayomi e normalização de `pt-BR`;
- typecheck e build da API.
