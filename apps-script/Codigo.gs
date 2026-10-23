/**
 * Reservas de equipamentos do LabSEL — serviço do formulário do site do GSEL.
 *
 * Fluxo:
 *   1. O site envia a solicitação (doPost). O serviço registra na planilha e
 *      manda ao solicitante um e-mail com o link de verificação.
 *   2. O solicitante abre o link e confirma o e-mail (confirmarEmail). Só então
 *      o pedido chega ao e-mail do GSEL, com os botões Autorizar e Recusar.
 *   3. O GSEL abre o link, decide e pode escrever uma mensagem
 *      (registrarDecisao). O solicitante recebe a resposta por e-mail.
 *
 * Instalação e atualização: veja LEIAME.md, nesta mesma pasta.
 */

var CONFIG = {
  // Recebe as solicitações já verificadas, para autorizar ou recusar.
  EMAIL_GSEL: 'gsel@garanhuns.ifpe.edu.br',
  NOME_REMETENTE: 'GSEL · LabSEL',
  SITE_URL: 'https://gsel-ifpe.github.io/site/',
  // Vazio: usa o endereço da implantação atual do app da Web.
  URL_SERVICO: '',
  FUSO: 'America/Recife',
  HORAS_PARA_VERIFICAR: 24,
  EQUIPAMENTOS: {
    'Impressora 3D': { quantidade: true },
    'Fresadora': { quantidade: true },
    'Bancada de eletrônica': { agenda: true }
  },
  PERIODOS: ['Manhã', 'Tarde', 'Noite'],
  // Proteção contra abuso: pedidos por e-mail a cada 30 min e pedidos por hora no total.
  LIMITE_POR_EMAIL: 3,
  LIMITE_POR_HORA: 40
};

var COLUNAS = [
  'id', 'criada_em', 'status', 'equipamento', 'nome', 'email', 'telefone', 'projeto',
  'descricao', 'quantidade', 'data_desejada', 'periodo', 'token_verificacao',
  'verificada_em', 'token_decisao', 'decidida_em', 'mensagem_gsel'
];

var STATUS = {
  VERIFICAR: 'Aguardando verificação do e-mail',
  AUTORIZAR: 'Aguardando autorização do GSEL',
  APROVADA: 'Autorizada',
  RECUSADA: 'Não autorizada',
  EXPIRADA: 'Verificação expirada'
};

var COR = {
  azul: '#142B47',
  ciano: '#37C0D5',
  eletrico: '#153A72',
  nevoa: '#EEF2F5',
  grafite: '#5C6B7A',
  texto: '#34414F'
};

/* ---------- Pontos de entrada ---------- */

/** Rode uma vez pelo editor: cria a planilha e pede as autorizações necessárias. */
function configurar() {
  var aba = planilha_();
  console.log('Planilha de reservas: ' + aba.getParent().getUrl());
  console.log('E-mails que ainda podem ser enviados hoje: ' + MailApp.getRemainingDailyQuota());
}

/** Recebe a solicitação enviada pelo formulário do site. */
function doPost(e) {
  try {
    var dados = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    // Campo invisível no site: só robôs o preenchem. Finge sucesso e descarta.
    if (dados.site) return json_({ ok: true });

    var pedido = validar_(dados);
    limitar_(pedido.email);
    garantirCota_(1);

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var aba = planilha_();
      var agora = new Date();
      pedido.id = 'R' + Utilities.formatDate(agora, CONFIG.FUSO, 'yyMMdd') + '-' + token_().slice(0, 4).toUpperCase();
      pedido.criada_em = agora;
      pedido.status = STATUS.VERIFICAR;
      pedido.token_verificacao = token_();
      aba.appendRow(COLUNAS.map(function (c) { return celula_(pedido[c]); }));
    } finally {
      lock.releaseLock();
    }

    enviarVerificacao_(pedido);
    return json_({ ok: true, id: pedido.id });
  } catch (err) {
    if (err && err.usuario) return json_({ ok: false, erro: err.message });
    console.error(err);
    return json_({
      ok: false,
      erro: 'Não foi possível registrar a solicitação agora. Tente novamente em alguns minutos ou escreva para ' + CONFIG.EMAIL_GSEL + '.'
    });
  }
}

