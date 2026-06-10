# Bot de Ticket Discord + Railway

Bot de tickets para Discord com:

- `/painel` para enviar painel de abertura de ticket.
- `/config painel` para editar título, descrição, cor da embed, texto/emoji/cor do botão, cargo de suporte, cargo dono, logs e categoria.
- Canal privado para cliente + suporte + dono.
- Botões de **Assumir ticket** e **Fechar ticket**.
- Logs quando ticket é criado, assumido e fechado.
- Transcript `.txt` enviado na DM do cliente e no canal de logs.

## 1. Criar bot no Discord

1. Acesse o Discord Developer Portal.
2. Crie uma aplicação e um bot.
3. Copie o **Token** do bot.
4. Copie o **Application ID / Client ID**.
5. Ative o **Message Content Intent** no bot. Isso ajuda o bot a gerar transcript com conteúdo das mensagens.
6. Convide o bot com os escopos:
   - `bot`
   - `applications.commands`

Permissões recomendadas para o bot:

- Manage Channels
- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files
- Use Slash Commands

## 2. Rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

Preencha o `.env`:

```env
DISCORD_TOKEN=seu_token
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
DATA_DIR=./data
```

## 3. Configurar no Discord

No servidor, use:

```text
/config painel cargo_suporte:@Suporte cargo_dono:@Dono canal_logs:#logs categoria_tickets:Tickets
```

Depois envie o painel:

```text
/painel
```

Para editar o painel depois:

```text
/config painel titulo:Suporte descrição:Clique para abrir atendimento cor_embed:#ff0000 texto_botao:Abrir atendimento emoji_botao:📩 cor_botao:Verde
```

Para remover emoji do botão:

```text
/config painel emoji_botao:nenhum
```

Para ver a config atual:

```text
/config ver
```

## 4. Subir no GitHub e Railway

1. Crie um repositório no GitHub.
2. Suba estes arquivos.
3. No Railway, crie um projeto a partir do repositório do GitHub.
4. Em **Variables**, adicione:

```env
DISCORD_TOKEN=seu_token
CLIENT_ID=id_da_aplicacao
GUILD_ID=id_do_servidor
DATA_DIR=/data
```

5. Crie um **Volume** no Railway e monte no caminho:

```text
/data
```

Isso é importante porque a configuração do painel fica salva em arquivo JSON. Sem Volume, a config pode sumir quando o Railway reiniciar ou fizer redeploy.

## 5. Observações

- Use `GUILD_ID` para os slash commands aparecerem rapidamente no seu servidor.
- Não poste o token do bot no GitHub.
- Se o cliente bloquear DM, o transcript não vai chegar para ele, mas ainda será enviado no canal de logs.
- Para o transcript conter mensagens, o bot precisa conseguir ler o histórico do canal.
