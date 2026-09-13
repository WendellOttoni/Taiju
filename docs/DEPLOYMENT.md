# Deploy de produção com Docker

Este projeto deve ser publicado em um VPS Linux. O mesmo host executa o Taiju,
PostgreSQL e Suwayomi em containers separados. Somente o Caddy expõe portas
para a internet; a API, banco e Suwayomi permanecem privados na rede Docker.

## Antes de começar

Você precisa de:

- um VPS com Docker Engine e Docker Compose Plugin;
- um domínio apontado para o IP público do VPS por um registro DNS `A`;
- portas TCP `80` e `443` liberadas no firewall do VPS;
- acesso SSH administrativo ao VPS.

Para o primeiro uso, prefira pelo menos 2 vCPUs, 4 GB de RAM e 40 GB de disco.
Mais memória é recomendada se várias fontes ou extensões forem usadas ao mesmo
tempo.

O Caddy emite e renova automaticamente o certificado TLS quando
`TAIJU_DOMAIN` resolve para o IP do VPS e as portas `80` e `443` estão abertas.

## Preparar o servidor

No VPS, clone o repositório e crie o arquivo de variáveis privado:

```bash
git clone https://github.com/WendellOttoni/Taiju.git
cd Taiju
cp deployment/.env.production.example deployment/.env.production
chmod 600 deployment/.env.production
```

Edite `deployment/.env.production` e preencha:

- `TAIJU_DOMAIN` com o domínio real, sem `https://`;
- `POSTGRES_USER` com `taiju`;
- `POSTGRES_PASSWORD` com uma senha longa, única e alfanumérica;
- `AUTH_JWT_SECRET` com pelo menos 32 caracteres aleatórios;
- `ADULT_CONTENT_EMAILS` com os e-mails autorizados, separados por vírgula, ou
  vazio para não liberar fontes restritas a nenhuma conta.

Não versione esse arquivo. Para gerar valores seguros no VPS:

```bash
openssl rand -hex 32
```

## Subir ou atualizar

```bash
docker compose --env-file deployment/.env.production -f compose.production.yml up -d --build
docker compose --env-file deployment/.env.production -f compose.production.yml ps
```

O container da API executa as migrations do Taiju antes de iniciar. A primeira
subida cria bancos separados `taiju` e `suwayomi` no mesmo PostgreSQL, além dos
volumes persistentes de banco, Suwayomi e certificados TLS.

Para acompanhar erros sem expor dados ao navegador:

```bash
docker compose --env-file deployment/.env.production -f compose.production.yml logs -f api suwayomi web
```

## Configurar fontes do Suwayomi

Suwayomi não fica exposto publicamente. Para administrá-lo, abra um túnel SSH
na sua máquina:

```bash
ssh -L 4567:127.0.0.1:4567 usuario@IP_DO_VPS
```

Então acesse `http://localhost:4567`, adicione a loja Project Nox e instale as
fontes. Os dados do Suwayomi persistem no volume `suwayomi_data` mesmo após
atualizações dos containers.

## Configurar fontes de anime

O Miwayomi executa extensões no formato Aniyomi em um container separado e não
fica exposto publicamente. Ele usa a porta local `4568` da VPS, preservando a
porta `4567` para o Suwayomi e os mangás.

Abra um túnel SSH na máquina administrativa:

```bash
ssh -L 4568:127.0.0.1:4568 usuario@IP_DO_VPS
```

Depois abra `http://localhost:4568`, adicione somente repositórios de extensões
que você confia e instale as fontes desejadas pela interface do runtime. Os APKs,
cookies e preferências ficam no volume persistente `miwayomi_data`; não os
versione nem os exponha através do Caddy.

O Taiju lê apenas as fontes de anime já instaladas e expõe contratos próprios
de busca, detalhes, episódios, streams, biblioteca e progresso. Para fontes
que apresentem um desafio Cloudflare, o sidecar interno FlareSolverr é iniciado
automaticamente e só pode ser acessado pela rede Docker. Ele não abre portas
públicas; ainda assim, use apenas fontes cujo acesso seja permitido pelos
respectivos termos. Uma fonte indisponível não afeta o fluxo de mangás.

## Backups

Faça backups regulares do PostgreSQL e dos volumes do Suwayomi e Miwayomi antes de atualizar
fontes ou o servidor. A conta, favoritos e progresso usados localmente não são
migrados automaticamente para o banco novo de produção; isso exige uma
migração de dados separada.

## Segurança operacional

- mantenha `deployment/.env.production` apenas no VPS;
- não publique as portas `5432` ou `4567`;
- ative MFA no provedor do VPS, GitHub e registrador do domínio;
- atualize imagens de forma controlada e valide em ambiente local antes;
- não habilite ou publique mecanismos de bypass de desafios de sites sem
  avaliar implicações legais e os termos de cada fonte.

## Procedimento usado na AWS (teste sem domínio pago)