/** Páginas abertas pelos links dos e-mails. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.acao === 'verificar') return paginaVerificar_(p.token);
  if (p.acao === 'decidir') return paginaDecidir_(p.token, p.sugestao);
  return pagina_('Reservas do LabSEL',
    '<p>Este é o serviço de reservas de equipamentos do GSEL. Para fazer uma solicitação, acesse o ' +
    '<a href="' + esc_(CONFIG.SITE_URL) + '#reservas">site do GSEL</a>.</p>');
}

/** Chamado pela página de verificação, quando o solicitante confirma o e-mail. */
function confirmarEmail(token) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var aba = planilha_();
    var reg = buscarPor_(aba, 'token_verificacao', token);
    if (!reg) return { ok: false, mensagem: 'Link inválido. Confira se você abriu o link completo do e-mail.' };
    if (reg.status === STATUS.EXPIRADA || (reg.status === STATUS.VERIFICAR && expirado_(reg))) {
      atualizar_(aba, reg, { status: STATUS.EXPIRADA });
      return { ok: false, mensagem: 'Este link expirou. Envie uma nova solicitação pelo site do GSEL.' };
    }
    if (reg.status !== STATUS.VERIFICAR) {
      return { ok: true, mensagem: 'Este e-mail já foi confirmado. Situação da solicitação: ' + reg.status + '.' };
    }

    garantirCota_(1);
    atualizar_(aba, reg, { status: STATUS.AUTORIZAR, verificada_em: new Date(), token_decisao: token_() });
    try {
      enviarParaGsel_(reg);
    } catch (err) {
      atualizar_(aba, reg, { status: STATUS.VERIFICAR, verificada_em: '', token_decisao: '' });
      throw err;
    }
    return {
      ok: true,
      mensagem: 'E-mail confirmado! Sua solicitação foi enviada ao GSEL. Você receberá a resposta por e-mail em ' + reg.email + '.'
    };
  } catch (err) {
    if (err && err.usuario) return { ok: false, mensagem: err.message };
    console.error(err);
    return { ok: false, mensagem: 'Não foi possível confirmar agora. Tente novamente em alguns minutos.' };
  } finally {
    lock.releaseLock();
  }
}

