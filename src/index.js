require('dotenv').config();

const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Partials,
  PermissionFlagsBits
} = require('discord.js');

const { readDb, writeDb } = require('./db');

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Falta DISCORD_TOKEN no .env/Railway Variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

function validHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function cleanChannelName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30) || 'cliente';
}

function buttonStyleFromConfig(styleName) {
  return ButtonStyle[styleName] || ButtonStyle.Primary;
}

function buildPanelPayload(db) {
  const embed = new EmbedBuilder()
    .setTitle(db.panel.title || '🎫 Atendimento')
    .setDescription(db.panel.description || 'Clique no botão abaixo para abrir um ticket.')
    .setColor(validHexColor(db.panel.color) ? db.panel.color : '#5865F2');

  const button = new ButtonBuilder()
    .setCustomId('ticket:create')
    .setLabel(db.panel.buttonLabel || 'Abrir ticket')
    .setStyle(buttonStyleFromConfig(db.panel.buttonStyle));

  if (db.panel.buttonEmoji) button.setEmoji(db.panel.buttonEmoji);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(button)]
  };
}

function buildTicketButtons(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:claim')
        .setLabel('Assumir ticket')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId('ticket:close')
        .setLabel('Fechar ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function memberCanManageTicket(member, db) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  const supportRoleId = db.ids.supportRoleId;
  const ownerRoleId = db.ids.ownerRoleId;
  return Boolean(
    (supportRoleId && member.roles.cache.has(supportRoleId)) ||
    (ownerRoleId && member.roles.cache.has(ownerRoleId))
  );
}

async function sendLog(guild, title, description, color = '#5865F2', files = []) {
  const db = readDb();
  if (!db.ids.logChannelId) return;

  const channel = await guild.channels.fetch(db.ids.logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(validHexColor(color) ? color : '#5865F2')
    .setTimestamp();

  await channel.send({ embeds: [embed], files }).catch(console.error);
}

async function updateStoredPanelMessage(guild, db) {
  if (!db.panelMessage.channelId || !db.panelMessage.messageId) {
    return { updated: false, reason: 'Nenhum painel antigo salvo.' };
  }

  const channel = await guild.channels.fetch(db.panelMessage.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return { updated: false, reason: 'Canal do painel antigo não foi encontrado.' };
  }

  const message = await channel.messages.fetch(db.panelMessage.messageId).catch(() => null);
  if (!message) {
    return { updated: false, reason: 'Mensagem do painel antigo não foi encontrada.' };
  }

  await message.edit(buildPanelPayload(db));
  return { updated: true, reason: 'Painel antigo atualizado.' };
}

async function fetchTranscript(channel) {
  const messages = [];
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    messages.push(...batch.values());
    lastId = batch.last().id;

    if (batch.size < 100) break;
  }

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = messages.map(message => {
    const date = new Date(message.createdTimestamp).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo'
    });

    const content = message.content?.trim() || '[sem texto]';
    const attachments = message.attachments.size
      ? `\nAnexos: ${message.attachments.map(att => att.url).join(', ')}`
      : '';

    return `[${date}] ${message.author.tag} (${message.author.id}): ${content}${attachments}`;
  });

  return lines.join('\n') || 'Nenhuma mensagem encontrada no ticket.';
}

async function handlePanelCommand(interaction) {
  const db = readDb();
  const message = await interaction.channel.send(buildPanelPayload(db));

  db.panelMessage = {
    channelId: message.channel.id,
    messageId: message.id
  };
  writeDb(db);

  await interaction.reply({ content: '✅ Painel de tickets enviado neste canal.', ephemeral: true });
}

