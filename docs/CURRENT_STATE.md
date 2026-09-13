# Current State

Last completed setup step: TASK-011 — First extension runtime adapter.

## Implemented

- project vision defined;
- stack selected;
- monorepo boundaries defined;
- agent-development rules documented;
- initial architecture documented;
- roadmap created;
- Bun workspace bootstrap;
- Hono API application with a tested `GET /health` endpoint;
- React/Vite web starter branded as Taiju;
- Tailwind CSS and shadcn/ui project configuration for the web app;
- shared contracts, providers and database package boundaries;
- shared TypeScript compiler baseline.
- Biome formatting, linting and import-organization baseline.
- API environment validation, structured request logging and consistent JSON errors.
- Isolated MangaDex HTTP client with timeout, cancellation and rate-limit error translation.
- Shared Zod contracts for normalized manga search requests, summaries and paginated responses.
- Manga search API endpoint backed by the isolated MangaDex provider adapter.
- Responsive search UI consuming only the Taiju API contract.
- Normalized MangaDex details endpoint for title metadata, contributors, tags, languages and cover.
- Public manga details page linked from search results and backed by Taiju API contracts.
- Normalized MangaDex chapter feed with language filters, pagination and scanlation groups.
- Chapter feed tolerates MangaDex chapters without `publishAt`, falling back to `createdAt`, and normalizes timezone-offset timestamps to UTC.
- Chapter API endpoint with validated language and pagination parameters.
- Chapter list rendered on manga detail pages.
- MangaDex@Home chapter-page resolver isolated in the provider package.
- Unavailable MangaDex@Home chapters return a clear `content_unavailable` response, with structured API error logs.
- Reader route and normalized chapter-page endpoint.
- Vertical reader with lazy-loaded pages, per-page failure feedback, chapter navigation and local progress capture.
- Optional page-by-page reader with keyboard/button navigation and adjacent-page preloading.
- Reader settings persisted locally for mode, reading direction, image fit and UI visibility.
- PostgreSQL/Drizzle package foundation with validated connection URLs, bounded client pool defaults and migration scripts.
- Taiju-owned `users` and `profiles` tables with a generated migration and normalized unique email constraint.
- E-mail/password authentication with Argon2id hashes, signed seven-day JWTs and authenticated-user endpoint.
- Authenticated library endpoints and persisted MangaDex favorites with user-scoped uniqueness.
- User-scoped reading history records for manga, chapter, page and last update, with an indexed upsert model.
- Authenticated progress-sync and reading-history endpoints for resuming on another session or device.
- Source-neutral contracts for reading capabilities, language, provenance and external source identity; the initial rollout prioritizes `pt-BR` and `en`.
- Isolated Project Nox `index.pb` catalog client with timeout, cancellation, size bounds and deterministic fetch injection.
- Project Nox protobuf/gzip index decoder with normalized extension/source catalog models and deterministic fixtures.
- In-memory source registry with stable IDs, language normalization/prioritization, provenance and enablement state.
- Runtime investigation completed: Project Nox extensions are JVM/Android artifacts; direct Bun execution was rejected and an isolated JVM worker was selected for the proof of concept.
- JVM runtime IPC boundary implemented with explicit operations, response validation, timeout and process lifecycle isolation.
- Cliente GraphQL Suwayomi com timeout, cancelamento e tradução de falhas.
- Adaptador de leitura Suwayomi para busca, detalhes, capítulos e páginas, convertido para contratos Taiju com referências explícitas de fonte.
- `GET /api/sources` lista somente fontes efetivamente carregadas no sidecar Suwayomi; aceita `language` repetido como filtro e não expõe DTOs do host.
- As rotas de busca, detalhes, capítulos e páginas aceitam identificadores de fonte do runtime e delegam à interface normalizada; o caminho MangaDex permanece como compatibilidade temporária.
- Interface de descoberta, detalhes, capítulos e leitor migrada para referências de fonte; a busca exige escolha explícita de uma fonte `pt-BR` ou `en` disponível.
- Busca em todas as fontes disponíveis com concorrência limitada, resultados parciais e aviso de fontes que falharam; a fonte escolhida é persistida localmente, sem conta.
- Falhas HTTP, GraphQL e timeout do Suwayomi são traduzidas para `503 source_runtime_unavailable`; o log da API mantém o diagnóstico do host sem expô-lo ao navegador.
- Entradas internas do runtime com idioma fora do contrato Taiju (por exemplo, `Local source`) são ignoradas individualmente e não impedem a enumeração das fontes instaladas.
- Identificadores numéricos retornados por fontes Suwayomi, como Comikey, são normalizados para referências externas textuais do Taiju.
- Caminhos relativos de capa retornados pelo runtime, como os da Comikey, são resolvidos contra a URL configurada do Suwayomi antes de chegar ao frontend.
- Respostas GraphQL parciais do Suwayomi são aceitas quando incluem dados válidos, permitindo exibir detalhes mesmo quando uma fonte ainda não retorna capítulos.
- Quando uma extensão retorna um capítulo, mas não consegue resolver suas páginas, a API responde `404 content_unavailable` sem expor a exceção interna do Suwayomi.
- URLs relativas de páginas devolvidas pelo Suwayomi são resolvidas contra a URL do sidecar antes de serem validadas e enviadas ao leitor.