/** Chamado pela página de decisão, quando o GSEL autoriza ou recusa. */
function registrarDecisao(token, decisao, mensagem) {
  if (decisao !== 'aprovar' && decisao !== 'recusar') {
    return { ok: false, mensagem: 'Escolha se a solicitação será autorizada ou recusada.' };
  }
  var texto = String(mensagem || '').trim().slice(0, 1500);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var aba = planilha_();
    var reg = buscarPor_(aba, 'token_decisao', token);
    if (!reg) return { ok: false, mensagem: 'Link inválido ou solicitação não encontrada.' };
    if (reg.status !== STATUS.AUTORIZAR) {
      return { ok: false, mensagem: 'Esta solicitação já foi respondida: ' + reg.status + '.' };
    }

    garantirCota_(1);
    var novo = decisao === 'aprovar' ? STATUS.APROVADA : STATUS.RECUSADA;
    atualizar_(aba, reg, { status: novo, decidida_em: new Date(), mensagem_gsel: texto });
    try {
      enviarDecisao_(reg);
    } catch (err) {
      atualizar_(aba, reg, { status: STATUS.AUTORIZAR, decidida_em: '', mensagem_gsel: '' });
      throw err;
    }
    return {
      ok: true,
      mensagem: (novo === STATUS.APROVADA ? 'Reserva autorizada.' : 'Solicitação recusada.') +
        ' A resposta foi enviada automaticamente para ' + reg.email + '.'
    };
  } catch (err) {
    if (err && err.usuario) return { ok: false, mensagem: err.message };
    console.error(err);
    return { ok: false, mensagem: 'Não foi possível registrar a decisão agora. Tente novamente em alguns minutos.' };
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Validação e proteção ---------- */

function validar_(d) {
  var p = {};
  p.equipamento = String(d.equipamento || '').trim();
  var regra = CONFIG.EQUIPAMENTOS[p.equipamento];
  if (!regra) throw erroUsuario_('Escolha o equipamento que deseja reservar.');

  p.nome = obrigatorio_(d.nome, 120, 'o nome do solicitante');
  p.email = obrigatorio_(d.email, 160, 'o e-mail').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw erroUsuario_('Informe um e-mail válido.');
  p.telefone = obrigatorio_(d.telefone, 20, 'o telefone para contato');
  var digitos = p.telefone.replace(/\D/g, '').length;
  if (digitos < 10 || digitos > 11) throw erroUsuario_('Informe o telefone com DDD.');
  p.projeto = obrigatorio_(d.projeto, 200, 'o título do projeto');
  p.descricao = obrigatorio_(d.descricao, 1500, 'a descrição da demanda');

  if (regra.quantidade) {
    var q = Number(d.quantidade);
    if (!(q >= 1 && q <= 1000 && Math.floor(q) === q)) throw erroUsuario_('Informe uma quantidade a partir de 1.');
    p.quantidade = q;
  }
  if (regra.agenda) {
    var data = String(d.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erroUsuario_('Informe a data desejada.');
    if (data < Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyy-MM-dd')) {
      throw erroUsuario_('Escolha uma data a partir de hoje.');
    }
    p.data_desejada = data.split('-').reverse().join('/');
    p.periodo = String(d.periodo || '');
    if (CONFIG.PERIODOS.indexOf(p.periodo) < 0) throw erroUsuario_('Escolha o período desejado.');
  }
  return p;
}

function obrigatorio_(valor, max, nome) {
  var s = String(valor === undefined || valor === null ? '' : valor).trim();
  if (!s) throw erroUsuario_('Preencha ' + nome + '.');
  if (s.length > max) throw erroUsuario_('O campo com ' + nome + ' passou do limite de ' + max + ' caracteres.');
  return s;
}

function limitar_(email) {
  var cache = CacheService.getScriptCache();
  var chaveEmail = 'email:' + email;
  var porEmail = Number(cache.get(chaveEmail) || 0);
  if (porEmail >= CONFIG.LIMITE_POR_EMAIL) {
    throw erroUsuario_('Você enviou várias solicitações seguidas. Aguarde alguns minutos e tente de novo.');
  }
  var chaveHora = 'hora:' + Utilities.formatDate(new Date(), CONFIG.FUSO, 'yyyyMMddHH');
  var porHora = Number(cache.get(chaveHora) || 0);
  if (porHora >= CONFIG.LIMITE_POR_HORA) {
    throw erroUsuario_('O sistema de reservas recebeu muitas solicitações nesta hora. Tente novamente mais tarde.');
  }
  cache.put(chaveEmail, String(porEmail + 1), 1800);
  cache.put(chaveHora, String(porHora + 1), 3600);
}

function garantirCota_(n) {
  if (MailApp.getRemainingDailyQuota() < n) {
    throw erroUsuario_('O limite diário de e-mails do sistema de reservas foi atingido. Tente novamente amanhã ou escreva para ' + CONFIG.EMAIL_GSEL + '.');
  }
}

function erroUsuario_(mensagem) {
  var err = new Error(mensagem);
  err.usuario = true;
  return err;
}

/* ---------- Planilha ---------- */

function planilha_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PLANILHA_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('Reservas do LabSEL (site do GSEL)');
    props.setProperty('PLANILHA_ID', ss.getId());
  }
  var aba = ss.getSheets()[0];
  if (aba.getLastRow() === 0) {
    aba.appendRow(COLUNAS);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, COLUNAS.length).setFontWeight('bold');
  }
  return aba;
}

