# TASK-008 — Source registry

## Objetivo

Transformar o catálogo decodificado em descritores estáveis de fontes, preservando identidade, idioma, versão, proveniência, compatibilidade e estado habilitado.

## Implementado

- registry em memória source-first;
- IDs estáveis por pacote Project Nox + ID externo;
- normalização de aliases `pt`, `pt-BR`, `pt_BR`, `en-US` e `eng`;
- filtragem e ordenação por idioma preferido;
- estado habilitado/desabilitado e consulta por ID;
- validação através dos contratos Taiju;
- testes determinísticos.

## Fora de escopo

Execução de extensões, persistência, endpoints HTTP e determinação automática de compatibilidade do runtime.
