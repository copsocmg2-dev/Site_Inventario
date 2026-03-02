// ============================================================
// CONTROLE DE ATIVOS MG2 - BACKEND COMPLETO (OTIMIZADO)
// ============================================================

function doGet(e) {
  const page = e && e.parameter ? e.parameter.page : null;
  if (page === 'lider') {
    return HtmlService.createHtmlOutputFromFile('IndexLider')
        .setTitle('PDA Control | Líder')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
  }
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Controle de Ativos | Dashboard Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Helper para travar o script e evitar conflitos de concorrência (FILA)
function _executarComTrava(fn) {
  const lock = LockService.getScriptLock();
  try {
    // Espera até 30 segundos para conseguir a vez na fila
    lock.waitLock(30000);
    return fn();
  } catch (e) {
    console.error("Erro de concorrência: " + e.toString());
    throw new Error("O sistema está com muito tráfego no momento. Aguarde 5 segundos e tente de novo.");
  } finally {
    lock.releaseLock();
  }
}

function setupPlanilha() {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abas = {
      "Lideres":        ["Nome", "Area"],
      "Estoque":        ["SN", "Modelo", "Status", "Data", "Obs"],
      "Ativos_Atuais":  ["SN", "Responsavel", "Data"],
      "Movimentacoes":  ["ID", "SN", "Responsavel", "Tipo", "Data", "Admin", "Condicao", "Obs"],
      "Solicitacoes":   ["ID", "Data", "Lider", "Quantidade", "Status", "Obs", "ObsAdmin"],
      "Trocas":         ["ID", "Data", "LiderOrigem", "LiderDestino", "SNs", "StatusOrigem", "StatusDestino", "StatusGeral"],
      "Planejamento":   ["Chave", "Data", "Turno", "Area", "Quantidade"],
      "Areas":          ["Area"]
    };
    for (const [nome, cabecalhos] of Object.entries(abas)) {
      let aba = ss.getSheetByName(nome);
      if (!aba) {
        aba = ss.insertSheet(nome);
        aba.appendRow(cabecalhos);
      } else {
        // Garante que Lideres tem a coluna Area
        if (nome === "Lideres") {
          const lCol = aba.getLastColumn();
          if (lCol < 2) {
            aba.getRange(1, 2).setValue("Area");
          }
        }
      }
    }
    return { success: true, msg: "Planilhas e colunas sincronizadas!" };
  });
}

/**
 * Retorna as informações operacionais baseadas no horário (T1, T2, T3)
 * T3: 22h às 05h (Se for madrugada, a data operacional é o dia anterior)
 */