function buscarPor_(aba, coluna, valor) {
  valor = String(valor || '');
  if (!/^[0-9a-f]{64}$/.test(valor)) return null;
  var ultima = aba.getLastRow();
  if (ultima < 2) return null;
  var col = COLUNAS.indexOf(coluna) + 1;
  var valores = aba.getRange(2, col, ultima - 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0]) === valor) {
      var linha = i + 2;
      var dados = aba.getRange(linha, 1, 1, COLUNAS.length).getValues()[0];
      var reg = { linha_: linha };
      COLUNAS.forEach(function (c, j) { reg[c] = dados[j]; });
      return reg;
    }
  }
  return null;
}

function atualizar_(aba, reg, campos) {
  Object.keys(campos).forEach(function (c) {
    aba.getRange(reg.linha_, COLUNAS.indexOf(c) + 1).setValue(celula_(campos[c]));
    reg[c] = campos[c];
  });
}

// Texto entra com apóstrofo para a planilha não interpretar fórmulas nem converter datas.
function celula_(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  if (valor instanceof Date || typeof valor === 'number') return valor;
  return "'" + String(valor);
}

function expirado_(reg) {
  var criada = reg.criada_em instanceof Date ? reg.criada_em : new Date(reg.criada_em);
  return Date.now() - criada.getTime() > CONFIG.HORAS_PARA_VERIFICAR * 3600 * 1000;
}

function token_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}

/* ---------- E-mails ---------- */

function enviarVerificacao_(reg) {
  var link = urlServico_() + '?acao=verificar&token=' + reg.token_verificacao;
  var html = emailHtml_({
    titulo: 'Confirme seu e-mail',
    intro: '<p style="margin:0 0 12px;">Olá, ' + esc_(reg.nome) + '. Recebemos pelo site do GSEL uma solicitação de reserva de <strong>' +
      esc_(reg.equipamento) + '</strong> com este endereço de e-mail.</p>' +
      '<p style="margin:0;">Para que a solicitação chegue ao GSEL, confirme que o e-mail é seu:</p>',
    botoes: [{ texto: 'Confirmar e-mail', url: link, primario: true }],
    nota: 'O link vale por ' + CONFIG.HORAS_PARA_VERIFICAR + ' horas. Se você não fez esta solicitação, ignore esta mensagem.',
    resumo: resumo_(reg)
  });
  MailApp.sendEmail({
    to: reg.email,
    subject: 'Confirme seu e-mail para enviar a solicitação de reserva (' + reg.equipamento + ')',
    name: CONFIG.NOME_REMETENTE,
    replyTo: CONFIG.EMAIL_GSEL,
    htmlBody: html,
    body: 'Olá, ' + reg.nome + '.\n\nPara enviar ao GSEL a solicitação de reserva de ' + reg.equipamento +
      ', confirme seu e-mail neste link (válido por ' + CONFIG.HORAS_PARA_VERIFICAR + ' horas):\n' + link +
      '\n\nSe você não fez esta solicitação, ignore esta mensagem.\n\n' + resumoTexto_(reg)
  });
}

function enviarParaGsel_(reg) {
  var base = urlServico_() + '?acao=decidir&token=' + reg.token_decisao;
  var html = emailHtml_({
    titulo: 'Nova solicitação de reserva',
    intro: '<p style="margin:0;"><strong>' + esc_(reg.nome) + '</strong> confirmou o e-mail ' + esc_(reg.email) +
      ' e solicita a reserva de <strong>' + esc_(reg.equipamento) + '</strong>. Analise os dados abaixo e registre a decisão:</p>',
    botoes: [
      { texto: 'Autorizar', url: base + '&sugestao=aprovar', primario: true },
      { texto: 'Recusar', url: base + '&sugestao=recusar', primario: false }
    ],
    nota: 'Os botões abrem uma página de confirmação, onde você pode escrever uma mensagem ao solicitante. ' +
      'A resposta é enviada automaticamente por e-mail. Para falar diretamente com o solicitante, responda a esta mensagem.',
    resumo: resumo_(reg)
  });
  MailApp.sendEmail({
    to: CONFIG.EMAIL_GSEL,
    subject: 'Nova solicitação de reserva: ' + reg.equipamento + ' — ' + reg.nome + ' (' + reg.id + ')',
    name: CONFIG.NOME_REMETENTE,
    replyTo: reg.email,
    htmlBody: html,
    body: reg.nome + ' (' + reg.email + ') solicita a reserva de ' + reg.equipamento + '.\n\n' +
      'Autorizar: ' + base + '&sugestao=aprovar\nRecusar: ' + base + '&sugestao=recusar\n\n' + resumoTexto_(reg)
  });
}