A instância de teste usa Ubuntu em uma EC2 com 2 vCPUs, 8 GB de RAM e disco
de aproximadamente 290 GB. No Security Group, mantenha TCP 22 restrito ao seu
IP e libere TCP 80 e 443. Não libere 5432 ou 4567 para a internet. Associe um
Elastic IP antes de publicar DNS, pois o IP público comum pode mudar após
parar e iniciar a instância.

### Acesso SSH no Windows

O arquivo `.pem` deve permanecer somente no computador do administrador:

```powershell
cd $env:USERPROFILE\Downloads
$Key = (Resolve-Path ".\VPS.pem").Path
$User = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $Key /inheritance:r
icacls $Key /remove "DESKTOP-I157T06\CodexSandboxUsers"
icacls $Key /grant ("{0}:(R)" -f $User)
ssh -i ".\VPS.pem" ubuntu@IP_DA_VPS
```

Se a porta local 4567 já estiver ocupada, use outra porta local para o túnel:

```powershell
ssh -i ".\VPS.pem" -N -L 14567:127.0.0.1:4567 ubuntu@IP_DA_VPS
```

O Suwayomi remoto fica acessível em `http://localhost:14567` enquanto essa
janela permanecer aberta.

### Instalação e atualização da VPS

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

Na primeira instalação:

```bash
cd ~
git clone https://github.com/WendellOttoni/Taiju.git
cd Taiju
cp deployment/.env.production.example deployment/.env.production
chmod 600 deployment/.env.production
nano deployment/.env.production
```

Gere os segredos dentro da VPS, sem enviá-los pelo chat ou pelo GitHub:

```bash
openssl rand -hex 24
openssl rand -hex 32
```

Para um teste sem domínio, `nip.io` fornece um hostname baseado no IP. Com o
IP `54.232.197.67`, usamos `54-232-197-67.nip.io`:

```env
TAIJU_DOMAIN=54-232-197-67.nip.io
SUWAYOMI_PUBLIC_URL=https://54-232-197-67.nip.io/suwayomi
POSTGRES_USER=taiju
POSTGRES_PASSWORD=valor_hex_gerado
AUTH_JWT_SECRET=outro_valor_hex_gerado
ADULT_CONTENT_EMAILS=
```

Fontes classificadas pelo Suwayomi como `MIXED` ou `NSFW` ficam ocultas para
visitantes e contas não autorizadas. Para liberar somente uma conta, configure,
por exemplo, `ADULT_CONTENT_EMAILS=conta@example.com`. Não coloque esse valor no
repositório; altere somente `deployment/.env.production` no VPS.

Valide e suba os containers:

```bash
docker compose --env-file deployment/.env.production -f compose.production.yml config --quiet
docker compose --env-file deployment/.env.production -f compose.production.yml up -d --build
docker compose --env-file deployment/.env.production -f compose.production.yml ps
```

Para atualizar uma instalação existente:

```bash
cd ~/Taiju
git pull --ff-only origin main
docker compose --env-file deployment/.env.production -f compose.production.yml up -d --build
```

### Fontes e diagnóstico

Instale as extensões pela interface do Suwayomi no túnel SSH. Depois confirme
que a API Taiju enxerga as fontes:

```bash
curl -s "https://54-232-197-67.nip.io/api/sources?language=pt-BR"
```

O healthcheck interno da API pode ser testado sem expor a porta 3000:

```bash
docker compose --env-file deployment/.env.production -f compose.production.yml \
  exec api bun -e "fetch('http://localhost:3000/health').then(async r => { console.log(r.status); console.log(await r.text()) })"
```

O proxy público de capas/páginas usa as rotas de assets do Suwayomi:

```bash
curl -I "https://54-232-197-67.nip.io/suwayomi/api/v1/manga/ID/thumbnail"
```

Se essa rota retornar `400` com `Expected URL scheme`, o erro vem da extensão
do Suwayomi ao resolver a URL original da imagem; não é falha de HTTPS ou do
Caddy. Registre a fonte e o ID afetados antes de investigar a extensão.

Para executar uma varredura de todas as fontes, incluindo pesquisa, detalhes,
capítulos, páginas e uma requisição real de thumbnail:

```bash
docker compose --env-file deployment/.env.production -f compose.production.yml \
  exec api bun scripts/validate-sources.ts "solo leveling"
```

Troque o texto da pesquisa por um título que exista nas fontes. O comando é
intencionalmente sequencial para não sobrecarregar sites de origem. `failed` em
thumbnail significa que a fonte retornou uma URL de capa inválida, HTTP 4xx/5xx
ou conteúdo que não é imagem; `skipped` significa que a pesquisa não encontrou
um título para testar a capa.

### Vercel

O frontend está em `apps/web`. O projeto Vercel usa Root Directory `apps/web`,
framework Vite, `bun run build` e saída `dist`. O arquivo
`apps/web/vercel.json` encaminha `/api/*` para o endpoint HTTPS temporário da
VPS e faz fallback das rotas SPA para `index.html`.

Deploy manual pelo computador de desenvolvimento:

```powershell
cd C:\Repositorio\Taiju
vercel login
vercel link
vercel --prod --yes
```

Depois de cada correção que deve chegar à VPS e à integração Git:

```powershell
git push origin main
```