function _getInfoOperacional(dataRef = new Date()) {
  const h = dataRef.getHours();
  let turno = "";
  let dataOp = new Date(dataRef);
  
  if (h >= 6 && h < 14) {
    turno = "T1";
  } else if (h >= 14 && h < 22) {
    turno = "T2";
  } else {
    turno = "T3";
    // Se for entre 00h e 04:59h, considera dia anterior
    if (h < 5) {
      dataOp.setDate(dataOp.getDate() - 1);
    }
  }
  
  const dataStr = Utilities.formatDate(dataOp, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return { turno, dataOperacional: dataStr, timestamp: dataOp };
}

function getAppData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Cache de dados para evitar múltiplas chamadas à planilha
  const getValues = (name) => {
    const s = ss.getSheetByName(name);
    return s ? s.getDataRange().getValues() : [];
  };

  const dadosLideres = getValues("Lideres");
  let lideres = [];
  let areaDeLider = {}; // { "NOME": "AREA" }
  for (let i = 1; i < dadosLideres.length; i++) {
    let nome = String(dadosLideres[i][0]).trim();
    let area = String(dadosLideres[i][1] || "Sem Área").trim();
    if (nome) {
      lideres.push(nome);
      areaDeLider[nome] = area;
    }
  }

  const dadosAtivos = getValues("Ativos_Atuais");
  let emprestimosAtivos = [];
  for (let i = 1; i < dadosAtivos.length; i++) {
    let sn = String(dadosAtivos[i][0]).trim();
    let resp = String(dadosAtivos[i][1]).trim();
    let dataEmp = String(dadosAtivos[i][2]);
    if (sn && resp) emprestimosAtivos.push({ sn, responsavel: resp, data: dataEmp });
  }

  const dadosEstoque = getValues("Estoque");
  let estoque = [];
  let total = 0, disponiveis = 0, emprestados = 0, quebrados = 0;
  for (let i = 1; i < dadosEstoque.length; i++) {
    let sn = String(dadosEstoque[i][0]).trim();
    let modelo = String(dadosEstoque[i][1]).trim();
    let status = String(dadosEstoque[i][2]).trim();
    let obs = String(dadosEstoque[i][4] || "").trim();
    if (!sn) continue;
    let responsavelAtual = "-";
    if (status === "Emprestado") {
      let emp = emprestimosAtivos.find(e => e.sn === sn);
      if (emp) responsavelAtual = emp.responsavel;
    }
    estoque.push({ sn, modelo, status, responsavelAtual, obs });
    total++;
    if (status === "Disponível") disponiveis++;
    else if (status === "Emprestado") emprestados++;
    else if (status === "Quebrado") quebrados++;
  }

  const dadosSolic = getValues("Solicitacoes");
  let solicitacoes = [];
  for (let i = 1; i < dadosSolic.length; i++) {
    if (!dadosSolic[i][0]) continue;
    solicitacoes.push({
      id: dadosSolic[i][0], data: _fmtData(dadosSolic[i][1]), lider: dadosSolic[i][2],
      qtd: dadosSolic[i][3], status: dadosSolic[i][4], obs: dadosSolic[i][5] || "", obsAdmin: dadosSolic[i][6] || ""
    });
  }
  solicitacoes.reverse();

  // Planejamento (Baseado no turno operacional sugerido se não houver filtro)
  const infoOp = _getInfoOperacional();
  const dadosPlan = getValues("Planejamento");
  
  // Mapear planejamento: { "YYYY-MM-DD_TURNO_AREA": QTD }
  let mapPlan = {};
  dadosPlan.forEach((r, i) => { if (i > 0 && r[0]) mapPlan[String(r[0]).trim()] = Number(r[4] || 0); });

  // Dashboard por Área (Calculado no Real-Time)
  let consolidadoAreas = {}; 
  emprestimosAtivos.forEach(emp => {
    let area = areaDeLider[emp.responsavel] || "Sem Área";
    if (!consolidadoAreas[area]) consolidadoAreas[area] = { area: area, realizado: 0 };
    consolidadoAreas[area].realizado++;
  });

  return { 
    lideres, areaDeLider, estoque, emprestimosAtivos, 
    kpis: { total, disponiveis, emprestados, quebrados }, 
    solicitacoes, trocasAdmin, consolidadoReal: consolidadoAreas, 
    mapPlan, infoOpAtual: infoOp 
  };
}

/**
 * Salva o planejamento de um dia/turno específico
 * @param {string} dataStr YYYY-MM-DD
 * @param {string} turno T1, T2 ou T3
 * @param {Object} dados { "AreaN": Qtd }
 */
function salvarPlanejamento(dataStr, turno, dados) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("Planejamento");
    const rows = aba.getDataRange().getValues();
    
    for (const [area, qtd] of Object.entries(dados)) {
      const chave = `${dataStr}_${turno}_${area}`;
      const idx = rows.findIndex((r, i) => i > 0 && r[0] === chave);
      
      if (idx > -1) {
        aba.getRange(idx + 1, 5).setValue(qtd);
      } else {
        aba.appendRow([chave, dataStr, turno, area, qtd]);
      }
    }
    return { success: true, msg: "Planejamento salvo com sucesso!" };
  });
}

/**
 * Valida se uma ação (entrega/troca) estoura o planejado
 */