function enviarDecisao_(reg) {
  var aprovada = reg.status === STATUS.APROVADA;
  var mensagem = reg.mensagem_gsel
    ? '<strong>Mensagem do GSEL:</strong><br>' + quebras_(esc_(reg.mensagem_gsel))
    : '';
  var html = emailHtml_({
    titulo: aprovada ? 'Sua reserva foi autorizada' : 'Sua solicitação não foi autorizada',
    intro: '<p style="margin:0;">Olá, ' + esc_(reg.nome) + '. ' + (aprovada
      ? 'O GSEL autorizou a sua solicitação de reserva de <strong>' + esc_(reg.equipamento) + '</strong>.'
      : 'O GSEL analisou a sua solicitação de reserva de <strong>' + esc_(reg.equipamento) + '</strong> e, desta vez, ela não pôde ser autorizada.') +
      '</p>',
    destaque: mensagem,
    nota: 'Em caso de dúvidas, responda a este e-mail ou escreva para ' + esc_(CONFIG.EMAIL_GSEL) + '.',
    resumo: resumo_(reg)
  });
  MailApp.sendEmail({
    to: reg.email,
    subject: (aprovada ? 'Reserva autorizada: ' : 'Solicitação de reserva não autorizada: ') + reg.equipamento + ' (' + reg.id + ')',
    name: CONFIG.NOME_REMETENTE,
    replyTo: CONFIG.EMAIL_GSEL,
    htmlBody: html,
    body: 'Olá, ' + reg.nome + '.\n\n' + (aprovada
      ? 'O GSEL autorizou a sua solicitação de reserva de ' + reg.equipamento + '.'
      : 'O GSEL analisou a sua solicitação de reserva de ' + reg.equipamento + ' e, desta vez, ela não pôde ser autorizada.') +
      (reg.mensagem_gsel ? '\n\nMensagem do GSEL:\n' + reg.mensagem_gsel : '') +
      '\n\nEm caso de dúvidas, responda a este e-mail.\n\n' + resumoTexto_(reg)
  });
}

function resumo_(reg) {
  var linhas = [
    ['Solicitação', reg.id],
    ['Equipamento', reg.equipamento],
    ['Solicitante', reg.nome],
    ['E-mail', reg.email],
    ['Telefone', reg.telefone],
    ['Projeto vinculado', reg.projeto],
    ['Descrição e objetivo', reg.descricao]
  ];
  if (reg.quantidade) linhas.push(['Quantidade', String(reg.quantidade)]);
  if (reg.data_desejada) linhas.push(['Data desejada', reg.data_desejada + ' (' + reg.periodo + ')']);
  return linhas;
}

function resumoTexto_(reg) {
  return resumo_(reg).map(function (l) { return l[0] + ': ' + l[1]; }).join('\n');
}