async function handleConfigCommand(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const db = readDb();

  if (subcommand === 'ver') {
    const embed = new EmbedBuilder()
      .setTitle('Configuração atual do ticket')
      .setColor(validHexColor(db.panel.color) ? db.panel.color : '#5865F2')
      .addFields(
        { name: 'Título', value: db.panel.title || 'Não definido', inline: false },
        { name: 'Descrição', value: db.panel.description?.slice(0, 1024) || 'Não definido', inline: false },
        { name: 'Cor da embed', value: db.panel.color || 'Não definida', inline: true },
        { name: 'Botão', value: `${db.panel.buttonEmoji || ''} ${db.panel.buttonLabel || 'Abrir ticket'} (${db.panel.buttonStyle})`, inline: true },
        { name: 'Cargo suporte', value: db.ids.supportRoleId ? `<@&${db.ids.supportRoleId}>` : 'Não definido', inline: true },
        { name: 'Cargo dono', value: db.ids.ownerRoleId ? `<@&${db.ids.ownerRoleId}>` : 'Não definido', inline: true },
        { name: 'Canal logs', value: db.ids.logChannelId ? `<#${db.ids.logChannelId}>` : 'Não definido', inline: true },
        { name: 'Categoria tickets', value: db.ids.categoryId || 'Não definida', inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (subcommand !== 'painel') return;

  const title = interaction.options.getString('titulo');
  const description = interaction.options.getString('descricao');
  const embedColor = interaction.options.getString('cor_embed');
  const buttonLabel = interaction.options.getString('texto_botao');
  const buttonEmoji = interaction.options.getString('emoji_botao');
  const buttonStyle = interaction.options.getString('cor_botao');
  const supportRole = interaction.options.getRole('cargo_suporte');
  const ownerRole = interaction.options.getRole('cargo_dono');
  const logChannel = interaction.options.getChannel('canal_logs');
  const category = interaction.options.getChannel('categoria_tickets');

  if (embedColor && !validHexColor(embedColor)) {
    await interaction.reply({ content: '❌ A cor da embed precisa estar no formato hexadecimal, exemplo: `#ff0000`.', ephemeral: true });
    return;
  }

  if (title !== null) db.panel.title = title;
  if (description !== null) db.panel.description = description;
  if (embedColor !== null) db.panel.color = embedColor;
  if (buttonLabel !== null) db.panel.buttonLabel = buttonLabel;
  if (buttonEmoji !== null) db.panel.buttonEmoji = ['nenhum', 'none', 'off', 'remover'].includes(buttonEmoji.toLowerCase()) ? null : buttonEmoji;
  if (buttonStyle !== null) db.panel.buttonStyle = buttonStyle;
  if (supportRole) db.ids.supportRoleId = supportRole.id;
  if (ownerRole) db.ids.ownerRoleId = ownerRole.id;
  if (logChannel) db.ids.logChannelId = logChannel.id;
  if (category) db.ids.categoryId = category.id;

  writeDb(db);

  const update = await updateStoredPanelMessage(interaction.guild, db).catch(error => ({
    updated: false,
    reason: `Erro atualizando painel antigo: ${error.message}`
  }));

  await interaction.reply({
    content: `✅ Configuração salva. ${update.reason}`,
    ephemeral: true
  });
}

async function handleCreateTicket(interaction) {
  const db = readDb();
  const userId = interaction.user.id;

  const alreadyOpen = Object.entries(db.tickets).find(([, ticket]) =>
    ticket.userId === userId && ticket.status === 'open'
  );

  if (alreadyOpen) {
    await interaction.reply({ content: `❌ Você já tem um ticket aberto: <#${alreadyOpen[0]}>`, ephemeral: true });
    return;
  }

  const overwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  for (const roleId of [db.ids.supportRoleId, db.ids.ownerRoleId].filter(Boolean)) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    });
  }

  const channel = await interaction.guild.channels.create({
    name: `ticket-${cleanChannelName(interaction.user.username)}`,
    type: ChannelType.GuildText,
    parent: db.ids.categoryId || null,
    topic: `Ticket de ${interaction.user.tag} (${userId})`,
    permissionOverwrites: overwrites
  });

  db.tickets[channel.id] = {
    userId,
    username: interaction.user.tag,
    status: 'open',
    claimedBy: null,
    createdAt: Date.now()
  };
  writeDb(db);

  const embed = new EmbedBuilder()
    .setTitle('🎫 Ticket aberto')
    .setDescription(`Olá ${interaction.user}, explique seu problema com detalhes.\n\nUm suporte pode clicar em **Assumir ticket** para atender.`)
    .setColor('#57F287')
    .setTimestamp();

  await channel.send({
    content: `${interaction.user}${db.ids.supportRoleId ? ` <@&${db.ids.supportRoleId}>` : ''}`,
    embeds: [embed],
    components: buildTicketButtons()
  });

  await interaction.reply({ content: `✅ Ticket criado: ${channel}`, ephemeral: true });

  await sendLog(
    interaction.guild,
    '🎫 Ticket criado',
    `Cliente: ${interaction.user} (${interaction.user.id})\nCanal: ${channel}`,
    '#57F287'
  );
}

