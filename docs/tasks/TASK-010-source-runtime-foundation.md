# TASK-010 — Source runtime foundation

## Objetivo

Implementar a fronteira segura entre Taiju e o worker JVM definido na investigação da TASK-009.

## Implementado

- protocolo IPC JSON delimitado por newline;
- operações explícitas: `search`, `details`, `chapters` e `pages`;
- validação de IDs, estado e erros da resposta;
- cliente com processo lazy, timeout, cancelamento por encerramento e códigos de erro remotos;
- processo injetável para testes, sem depender de JVM no CI.

## Decisão de escopo

O launcher JVM concreto, classloader da extensão e adaptação Mihon serão implementados e validados na TASK-011 com um artefato real. Esta tarefa não afirma que uma extensão já pode ser executada.