function emailHtml_(o) {
  var botoes = (o.botoes || []).map(function (b) {
    var cores = b.primario
      ? 'background:' + COR.azul + ';color:#ffffff;'
      : 'background:#ffffff;color:' + COR.azul + ';';
    return '<a href="' + esc_(b.url) + '" style="display:inline-block;margin:0 8px 8px 0;padding:12px 24px;border:2px solid ' + COR.azul +
      ';border-radius:10px;font-weight:bold;text-decoration:none;' + cores + '">' + esc_(b.texto) + '</a>';
  }).join('');
  var linhas = (o.resumo || []).map(function (l) {
    return '<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #E3E9EF;color:' + COR.grafite +
      ';vertical-align:top;white-space:nowrap;">' + esc_(l[0]) + '</td><td style="padding:8px 0;border-bottom:1px solid #E3E9EF;color:' +
      COR.azul + ';">' + quebras_(esc_(l[1])) + '</td></tr>';
  }).join('');
  return '<div style="margin:0;padding:24px 12px;background:' + COR.nevoa + ';font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:' + COR.texto + ';">' +
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;">' +
    '<div style="padding:20px 24px;background:' + COR.azul + ';border-bottom:4px solid ' + COR.ciano + ';">' +
    '<div style="font-size:26px;font-weight:bold;letter-spacing:1px;color:#ffffff;">GSEL</div>' +
    '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:' + COR.ciano + ';">LabSEL · Reserva de equipamentos</div>' +
    '</div>' +
    '<div style="padding:24px;">' +
    '<h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;color:' + COR.azul + ';">' + esc_(o.titulo) + '</h1>' +
    o.intro +
    (o.destaque ? '<div style="margin:18px 0 0;padding:14px 16px;border-left:4px solid ' + COR.ciano + ';background:#E3F6F9;color:' + COR.azul + ';">' + o.destaque + '</div>' : '') +
    (botoes ? '<div style="margin:20px 0 4px;">' + botoes + '</div>' : '') +
    (o.nota ? '<p style="margin:12px 0 0;font-size:13px;color:' + COR.grafite + ';">' + o.nota + '</p>' : '') +
    (linhas ? '<table role="presentation" style="width:100%;margin-top:22px;border-collapse:collapse;font-size:14px;">' + linhas + '</table>' : '') +
    '</div>' +
    '<div style="padding:16px 24px;background:' + COR.nevoa + ';font-size:12px;color:' + COR.grafite + ';">' +
    'GSEL — Grupo de Pesquisa em Sistemas Elétricos · IFPE campus Garanhuns<br>' +
    '<a href="' + esc_(CONFIG.SITE_URL) + '" style="color:' + COR.eletrico + ';">' + esc_(CONFIG.SITE_URL) + '</a>' +
    '</div></div></div>';
}

/* ---------- Páginas ---------- */

function paginaVerificar_(token) {
  var aba = planilha_();
  var reg = buscarPor_(aba, 'token_verificacao', token);
  if (!reg) return pagina_('Link inválido', '<p>Não encontramos esta solicitação. Confira se você abriu o link completo do e-mail.</p>');
  if (reg.status === STATUS.EXPIRADA || (reg.status === STATUS.VERIFICAR && expirado_(reg))) {
    return pagina_('Link expirado',
      '<p>O prazo para confirmar este e-mail terminou. Envie uma nova solicitação pelo <a href="' + esc_(CONFIG.SITE_URL) + '#reservas">site do GSEL</a>.</p>');
  }
  if (reg.status !== STATUS.VERIFICAR) {
    return pagina_('E-mail já confirmado',
      '<p>Esta solicitação já foi confirmada. Situação atual: <strong>' + esc_(reg.status) + '</strong>.</p>' + tabela_(resumo_(reg)));
  }
  var corpo =
    '<p>Olá, <strong>' + esc_(reg.nome) + '</strong>. Confirme que este e-mail é seu para enviar a solicitação ao GSEL.</p>' +
    tabela_(resumo_(reg)) +
    '<div id="acoes"><button type="button" id="enviar" class="botao">Confirmar e-mail e enviar solicitação</button></div>' +
    '<p id="resposta" class="resposta" role="status"></p>';
  var script =
    'var token = ' + jsonScript_(String(token)) + ';\n' +
    'var botao = document.getElementById("enviar");\n' +
    'botao.addEventListener("click", function () {\n' +
    '  botao.disabled = true; botao.textContent = "Enviando...";\n' +
    '  google.script.run\n' +
    '    .withSuccessHandler(mostrar)\n' +
    '    .withFailureHandler(function () { mostrar({ ok: false, mensagem: "Não foi possível concluir agora. Tente novamente em alguns minutos." }); })\n' +
    '    .confirmarEmail(token);\n' +
    '});\n' + SCRIPT_RESPOSTA_;
  return pagina_('Confirme sua solicitação', corpo, script);
}