function _validarLimitePlanejamento(area, qtdAdicional, dataOp, turnoOp) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaPlan = ss.getSheetByName("Planejamento");
  const dPlan = abaPlan.getDataRange().getValues();
  const chave = `${dataOp}_${turnoOp}_${area}`;
  const linhaPlan = dPlan.find(r => r[0] === chave);
  const planejado = linhaPlan ? Number(linhaPlan[4]) : 0;
  
  if (planejado === 0) return { ok: true }; // Se não tem plano, não bloqueia (ou pode ser regra inversa?)

  // Pegar Realizado Atual da Área
  const ativos = ss.getSheetByName("Ativos_Atuais").getDataRange().getValues();
  const abaLid = ss.getSheetByName("Lideres").getDataRange().getValues();
  let areaDeLider = {};
  abaLid.forEach((r, i) => { if (i > 0) areaDeLider[String(r[0]).trim()] = String(r[1] || "Sem Área").trim(); });
  
  let realizado = 0;
  ativos.forEach((r, i) => {
    if (i > 0) {
      if (areaDeLider[String(r[1]).trim()] === area) realizado++;
    }
  });

  if (realizado + qtdAdicional > planejado) {
    return { 
      ok: false, 
      msg: `Bloqueado! A área ${area} tem ${realizado} PDAs e o planejado para ${turnoOp} é ${planejado}. Limite excedido.` 
    };
  }
  return { ok: true };
}

function registrarEmprestimo(responsavel, listaAtivos) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaLid = ss.getSheetByName("Lideres");
    const dLid = abaLid.getDataRange().getValues();
    const lInfo = dLid.find(r => String(r[0]).trim() === responsavel);
    const area = lInfo ? String(lInfo[1] || "Sem Área").trim() : "Sem Área";
    
    // Validação de Planejamento (Baseado no tempo real)
    const infoOp = _getInfoOperacional();
    const valida = _validarLimitePlanejamento(area, listaAtivos.length, infoOp.dataOperacional, infoOp.turno);
    if (!valida.ok) return { sucesso: 0, erro: valida.msg };

    const abaEstoque = ss.getSheetByName("Estoque");
    const abaMov = ss.getSheetByName("Movimentacoes");
    const abaAtivos = ss.getSheetByName("Ativos_Atuais");
    const dataRange = abaEstoque.getDataRange();
    const dadosEstoque = dataRange.getValues();
    const dataHora = new Date();
    const admin = Session.getActiveUser().getEmail() || "SISTEMA";
    let sucesso = 0, erros = [];

    listaAtivos.forEach(ativo => {
      let sn = String(ativo.sn).trim().toUpperCase();
      let forcar = ativo.forcar || false, obs = ativo.obs || "";
      let idx = dadosEstoque.findIndex((r, i) => i > 0 && String(r[0]).trim().toUpperCase() === sn);
      
      if (idx > -1) {
        let statusAtual = String(dadosEstoque[idx][2]).trim();
        if (statusAtual === "Disponível" || forcar) {
          abaEstoque.getRange(idx + 1, 3).setValue("Emprestado");
          abaEstoque.getRange(idx + 1, 5).setValue(obs);
          abaMov.appendRow([Utilities.getUuid(), sn, responsavel, "Saída", dataHora, admin, "", obs]);
          if (forcar) {
            const ativosRows = abaAtivos.getDataRange().getValues();
            const idxJaEmp = ativosRows.findIndex((r, i) => i > 0 && String(r[0]).trim().toUpperCase() === sn);
            if (idxJaEmp > -1) abaAtivos.deleteRow(idxJaEmp + 1);
          }
          abaAtivos.appendRow([sn, responsavel, dataHora]);
          sucesso++;
        } else { erros.push(`SN ${sn}: Já está como '${statusAtual}'.`); }
      } else { erros.push(`SN ${sn}: Não existe no estoque.`); }
    });
    return { sucesso, erros };
  });
}

