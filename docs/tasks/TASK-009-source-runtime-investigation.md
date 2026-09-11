# TASK-009 — Investigação do runtime das extensões

## Evidências coletadas

Foi inspecionada uma extensão pública do catálogo Project Nox (Akuma 1.4.10), sem incorporá-la ao repositório:

- o artefato de execução é um JAR com bytecode JVM/Kotlin e `AndroidManifest.xml`;
- o manifesto declara `uses-feature tachiyomi.extension` e a classe de entrada `keiyoushi.source.Generated`;
- o JAR contém classes de suporte `keiyoushi.source` e assinaturas `META-INF/CERT.SF`/`CERT.RSA`;
- o APK é o artefato Android instalável, enquanto o JAR é o pacote de classes usado pelo host;
- a API esperada é a compatibilidade Mihon/TachiyomiX (fontes HTTP, modelos de manga/capítulos/páginas), não uma API JavaScript;
- a documentação pública do TachiyomiX lista Kotlin, coroutines, kotlinx-serialization, OkHttp, Jsoup e Injekt como dependências fornecidas pelo host.

## Decisão técnica

Não executar extensões diretamente no Bun. Bun não fornece uma JVM nem as APIs Android/host esperadas pelo bytecode. A fronteira escolhida é um worker JVM separado, iniciado sob demanda pelo pacote `packages/sources`, com:

1. classloader por extensão e dependências de versão compatíveis;
2. processo separado (sem acesso direto ao processo HTTP do Taiju);
3. protocolo IPC explícito para search, details, chapters e pages;
4. timeouts, limites de memória e encerramento do worker;
5. adaptação dos modelos Mihon para contratos Taiju, sem vazar DTOs externos;
6. compatibilidade declarada por versão de `extensionLib`, não presumida.

O APK/JAR deve ser baixado apenas de URLs do catálogo, armazenado fora do código-fonte e verificado antes da execução. O `signingKey` do catálogo deve ser usado como âncora de confiança; a assinatura X.509 de APK/JAR e os hashes do artefato precisam ser comparados antes do carregamento. Falhas de assinatura tornam a fonte incompatível.

## Plano de prova de conceito para TASK-010/011

- criar um worker JVM mínimo com uma versão fixa da API TachiyomiX;
- carregar uma extensão inglesa real em classloader isolado;
- instanciar a classe declarada no manifesto e mapear uma operação de busca;
- testar timeout, cancelamento, erro de rede e encerramento do worker;
- validar assinatura/hash antes de carregar;
- somente depois expor a implementação via `ReadingSource`.

## Limitações e riscos

Não há JDK nem Android runtime instalados neste ambiente, então a execução da extensão não foi tentada. A compatibilidade real depende da versão da extensão e das APIs host; isso será validado por fixture na TASK-011. Não foi introduzido código de runtime nesta tarefa.

## Referências

- [TachiyomiX](https://github.com/mihonapp/tachiyomix) — stubs, manifesto e dependências esperadas.
- [Mihon extensions](https://github.com/keiyoushi/extensions) — estrutura de fontes e artefatos publicados.
- [Mihon extension manager](https://github.com/mihonapp/mihon/blob/main/app/src/main/java/eu/kanade/tachiyomi/extension/ExtensionManager.kt) — carregamento/instalação no host Android.
