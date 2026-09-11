# TASK-007 — Project Nox index decoder

## Objetivo

Decodificar o catálogo `index.pb` (protobuf, publicado comprimido com gzip) em um modelo interno do pacote de fontes.

## Implementado

- descompressão gzip quando presente;
- leitura de varints e mensagens protobuf aninhadas;
- metadados da loja, extensões, recursos e fontes;
- preservação de IDs como string e `versionCode` como bigint;
- validação de campos obrigatórios e erro específico;
- testes determinísticos sem rede.

## Fora de escopo

Execução dos APK/JARs, decoder de código das extensões, registry e endpoints HTTP.