async function handleClaimTicket(interaction) {
  const db = readDb();
  const ticket = db.tickets[interaction.channel.id];

  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({ content: '❌ Este canal não parece ser um ticket aberto.', ephemeral: true });
    return;
  }

  if (!memberCanManageTicket(interaction.member, db)) {
    await interaction.reply({ content: '❌ Você não tem permissão para assumir este ticket.', ephemeral: true });
    return;
  }

  if (ticket.claimedBy) {
    await interaction.reply({ content: `❌ Este ticket já foi assumido por <@${ticket.claimedBy}>.`, ephemeral: true });
    return;
  }

  ticket.claimedBy = interaction.user.id;
  db.tickets[interaction.channel.id] = ticket;
  writeDb(db);

  await interaction.reply(`🙋 Ticket assumido por ${interaction.user}.`);

  await sendLog(
    interaction.guild,
    '🙋 Ticket assumido',
    `Suporte: ${interaction.user} (${interaction.user.id})\nCliente: <@${ticket.userId}>\nCanal: ${interaction.channel}`,
    '#FEE75C'
  );
}

async function handleCloseTicket(interaction) {
  const db = readDb();
  const ticket = db.tickets[interaction.channel.id];

  if (!ticket || ticket.status !== 'open') {
    await interaction.reply({ content: '❌ Este canal não parece ser um ticket aberto.', ephemeral: true });
    return;
  }

  if (!memberCanManageTicket(interaction.member, db)) {
    await interaction.reply({ content: '❌ Só suporte/dono/admin pode fechar este ticket.', ephemeral: true });
    return;
  }

  await interaction.reply('🔒 Fechando ticket, gerando transcript e enviando logs...');

  const transcript = await fetchTranscript(interaction.channel).catch(error => {
    console.error('Erro criando transcript:', error);
    return `Erro ao gerar transcript: ${error.message}`;
  });

  const filename = `transcript-${interaction.channel.name}-${Date.now()}.txt`;
  const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: filename });

  const clientUser = await client.users.fetch(ticket.userId).catch(() => null);
  if (clientUser) {
    await clientUser.send({
      content: `📄 Transcript do seu ticket em **${interaction.guild.name}**.`,
      files: [attachment]
    }).catch(() => null);
  }

  const logAttachment = new AttachmentBuilder(Buffer.from(transcript, 'utf8'), { name: filename });
  await sendLog(
    interaction.guild,
    '🔒 Ticket fechado',
    `Fechado por: ${interaction.user} (${interaction.user.id})\nCliente: <@${ticket.userId}> (${ticket.userId})\nCanal: #${interaction.channel.name}\nAssumido por: ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'ninguém'}`,
    '#ED4245',
    [logAttachment]
  );

  ticket.status = 'closed';
  ticket.closedBy = interaction.user.id;
  ticket.closedAt = Date.now();
  db.tickets[interaction.channel.id] = ticket;
  writeDb(db);

  setTimeout(() => {
    interaction.channel.delete('Ticket fechado').catch(console.error);
  }, 5000);
}

client.once('ready', () => {
  console.log(`Bot online como ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') await handlePanelCommand(interaction);
      if (interaction.commandName === 'config') await handleConfigCommand(interaction);
      return;
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'ticket:create') await handleCreateTicket(interaction);
    if (interaction.customId === 'ticket:claim') await handleClaimTicket(interaction);
    if (interaction.customId === 'ticket:close') await handleCloseTicket(interaction);
  } catch (error) {
    console.error(error);

    const content = '❌ Ocorreu um erro ao executar essa ação. Veja o console/logs do Railway.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => null);
    }
  }
});

client.login(token);