function registrarDevolucao(responsavelDevolucao, listaAtivos) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaEstoque = ss.getSheetByName("Estoque");
    const abaMov = ss.getSheetByName("Movimentacoes");
    const abaAtivos = ss.getSheetByName("Ativos_Atuais");
    const dadosEstoque = abaEstoque.getDataRange().getValues();
    const dadosAtivos = abaAtivos.getDataRange().getValues();
    const dataHora = new Date();
    const admin = Session.getActiveUser().getEmail() || "SISTEMA";
    let sucesso = 0, erros = [];

    listaAtivos.forEach(ativo => {
      let sn = String(ativo.sn).trim().toUpperCase();
      let condicao = ativo.condicao, obs = ativo.obs, forcar = ativo.forcar || false;
      let idxEst = dadosEstoque.findIndex((r, i) => i > 0 && String(r[0]).trim().toUpperCase() === sn);
      
      if (idxEst > -1) {
        let idxAtivo = dadosAtivos.findIndex((r, i) => i > 0 && String(r[0]).trim().toUpperCase() === sn);
        let respOrig = idxAtivo > -1 ? String(dadosAtivos[idxAtivo][1]) : "Desconhecido";
        
        if (respOrig.toLowerCase().trim() !== responsavelDevolucao.toLowerCase().trim() && !forcar) {
          erros.push(`SN ${sn}: Pertence a ${respOrig}.`); return;
        }
        
        abaEstoque.getRange(idxEst + 1, 3).setValue(condicao === "Quebrado" ? "Quebrado" : "Disponível");
        abaEstoque.getRange(idxEst + 1, 5).setValue(obs);
        if (idxAtivo > -1) abaAtivos.deleteRow(idxAtivo + 1);
        abaMov.appendRow([Utilities.getUuid(), sn, responsavelDevolucao, "Retorno", dataHora, admin, condicao, obs]);
        sucesso++;
      } else { erros.push(`SN ${sn}: Fora do Banco.`); }
    });
    return { sucesso, erros };
  });
}

function criarPedidoEstoque(liderNome, qtd, obs) {
  return _executarComTrava(() => {
    qtd = parseInt(qtd);
    if (!liderNome || !qtd || qtd <= 0) return { success: false, msg: "Dados inválidos." };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("Solicitacoes");
    const id = "SOL-" + new Date().getTime();
    aba.appendRow([id, new Date(), liderNome, qtd, "PENDENTE", obs || "", ""]);
    return { success: true, msg: "Pedido na fila!" };
  });
}

function aprovarOuRejeitarPedido(idPedido, acao, obsAdmin) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("Solicitacoes");
    const rows = aba.getDataRange().getValues();
    const idx = rows.findIndex((r, i) => i > 0 && r[0] == idPedido);
    if (idx === -1) return { success: false, msg: "ID não achado." };
    aba.getRange(idx + 1, 5).setValue(acao);
    aba.getRange(idx + 1, 7).setValue(obsAdmin || "");
    return { success: true, msg: "Status atualizado." };
  });
}

function concluirEntregaLider(idPedido, liderNome, snsBipados) {
  const listaAtivos = snsBipados.map(sn => ({ sn, forcar: false, obs: `Solic: ${idPedido}` }));
  const resultado = registrarEmprestimo(liderNome, listaAtivos); // registrarEmprestimo já tem lock
  
  if (resultado.sucesso > 0) {
    _executarComTrava(() => {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const aba = ss.getSheetByName("Solicitacoes");
      const rows = aba.getDataRange().getValues();
      const idx = rows.findIndex((r, i) => i > 0 && r[0] == idPedido);
      if (idx > -1) aba.getRange(idx + 1, 5).setValue("CONCLUIDO");
    });
  }
  return { success: true, ...resultado };
}

