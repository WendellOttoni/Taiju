# TASK-015 — Multi-source search

## Resultado

`source=all` pesquisa todas as fontes carregadas de `pt-BR` e `en` com no
máximo três operações simultâneas. O resultado combina somente respostas
válidas e informa `failedSourceIds` para que o cliente apresente falhas
parciais sem perder os títulos das fontes restantes.

A interface oferece a opção “Todas as fontes disponíveis” e grava a última
fonte escolhida em `localStorage`. Não requer autenticação e não grava dados
de leitura no servidor.
