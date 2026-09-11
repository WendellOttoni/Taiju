# Execução local em Windows

Este guia reproduz a fatia atual de leitura do Taiju em outra máquina. Ela usa
três processos locais:

```text
Navegador -> Vite (5173) -> API Taiju (3000) -> Suwayomi (4567) -> fontes
```

O navegador fala somente com o Vite. O proxy do Vite encaminha `/api` para a
API, e apenas a API se comunica com o Suwayomi. Não exponha o Suwayomi
diretamente ao navegador do Taiju.

## O que é necessário

- Git;
- [Bun](https://bun.sh/) compatível com a versão declarada em `package.json`;
- Java Runtime Environment (JRE) **21 ou superior** para o Suwayomi;
- navegador moderno;
- acesso à internet para baixar dependências, o Suwayomi e extensões.

Confira o Java depois de instalá-lo:

```powershell
java -version
```

O comando deve indicar versão 21 ou superior. Não é necessário PostgreSQL para
testar busca, detalhes, capítulos e leitura sem conta. Banco e segredo de
autenticação só são necessários para os recursos persistentes ainda opcionais.

## 1. Obter o Taiju

No PowerShell:

```powershell
git clone https://github.com/WendellOttoni/Taiju.git C:\Repo\Taiju
cd C:\Repo\Taiju
bun install
```

Valide a instalação do workspace antes de prosseguir:

```powershell
bun run typecheck
bun run test
```

## 2. Instalar e iniciar o Suwayomi

O Taiju não executa APKs de extensões diretamente. O
[Suwayomi-Server](https://github.com/Suwayomi/Suwayomi-Server) é o sidecar JVM
que as instala e executa, enquanto o Taiju usa a API GraphQL dele.

1. Baixe o `.jar` da versão estável mais recente na página de
   [releases oficiais](https://github.com/Suwayomi/Suwayomi-Server/releases).
   Alternativamente, o pacote Windows `win64` já traz o runtime Java e um
   launcher.
2. Crie um diretório fora do repositório para o programa e seus dados, por
   exemplo `C:\Tools\Suwayomi`. Esse diretório poderá ser copiado ou incluído
   em backup quando a máquina for trocada.
3. Com o nome real do arquivo baixado, inicie o servidor:

```powershell
New-Item -ItemType Directory -Force C:\Tools\Suwayomi\data
java -Dsuwayomi.tachidesk.config.server.rootDir="C:\Tools\Suwayomi\data" -jar "C:\Tools\Suwayomi\Suwayomi-Server-vX.Y.Z-rXXXX.jar"
```

O argumento `rootDir` é intencional: ele mantém banco interno, configuração e
extensões do Suwayomi num local conhecido. Sem ele, o local padrão do Windows
fica sob `C:\Users\<usuário>\AppData\Local\Tachidesk`.

Espere o processo indicar que iniciou e abra:

```text
http://127.0.0.1:4567
```

Mantenha essa janela do PowerShell aberta enquanto estiver usando fontes
dinâmicas no Taiju.

## 3. Adicionar o catálogo de extensões e instalar fontes

No WebUI do Suwayomi:

1. Abra **Settings → Browse → Extension stores**.
2. Clique em **Add**.
3. Informe a URL abaixo e confirme:

   ```text
   https://raw.githubusercontent.com/Awerkori/extensoes/repo/index.min.json
   ```

4. Volte para **Browse → Extension**, aguarde a lista carregar e pesquise a
   fonte desejada.
5. Clique em **Install** somente nas fontes que pretende testar.

O catálogo pode aparecer como **Project Nox**. Ele contém extensões externas:
uma instalação bem-sucedida não garante que todo título, capítulo ou página
continuará disponível. As extensões e seus sites podem mudar, exigir configuração
na própria fonte ou falhar temporariamente.

Por padrão, mantenha desativada a opção de exibir fontes 18+. Essa preferência
apenas oculta entradas marcadas pelo catálogo; não é uma garantia de filtragem
de conteúdo dentro de cada fonte.

Para a fatia atual do Taiju, instale fontes que o Suwayomi informe como `pt-BR`
ou `en`. Após instalar ou atualizar uma extensão, recarregue o Taiju ou refaça a
busca para atualizar a lista de fontes.

## 4. Iniciar a API com o sidecar configurado

Abra outro PowerShell, mantenha o Suwayomi em execução e rode:

```powershell
cd C:\Repo\Taiju
$env:SUWAYOMI_URL="http://127.0.0.1:4567"
bun run dev:api
```

`SUWAYOMI_URL` vale somente para a janela atual do PowerShell. Repita a linha
da variável sempre que abrir outro terminal para iniciar a API. A mensagem
esperada é:

```text
Taiju API listening on http://localhost:3000
```

Confirme as duas extremidades em uma terceira janela:

```powershell
Invoke-RestMethod http://127.0.0.1:4567
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod "http://localhost:3000/api/sources?language=pt-BR&language=en"
```

O último comando deve listar apenas as extensões instaladas no Suwayomi. A
entrada interna `Local source`, se existir, é ignorada pelo Taiju por não ter
um código de idioma compatível.

## 5. Iniciar o frontend

Em outro PowerShell:

```powershell
cd C:\Repo\Taiju
bun run dev:web
```

Abra `http://localhost:5173`, escolha uma fonte e faça uma busca. Selecione a
fonte explicitamente: a aplicação não escolhe uma fonte nem mistura títulos de
fontes diferentes de forma silenciosa.

### Teste na rede local

Para abrir o frontend por outro dispositivo na mesma rede:

```powershell
cd C:\Repo\Taiju
bun run dev:web:lan
```

No outro dispositivo, abra `http://<IPv4-da-máquina>:5173`. Permita entrada na
porta 5173 somente em rede privada no firewall do Windows. Não é necessário
desativar o firewall nem expor as portas 3000 ou 4567: o proxy do Vite executa
na máquina que hospeda o Taiju e encaminha `/api` localmente.

## Diagnóstico

| Sintoma | Verificação e ação |
| --- | --- |
| `GET /api/sources` retorna 503 | Confirme que o Suwayomi está aberto em `127.0.0.1:4567` e que `SUWAYOMI_URL` foi definido **antes** de `bun run dev:api`. |
| Não há fontes no seletor | Instale ao menos uma extensão no WebUI do Suwayomi, confirme que ela aparece em Browse → Source e recarregue o Taiju. |
| A busca encontra título, mas a tela informa “Nenhum capítulo disponível” | A fonte selecionada não forneceu capítulos para aquele título. Teste outra fonte ou idioma; isso não é uma confirmação de que o Taiju perdeu a conexão. |
| O leitor recebe `404 content_unavailable` | A extensão retornou o capítulo, mas não forneceu páginas legíveis. Atualize a extensão, teste outro capítulo ou outra fonte. O erro interno do host não é enviado ao navegador. |
| O leitor recebe 503 | O sidecar, a extensão ou a fonte externa não respondeu dentro do prazo. Veja o terminal da API para o diagnóstico do host e confirme o Suwayomi. |
| Avisos do Bun sobre arquivos de `packages/` não observados | São avisos do modo `bun --watch`: alterações nesses pacotes podem exigir reiniciar `bun run dev:api`. Eles não impedem as requisições atuais. |

## Limites conhecidos da etapa atual

- A busca mostra o que a extensão retorna; ainda não há filtro automático de
  “somente títulos com capítulos”. Essa será uma consulta adicional por
  resultado e não deve ser confundida com validação de páginas.
- Mesmo com capítulos listados, páginas podem ficar indisponíveis por falha,
  atualização ou limitação da fonte. O leitor valida as páginas apenas quando
  um capítulo é aberto.
- Não copie `node_modules`, o diretório `.git` nem segredos entre máquinas.
  Para preservar o Suwayomi, copie somente o diretório de dados definido por
  `server.rootDir` depois de encerrar o processo.

## Referências externas

- [Suwayomi-Server: instalação e execução do jar](https://github.com/Suwayomi/Suwayomi-Server#running-the-jar-release-directly)
- [Releases oficiais do Suwayomi](https://github.com/Suwayomi/Suwayomi-Server/releases)
- [Diretório de dados do Suwayomi](https://github.com/Suwayomi/Suwayomi-Server/wiki/The-Data-Directory)
- [Catálogo Project Nox usado pelo Taiju](https://github.com/Awerkori/extensoes/raw/repo/index.pb)