function criarSolicitacaoTroca(liderOrigem, liderDestino, snList) {
  return _executarComTrava(() => {
    if (!liderOrigem || !liderDestino || !snList?.length) return { success: false, msg: "Erro dados." };
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Validação de Planejamento do Destino
    const abaLid = ss.getSheetByName("Lideres").getDataRange().getValues();
    const lDest = abaLid.find(r => String(r[0]).trim() === liderDestino);
    const areaDest = lDest ? String(lDest[1] || "Sem Área").trim() : "Sem Área";

    const infoOp = _getInfoOperacional();
    const valida = _validarLimitePlanejamento(areaDest, snList.length, infoOp.dataOperacional, infoOp.turno);
    if (!valida.ok) return { success: false, msg: valida.msg };

    const id = "TRO-" + new Date().getTime();
    ss.getSheetByName("Trocas").appendRow([id, new Date(), liderOrigem, liderDestino, snList.join(","), "ACEITO", "PENDENTE", "AGUARDANDO"]);
    return { success: true, msg: "Troca enviada!" };
  });
}

function responderTroca(idTroca, liderNome, aceitar) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaTrocas = ss.getSheetByName("Trocas");
    const rows = abaTrocas.getDataRange().getValues();
    const idx = rows.findIndex((r, i) => i > 0 && r[0] == idTroca);
    if (idx === -1) return { success: false, msg: "Troca sumiu." };
    
    const troca = rows[idx];
    const destino = String(troca[3]).trim();
    if (liderNome.toLowerCase() === destino.toLowerCase()) abaTrocas.getRange(idx + 1, 7).setValue(aceitar ? "ACEITO" : "RECUSADO");
    else abaTrocas.getRange(idx + 1, 6).setValue(aceitar ? "ACEITO" : "RECUSADO");
    
    if (!aceitar) { abaTrocas.getRange(idx + 1, 8).setValue("CANCELADO"); return { success: true, msg: "Recusado." }; }
    
    // Checa se ambos OK
    const atual = abaTrocas.getRange(idx + 1, 1, 1, 8).getValues()[0];
    if (atual[5] === "ACEITO" && atual[6] === "ACEITO") {
      abaTrocas.getRange(idx + 1, 8).setValue("PENDENTE_ADMIN");
      return { success: true, msg: "Ambos aceitaram! Agora aguardando aprovação final do Admin." };
    }
    return { success: true, msg: "Respondido." };
  });
}

/**
 * Admin finaliza a troca após o aceite de ambos os líderes.
 */
function aprovarTrocaAdmin(idTroca, aprovado) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const abaTrocas = ss.getSheetByName("Trocas");
    const rows = abaTrocas.getDataRange().getValues();
    const idx = rows.findIndex((r, i) => i > 0 && r[0] == idTroca);
    if (idx === -1) return { success: false, msg: "Troca não encontrada." };
    
    if (!aprovado) {
      abaTrocas.getRange(idx + 1, 8).setValue("REJEITADO_ADMIN");
      return { success: true, msg: "Troca rejeitada pelo administrador." };
    }
    
    const troca = rows[idx];
    const origem = String(troca[2]).trim();
    const destino = String(troca[3]).trim();
    const sns = String(troca[4]).split(",").map(s => s.trim());

    // Pegar área do destino para validar meta
    const abaLid = ss.getSheetByName("Lideres").getDataRange().getValues();
    const lDest = abaLid.find(r => String(r[0]).trim() === destino);
    const areaDest = lDest ? String(lDest[1] || "Sem Área").trim() : "Sem Área";

    const infoOp = _getInfoOperacional();
    const valida = _validarLimitePlanejamento(areaDest, sns.length, infoOp.dataOperacional, infoOp.turno);
    if (!valida.ok) return { success: false, msg: valida.msg };
    
    const abaAt = ss.getSheetByName("Ativos_Atuais");
    const abaMov = ss.getSheetByName("Movimentacoes");
    const atRows = abaAt.getDataRange().getValues();
    const dataHora = new Date();
    const adminEmail = Session.getActiveUser().getEmail() || "ADMIN";

    sns.forEach(sn => {
      let iAt = atRows.findIndex(r => String(r[0]).trim() === sn);
      if (iAt > -1) {
        abaAt.getRange(iAt + 1, 2).setValue(destino);
        abaAt.getRange(iAt + 1, 3).setValue(dataHora);
      } else {
        abaAt.appendRow([sn, destino, dataHora]);
      }
      abaMov.appendRow([Utilities.getUuid(), sn, origem, "Troca-Saída", dataHora, adminEmail, "", `Troca ${idTroca} aprovada admin`]);
      abaMov.appendRow([Utilities.getUuid(), sn, destino, "Troca-Entrada", dataHora, adminEmail, "", `Troca ${idTroca} aprovada admin`]);
    });
    
    abaTrocas.getRange(idx + 1, 8).setValue("CONCLUIDO");
    return { success: true, msg: "Troca aprovada e ativos transferidos!" };
  });
}

