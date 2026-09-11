# TASK-014 — Single-source search API

## Resultado

`GET /api/manga/search?q=...&source=...` resolve a fonte selecionada e
executa a busca pela capacidade normalizada dela. As rotas existentes de
detalhes, capítulos e páginas também aceitam o identificador da fonte na
posição antes denominada `provider`.

Os identificadores externos não são reinterpretados como UUIDs quando vêm de
uma fonte dinâmica. Se o runtime não existir ou não responder, a API retorna
`source_runtime_unavailable`; se a fonte não estiver carregada, retorna 404.

## Compatibilidade

O fluxo `mangadex` legado foi mantido sem alteração temporariamente para que a
interface atual continue utilizável até a migração multi-source do cliente.