## Not implemented yet

- Escolha de fallback e fontes equivalentes por título.
- Preferências de idioma e migração do histórico/biblioteca para IDs externos não UUID quando a conta for reintroduzida.
- Validação persistente ao vivo de busca, detalhes, capítulos e páginas em uma fonte de fixture.
- Scanner catalog-wide e estratégia de atualização/cache do catálogo ainda não foram implementados.

O scanner catalog-wide deterministico foi implementado em `packages/sources`: ele compara o catalogo Project Nox com as fontes carregadas no Suwayomi e classifica cada fonte como compativel, ausente no runtime ou com versao divergente.

A persistencia dos relatorios e a validacao ao vivo das operacoes de busca, detalhes, capitulos e paginas ainda permanecem pendentes.

Validador de capacidades implementado em `packages/sources`: executa probes isoladas e sequenciais de busca, detalhes, capitulos e paginas, com timeout, IDs descobertos e estados passed/failed/skipped.

Rota `GET /api/sources/validate?q=...` integrada para validar uma fonte especifica ou todas as fontes `pt-BR`/`en` com concorrencia limitada e falhas parciais.

Persistencia opcional de validacoes adicionada ao PostgreSQL/Drizzle (`source_runtime_validations`), com repositorio e rota `GET /api/sources/validations` para consultar o historico.

Rota `GET /api/manga/:source/:id/alternatives` adicionada para procurar o mesmo titulo em outras fontes do mesmo idioma, com comparacao conservadora de titulo e resultados com proveniencia explicita.

Preferencias persistentes de fontes e idiomas adicionadas ao contrato, banco e API autenticada (`GET/PUT /api/source-preferences`), com defaults `pt-BR` e `en`.

Store de catalogo Project Nox implementado com TTL, deduplicacao de refresh concorrente e fallback para o ultimo catalogo valido marcado como stale.

Busca web agora permite escolher idioma preferido (`pt-BR` ou `en`), persiste a escolha localmente e filtra/recarrega as fontes disponiveis conforme a preferencia.

Quando autenticado, `GET /api/sources` aplica as preferencias persistentes do usuario para ordenar idiomas e limitar fontes habilitadas.

Frontend agora oferece entrada/cadastro basico, guarda o JWT localmente e envia a sessao ao carregar fontes, habilitando o uso pratico das preferencias por conta.

Pagina de detalhes agora exibe fontes alternativas equivalentes e permite abrir o titulo diretamente na fonte escolhida.

- Busca global consolida resultados com a mesma evidência de título normalizado e tag compartilhada em um único cartão, preservando os botões explícitos para cada fonte disponível.
- O cliente Suwayomi deduplica requisições simultâneas de detalhes/capítulos para o mesmo mangá por 30 segundos e elevou o timeout padrão para 30 segundos; a consulta de fontes alternativas na página de detalhes passou a ser opcional, evitando carga concorrente desnecessária.
- Favoritos, histórico e progresso autenticados agora aceitam referências neutras de fonte (`sourceId` + `externalId`), inclusive identificadores não UUID devolvidos pelo Suwayomi.
- A web permite favoritar na página de detalhes, sincroniza a última página lida e expõe uma biblioteca com favoritos e links para retomar a leitura.
- Migration `0006_source_neutral_persistence` aplicada ao PostgreSQL local para converter os IDs persistidos de biblioteca e histórico em texto.
- A biblioteca resolve capas e títulos pelas referências de fonte salvas; o leitor vertical registra somente a página efetivamente visível e retorna a ela ao retomar a leitura.
- A página inicial expõe “Mais lidos” e “Lançamentos recentes” por meio das operações normalizadas `POPULAR` e `LATEST` do Suwayomi, com origem explícita e cache de cinco minutos por fonte/operação.
- Uma indisponibilidade transitória ao resolver páginas de capítulo recebe uma segunda tentativa antes de ser exposta como conteúdo indisponível.

- O Taiju converte a classificação `SAFE`/`MIXED`/`NSFW` do Suwayomi para um
  contrato próprio e trata fontes `MIXED` e `NSFW` como restritas.
- A variável privada `ADULT_CONTENT_EMAILS` controla quais contas autenticadas
  podem listar e acessar fontes restritas. Demais usuários recebem `404` nas
  rotas da fonte, e favoritos/histórico restritos também são filtrados.
- A web envia a sessão autenticada nas operações de fontes, busca, descoberta,
  detalhes, capítulos e leitor, permitindo que somente a conta autorizada use a
  fonte restrita.
