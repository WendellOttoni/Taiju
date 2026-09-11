# TASK-011 — Primeira validação de extensão real

## Resultado

Foi baixada temporariamente uma extensão inglesa real do catálogo Project Nox (Akuma 1.4.10) e tentado o carregamento da classe declarada no manifesto (`keiyoushi.source.Generated`).

O JAR foi inspecionado e a classe de entrada foi confirmada com `javap`. A execução com Java 21 falhou antes da instanciação por ausência da API do host:

```text
NoClassDefFoundError: eu/kanade/tachiyomi/source/SourceFactory
```

O JAR da extensão não inclui essa API; ela é fornecida pelo host Mihon/TachiyomiX. O Java 8 instalado também não é compatível com o artefato, que usa class file version 55 (Java 11+).

Também foi verificada a coordenada JitPack indicada na documentação do TachiyomiX (`com.github.mihonapp:tachiyomix:1.6`). As variantes JAR/AAR consultadas retornaram HTTP 404. Mesmo quando disponível, TachiyomiX é documentado como biblioteca de stubs `compileOnly`, não como implementação completa do host.

## Conclusão

Não foi possível validar search, details, chapters ou pages. A extensão real ainda não é compatível com o runtime Taiju atual, e deve permanecer desabilitada no registry. Não há evidência suficiente para afirmar que uma fonte Project Nox já pode ser executada.

## Alternativa de host selecionada

A investigação identificou o Suwayomi-Server como host compatível existente: ele executa extensões Mihon/Tachiyomi em JVM desktop usando uma camada de compatibilidade Android e expõe APIs GraphQL/REST. A integração recomendada é tratá-lo como sidecar opcional, iniciado/configurado fora do processo Taiju, com um adaptador HTTP que converta respostas para contratos Taiju. O Suwayomi não será exposto diretamente ao frontend.

## Adaptador implementado

Foi criado um cliente GraphQL isolado para o sidecar Suwayomi, com base URL configurável, timeout, cancelamento, tradução de status HTTP/GraphQL e validação de JSON. A release validada direciona o REST legado para a WebUI; por isso o adaptador usa `/api/graphql`. Ele permanece interno ao pacote `packages/sources`; nenhum DTO Suwayomi é exposto ao frontend.

## Validação do sidecar

- release oficial `v2.3.2243` baixada temporariamente e SHA-256 conferido contra o checksum publicado;
- sidecar iniciado com Java 21 e GraphQL respondeu;
- catálogo Project Nox adicionado e enumerado pelo host: 1.412 extensões;
- extensão MangaDex 1.6.0 instalada como fixture não privilegiada;
- fontes MangaDex `en` e `pt-BR` carregadas pelo sidecar.

O processo temporário encerrou antes da sequência de busca/detalhes/capítulos/páginas; essas operações permanecem pendentes de uma execução persistente do sidecar.

## Próximo bloqueio técnico

Para concluir a validação é necessário iniciar uma versão fixa do Suwayomi-Server, instalar a extensão no sidecar, validar assinatura/hash e implementar o mapeamento de modelos para contratos Taiju.

Referência: [Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server).

## Fora de escopo nesta tentativa

Nenhum artefato externo foi adicionado ao repositório e nenhum endpoint foi conectado ao runtime.
