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
- `AUTH_JWT_SECRET` com pelo menos 32 caracteres aleatórios.

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

## Backups

Faça backups regulares do PostgreSQL e do volume do Suwayomi antes de atualizar
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