- As vitrines gerais de mais acessados e atualizações consultam sempre todas as
  fontes seguras disponíveis, independentemente da fonte selecionada na busca,
  e intercalam os resultados por fonte antes de exibir os primeiros títulos.
- Contas autorizadas recebem a navegação para `/adult`, que lista as fontes
  restritas disponíveis e apresenta um feed vertical de atualizações. O feed
  carrega páginas adicionais automaticamente perto do fim da rolagem, deduplica
  títulos já exibidos e agrega qualquer nova fonte `MIXED` ou `NSFW` instalada.
  Os badges permitem alternar entre todas as fontes e o feed paginado de uma
  fonte restrita específica. A rota permanece sem conteúdo para as demais
  sessões porque a seleção adulta também é aplicada na API.
- A área `/adult` também oferece busca agregada somente nas fontes restritas,
  respeitando o badge de fonte selecionado.
- A biblioteca permite remover uma entrada de histórico e seu progresso salvo
  sem remover o favorito correspondente.

## Current phase

Source-engine migration started; existing MangaDex flow remains the legacy adapter until subsequent source tasks.

The web frontend is configured in the Vercel project `taiju` with `apps/web` as its root, Vite as the framework, and `bun run build` as the production build command. The first production deployment is live at `https://taiju-one.vercel.app`; API, PostgreSQL, and Suwayomi still require the Docker/VPS deployment described in [`DEPLOYMENT.md`](DEPLOYMENT.md).

The Vercel production frontend now rewrites `/api/*` to the temporary HTTPS VPS endpoint `54-232-197-67.nip.io`; the rewrite is intended for testing until a permanent Taiju domain is registered.

## Next task

Próxima prioridade: validação ao vivo persistente do sidecar e scanner catalog-wide.

See `docs/DEVELOPMENT_PLAN.md`.

## Known issues

O playback de anime passa pelo backend Taiju, reutilizando somente a URL e os
cabeçalhos devolvidos pelo Miwayomi para o episódio e aceitando `Range` para
permitir seek em hosts que exigem `referer` e `user-agent`.

As URLs de imagens já emitidas pelo Suwayomi podem apontar para o proxy público
de assets ou para o host original da extensão. O controle implementado protege a
descoberta e todas as operações Taiju por fonte, mas não revoga uma URL de imagem
que já tenha sido obtida por uma conta autorizada.

## Consolidated manga status

The manga source engine, runtime validation, catalog resilience, source fallback, account preferences, and web authentication flows are implemented and covered by automated checks. Remaining operational work requires a live PostgreSQL migration and a configured Suwayomi instance; anime features remain intentionally out of scope.

Authentication is enabled only when both `DATABASE_URL` and `AUTH_JWT_SECRET` are configured; migrations require a running PostgreSQL instance and were not applied in this workspace.

Anime work is explicitly deferred and outside the current scope.

Para teste na mesma rede, o frontend possui o comando `bun run dev:web:lan`; o proxy Vite mantém as requisições `/api` no backend local.

Para habilitar fontes dinâmicas localmente, inicie o sidecar Suwayomi e defina
`SUWAYOMI_URL` (por exemplo, `http://127.0.0.1:4567`) antes de iniciar a API.
O procedimento completo de instalação local, extensões, rede e diagnóstico está
em [`LOCAL_SETUP.md`](LOCAL_SETUP.md).

O cadastro e login agora exibem mensagens especÃ­ficas de validaÃ§Ã£o, tratam
JSON malformado como erro de entrada e impedem envios duplicados. O formulÃ¡rio
de autenticaÃ§Ã£o foi adaptado para telas pequenas, com campos de largura total
no celular, autocomplete, alvos de toque maiores e orientaÃ§Ã£o sobre o tamanho
da senha. A sessÃ£o Ã© atualizada sem recarregar a pÃ¡gina inteira apÃ³s entrar ou
sair.

O primeiro fluxo de anime está implementado separadamente do leitor de mangás:
contratos Taiju para fontes, catálogo, detalhes, episódios, streams, faixas de
áudio/legenda, biblioteca e progresso; cliente isolado para o runtime Miwayomi;
rotas API sob `/api/anime`; interface web sob `/anime`; e persistência própria
em PostgreSQL. O sidecar Miwayomi é opcional localmente e privado no deploy,
portanto a ausência dele não impede a operação de mangás.

No deploy de produção, o Miwayomi usa o sidecar interno FlareSolverr para
resolver desafios Cloudflare das fontes que o permitam. O serviço não possui
porta publicada e não participa do caminho de mangás.

O Miwayomi de produção usa `-Xverify:none` para permitir o carregamento de
extensões Aniyomi que o conversor DEX→JVM entrega com stackmaps inválidos.
Esse ajuste foi validado com a extensão Hianimes: a fonte aparece, pesquisa e
lista episódios; a resolução de vídeos ainda depende do hoster da fonte.