function paginaDecidir_(token, sugestao) {
  var aba = planilha_();
  var reg = buscarPor_(aba, 'token_decisao', token);
  if (!reg) return pagina_('Link inválido', '<p>Não encontramos esta solicitação.</p>');
  if (reg.status !== STATUS.AUTORIZAR) {
    var quando = reg.decidida_em instanceof Date ? ' em ' + dataHora_(reg.decidida_em) : '';
    return pagina_('Solicitação já respondida',
      '<p>Situação: <strong>' + esc_(reg.status) + '</strong>' + esc_(quando) + '.</p>' + tabela_(resumo_(reg)));
  }
  var recusar = sugestao === 'recusar';
  var corpo =
    '<p>' + esc_(reg.nome) + ' confirmou o e-mail e solicita a reserva de <strong>' + esc_(reg.equipamento) + '</strong>.</p>' +
    tabela_(resumo_(reg)) +
    '<form id="decisao" class="decisao">' +
    '<fieldset><legend>Decisão</legend>' +
    '<label class="opcao"><input type="radio" name="decisao" value="aprovar"' + (recusar ? '' : ' checked') + '> Autorizar a reserva</label>' +
    '<label class="opcao"><input type="radio" name="decisao" value="recusar"' + (recusar ? ' checked' : '') + '> Recusar a solicitação</label>' +
    '</fieldset>' +
    '<label for="mensagem" class="rotulo">Mensagem para o solicitante (opcional)</label>' +
    '<textarea id="mensagem" maxlength="1500" rows="4" placeholder="Ex.: a bancada estará disponível na data pedida, das 14h às 17h."></textarea>' +
    '<button type="submit" id="enviar" class="botao">Registrar decisão e avisar o solicitante</button>' +
    '</form>' +
    '<p id="resposta" class="resposta" role="status"></p>';
  var script =
    'var token = ' + jsonScript_(String(token)) + ';\n' +
    'var botao = document.getElementById("enviar");\n' +
    'document.getElementById("decisao").addEventListener("submit", function (e) {\n' +
    '  e.preventDefault();\n' +
    '  var escolha = document.querySelector("input[name=decisao]:checked").value;\n' +
    '  botao.disabled = true; botao.textContent = "Registrando...";\n' +
    '  google.script.run\n' +
    '    .withSuccessHandler(mostrar)\n' +
    '    .withFailureHandler(function () { mostrar({ ok: false, mensagem: "Não foi possível registrar agora. Tente novamente em alguns minutos." }); })\n' +
    '    .registrarDecisao(token, escolha, document.getElementById("mensagem").value);\n' +
    '});\n' + SCRIPT_RESPOSTA_;
  return pagina_('Autorizar reserva', corpo, script);
}

var SCRIPT_RESPOSTA_ =
  'function mostrar(r) {\n' +
  '  var p = document.getElementById("resposta");\n' +
  '  p.textContent = r.mensagem;\n' +
  '  p.className = "resposta " + (r.ok ? "ok" : "erro");\n' +
  '  var acoes = document.getElementById("acoes") || document.getElementById("decisao");\n' +
  '  if (r.ok && acoes) acoes.parentNode.removeChild(acoes);\n' +
  '  var botao = document.getElementById("enviar");\n' +
  '  if (!r.ok && botao) { botao.disabled = false; botao.textContent = "Tentar novamente"; }\n' +
  '}\n';

function tabela_(linhas) {
  return '<table class="resumo">' + linhas.map(function (l) {
    return '<tr><th scope="row">' + esc_(l[0]) + '</th><td>' + quebras_(esc_(l[1])) + '</td></tr>';
  }).join('') + '</table>';
}

