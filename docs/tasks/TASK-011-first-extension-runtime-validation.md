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

## Próximo bloqueio técnico

Para concluir a validação é necessário fornecer uma implementação host própria ou uma distribuição JVM compatível, empacotar suas dependências (Kotlin, coroutines, OkHttp, Jsoup, serialização e Injekt), além de definir o adaptador de modelos e as políticas de sandbox. Isso deve ser resolvido antes de tentar as operações de leitura.

## Fora de escopo nesta tentativa

Nenhum artefato externo foi adicionado ao repositório e nenhum endpoint foi conectado ao runtime.
