require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('Faltam variáveis: DISCORD_TOKEN e/ou CLIENT_ID.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Envia o painel de tickets no canal atual.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura o sistema de tickets.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('painel')
        .setDescription('Edita texto, cores, cargos, categoria e logs do painel.')
        .addStringOption(opt =>
          opt.setName('titulo')
            .setDescription('Título da embed do painel.')
            .setMaxLength(256)
        )
        .addStringOption(opt =>
          opt.setName('descricao')
            .setDescription('Texto/descrição da embed do painel.')
            .setMaxLength(4000)
        )
        .addStringOption(opt =>
          opt.setName('cor_embed')
            .setDescription('Cor da barrinha da embed. Exemplo: #ff0000')
            .setMaxLength(7)
        )
        .addStringOption(opt =>
          opt.setName('texto_botao')
            .setDescription('Texto do botão de abrir ticket.')
            .setMaxLength(80)
        )
        .addStringOption(opt =>
          opt.setName('emoji_botao')
            .setDescription('Emoji do botão. Use "nenhum" para remover.')
            .setMaxLength(50)
        )
        .addStringOption(opt =>
          opt.setName('cor_botao')
            .setDescription('Cor/estilo do botão de abrir ticket.')
            .addChoices(
              { name: 'Azul', value: 'Primary' },
              { name: 'Cinza', value: 'Secondary' },
              { name: 'Verde', value: 'Success' },
              { name: 'Vermelho', value: 'Danger' }
            )
        )
        .addRoleOption(opt =>
          opt.setName('cargo_suporte')
            .setDescription('Cargo que poderá ver/assumir/fechar tickets.')
        )
        .addRoleOption(opt =>
          opt.setName('cargo_dono')
            .setDescription('Cargo do dono/admin que poderá ver tickets.')
        )
        .addChannelOption(opt =>
          opt.setName('canal_logs')
            .setDescription('Canal onde serão enviados os logs.')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(opt =>
          opt.setName('categoria_tickets')
            .setDescription('Categoria onde os canais de ticket serão criados.')
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('ver')
        .setDescription('Mostra a configuração atual do sistema de tickets.')
    )
].map(command => command.toJSON());

async function main() {
  const rest = new REST({ version: '10' }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);

  await rest.put(route, { body: commands });
  console.log(guildId
    ? `Comandos registrados no servidor ${guildId}.`
    : 'Comandos globais registrados. Podem demorar para aparecer.'
  );
}

main().catch(error => {
  console.error('Erro registrando comandos:', error);
  process.exit(1);
});