function pagina_(titulo, corpo, script) {
  var html = '<!DOCTYPE html><html lang="pt-BR"><head><base target="_top">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Saira+Semi+Condensed:wght@700;800&family=Saira:wght@400;600&display=swap" rel="stylesheet">' +
    '<style>' + CSS_PAGINA_ + '</style></head><body>' +
    '<main class="cartao"><header class="topo"><span class="marca">GSEL</span><span class="sub">LabSEL · Reserva de equipamentos</span></header>' +
    '<div class="conteudo"><h1>' + esc_(titulo) + '</h1>' + corpo + '</div>' +
    '<footer class="rodape"><a href="' + esc_(CONFIG.SITE_URL) + '">Site do GSEL</a></footer></main>' +
    (script ? '<script>' + script + '</script>' : '') +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(titulo + ' · GSEL')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

var CSS_PAGINA_ = [
  '*{box-sizing:border-box}',
  'body{margin:0;padding:32px 16px;background:' + COR.nevoa + ';font-family:Saira,Arial,sans-serif;font-size:16px;line-height:1.6;color:' + COR.texto + '}',
  '.cartao{max-width:640px;margin:0 auto;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 20px 40px -20px rgba(20,43,71,.35)}',
  '.topo{display:flex;flex-direction:column;padding:20px 28px;background:' + COR.azul + ';border-bottom:4px solid ' + COR.ciano + '}',
  '.marca{font-family:"Saira Semi Condensed",Arial,sans-serif;font-weight:800;font-size:28px;letter-spacing:.04em;color:#fff}',
  '.sub{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:' + COR.ciano + '}',
  '.conteudo{padding:28px}',
  'h1{margin:0 0 12px;font-family:"Saira Semi Condensed",Arial,sans-serif;font-weight:800;font-size:26px;line-height:1.2;color:' + COR.azul + '}',
  'a{color:' + COR.eletrico + '}',
  '.resumo{width:100%;margin:20px 0;border-collapse:collapse;font-size:15px}',
  '.resumo th{width:38%;padding:8px 12px 8px 0;border-bottom:1px solid #e3e9ef;text-align:left;font-weight:400;vertical-align:top;color:' + COR.grafite + '}',
  '.resumo td{padding:8px 0;border-bottom:1px solid #e3e9ef;color:' + COR.azul + '}',
  '.botao{display:inline-block;margin-top:8px;padding:14px 26px;border:0;border-radius:12px;background:' + COR.azul + ';color:#fff;font:600 16px Saira,Arial,sans-serif;cursor:pointer}',
  '.botao:hover{background:' + COR.eletrico + '}',
  '.botao:disabled{opacity:.6;cursor:wait}',
  '.decisao fieldset{margin:0 0 16px;padding:0;border:0}',
  '.decisao legend{margin-bottom:8px;font-weight:600;color:' + COR.azul + '}',
  '.opcao{display:block;margin:6px 0;padding:12px 14px;border:2px solid #dde4eb;border-radius:12px;cursor:pointer}',
  '.opcao:has(input:checked){border-color:' + COR.ciano + ';background:#e3f6f9}',
  '.rotulo{display:block;margin-bottom:6px;font-weight:600;color:' + COR.azul + '}',
  'textarea{width:100%;padding:12px 14px;border:1px solid #c9d4de;border-radius:12px;font:inherit;color:' + COR.azul + '}',
  '.resposta{margin:16px 0 0;font-weight:600}',
  '.resposta:empty{display:none}',
  '.resposta.ok{padding:14px 16px;border-left:4px solid ' + COR.ciano + ';background:#e3f6f9;color:' + COR.azul + '}',
  '.resposta.erro{padding:14px 16px;border-left:4px solid #c93a3a;background:#fff3f3;color:#8f2525}',
  '.rodape{padding:16px 28px;background:' + COR.nevoa + ';font-size:14px}'
].join('');

/* ---------- Utilidades ---------- */

function urlServico_() {
  return CONFIG.URL_SERVICO || ScriptApp.getService().getUrl();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function esc_(valor) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function quebras_(html) {
  return html.replace(/\r?\n/g, '<br>');
}

function jsonScript_(valor) {
  return JSON.stringify(valor).replace(/</g, '\\u003c');
}

function dataHora_(data) {
  return Utilities.formatDate(data, CONFIG.FUSO, "dd/MM/yyyy 'às' HH:mm");
}