function getLiderAppData(liderNome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const getV = n => ss.getSheetByName(n)?.getDataRange().getValues() || [];
  
  const lid = getV("Lideres");
  const meuLider = lid.find(r => String(r[0]).trim().toLowerCase() === liderNome.toLowerCase());
  const minhaArea = meuLider ? String(meuLider[1] || "Sem Área").trim() : "Sem Área";
  
  const ativos = getV("Ativos_Atuais");
  let meus = ativos.filter((r,i) => i>0 && String(r[1]).trim().toLowerCase() === liderNome.toLowerCase()).map(r => ({ sn: r[0], data: _fmtData(r[2]) }));
  
  let colegas = lid.filter((r,i) => i>0 && String(r[0]).trim().toLowerCase() !== liderNome.toLowerCase()).map(r => r[0]);

  const sol = getV("Solicitacoes");
  let pedidos = sol.filter((r,i) => i>0 && String(r[2]).trim().toLowerCase() === liderNome.toLowerCase()).map(r => ({
    id: r[0], data: _fmtData(r[1]), qtd: r[3], status: r[4], obs: r[5], obsAdmin: r[6]
  })).reverse();

  const trc = getV("Trocas");
  let trocas = trc.filter((r,i) => i>0 && (r[7] === "AGUARDANDO" || r[7] === "PENDENTE_ADMIN") && (String(r[2]).toLowerCase() === liderNome.toLowerCase() || String(r[3]).toLowerCase() === liderNome.toLowerCase()))
    .map(r => ({
      id: r[0], data: _fmtData(r[1]), liderOrigem: r[2], liderDestino: r[3],
      sns: String(r[4]).split(","), meuStatus: (String(r[2]).toLowerCase() === liderNome.toLowerCase() ? r[5] : r[6]), 
      ehMinhaProposta: (String(r[2]).toLowerCase() === liderNome.toLowerCase()),
      statusGeral: r[7]
    }));

  const infoOp = _getInfoOperacional();

  const abaAreas = getV("Areas");
  let areasDisponiveis = abaAreas.filter((r, i) => i > 0 && r[0]).map(r => String(r[0]).trim());

  return { success: true, liderNome, minhaArea, infoOp, areasDisponiveis, saldo: meus.length, meusAtivos: meus, colegas, meusPedidos: pedidos, trocasPendentes: trocas };
}

/**
 * Vincula um líder a uma área específica
 */
function vincularAreaLider(liderNome, novaArea) {
  return _executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName("Lideres");
    const data = aba.getDataRange().getValues();
    const idx = data.findIndex((r, i) => i > 0 && String(r[0]).trim().toLowerCase() === liderNome.toLowerCase());
    
    if (idx > -1) {
      aba.getRange(idx + 1, 2).setValue(novaArea);
      return { success: true, msg: `Área atualizada para ${novaArea}` };
    }
    return { success: false, msg: "Líder não encontrado." };
  });
}

function _fmtData(d) {
  try { return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"); } 
  catch(e) { return String(d); }
}
