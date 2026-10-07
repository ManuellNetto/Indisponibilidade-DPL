// ===== Configurações =====
const ARQUIVO_CSV = "dados.csv";
const FILTRO_PADRAO = "GSTC";

// ===== Registra o plugin de datalabels UMA vez, globalmente =====
Chart.register(ChartDataLabels);

// Desativa datalabels por padrão (só ligamos nos gráficos que queremos)
Chart.defaults.plugins.datalabels = { display: false };

// ===== Estado global =====
let dadosCompletos = [];
let filtroGerencia = FILTRO_PADRAO;
let filtroMes = "TODOS";
let filtroSeccional = "TODAS";
let filtroSegmento = "TODOS";

// Filtros cruzados (cliques nos gráficos)
let filtrosCruzados = {
    base: null,
    faixa: null,
    tipo: null,
    equipe: null,
    diaSemana: null,
    periodo: null
};

// Gráficos
let graficoBase = null;
let graficoFaixa = null;
let graficoTipos = null;
let graficoEquipes = null;
let graficoPeriodos = null;
let graficoDias = null;

const MESES_NOMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];


// Configuração do datalabels para barras VERTICAIS (rótulo em cima da barra)
const DATALABELS_VERTICAL = {
    display: true,
    color: "#f1f5f9",
    font: { weight: "600", size: 12 },
    anchor: "end",
    align: "top",
    offset: 4,
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderRadius: 4,
    padding: { top: 3, bottom: 3, left: 6, right: 6 },
    formatter: (value) => Number(value).toLocaleString("pt-BR")
};




// ===== Configuração padrão do datalabels (rótulo puro, na ponta externa) =====
const DATALABELS_HORIZONTAL = {
    display: true,
    color: "#f1f5f9",
    font: { weight: "600", size: 12 },
    anchor: "end",
    align: "right",
    offset: 4,
    formatter: (value) => Number(value).toLocaleString("pt-BR")
};

// ===== Função principal =====
function iniciarDashboard() {
    Papa.parse(ARQUIVO_CSV, {
        download: true,
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: function (resultado) {
            if (resultado.errors.length > 0) {
                console.error("Erros ao ler o CSV:", resultado.errors);
            }
            dadosCompletos = resultado.data;
            console.log("Total de linhas lidas do CSV:", dadosCompletos.length);

            configurarFiltrosGerencia();
            atualizarOpcoesFiltros();
            aplicarFiltros();
        },
        error: function (erro) {
            console.error("Erro ao carregar o CSV:", erro);
            document.getElementById("totalGeral").textContent = "Erro";
            document.getElementById("totalTotal").textContent = "Erro";
            document.getElementById("totalParcial").textContent = "Erro";
        }
    });
}

// ===== Helpers de data/hora =====
function extrairMes(linha) {
    const dataStr = (linha.DATA || "").trim();
    if (!dataStr) return null;
    const partes = dataStr.split("/");
    if (partes.length !== 3) return null;
    const mes = parseInt(partes[1], 10);
    const ano = partes[2];
    if (isNaN(mes) || mes < 1 || mes > 12) return null;
    return `${ano}-${String(mes).padStart(2, "0")}`;
}

function formatarMes(mesChave) {
    if (!mesChave || mesChave === "TODOS") return "Todos";
    const [ano, mes] = mesChave.split("-");
    return `${MESES_NOMES[parseInt(mes, 10) - 1]}/${ano}`;
}

function extrairDiaSemana(linha) {
    const dataStr = (linha.DATA || "").trim();
    if (!dataStr) return null;
    const partes = dataStr.split("/");
    if (partes.length !== 3) return null;
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const ano = parseInt(partes[2], 10);
    const dataObj = new Date(ano, mes, dia);
    if (isNaN(dataObj.getTime())) return null;
    return dataObj.getDay();
}

function extrairPeriodo(linha) {
    const inicio = (linha.INICIO || "").trim();
    if (!inicio) return null;
    const partes = inicio.split(":");
    if (partes.length < 2) return null;
    const hora = parseInt(partes[0], 10);
    if (isNaN(hora)) return null;
    if (hora >= 6 && hora < 12) return "Manhã";
    if (hora >= 12 && hora < 18) return "Tarde";
    return "Noite";
}

// ===== Botões de gerência + listeners dos selects =====
function configurarFiltrosGerencia() {
    const botoes = document.querySelectorAll(".filtro-btn");

    botoes.forEach(botao => {
        botao.addEventListener("click", function () {
            botoes.forEach(b => b.classList.remove("ativo"));
            this.classList.add("ativo");

            filtroGerencia = this.getAttribute("data-filtro");

            filtroMes = "TODOS";
            filtroSeccional = "TODAS";
            filtroSegmento = "TODOS";
            limparFiltrosCruzados(false);

            atualizarOpcoesFiltros();
            aplicarFiltros();
        });
    });

    document.getElementById("filtroMes").addEventListener("change", function () {
        filtroMes = this.value;
        filtroSeccional = "TODAS";
        filtroSegmento = "TODOS";
        limparFiltrosCruzados(false);
        atualizarOpcoesFiltros();
        aplicarFiltros();
    });

    document.getElementById("filtroSeccional").addEventListener("change", function () {
        filtroSeccional = this.value;
        filtroSegmento = "TODOS";
        limparFiltrosCruzados(false);
        atualizarOpcoesFiltros();
        aplicarFiltros();
    });

    document.getElementById("filtroSegmento").addEventListener("change", function () {
        filtroSegmento = this.value;
        limparFiltrosCruzados(false);
        aplicarFiltros();
    });

    document.getElementById("btnLimparCruzados").addEventListener("click", function () {
        limparFiltrosCruzados(true);
    });
}

// ===== Dados filtrados apenas por gerência/mês (para popular selects) =====
function dadosParaPopularSelects() {
    let dados = dadosCompletos;

    if (filtroGerencia !== "TODAS") {
        dados = dados.filter(linha =>
            (linha.GERENCIA || "").trim().toUpperCase() === filtroGerencia.toUpperCase()
        );
    }
    if (filtroMes !== "TODOS") {
        dados = dados.filter(linha => extrairMes(linha) === filtroMes);
    }
    return dados;
}

// ===== Popula os selects em cascata =====
function atualizarOpcoesFiltros() {
    const baseParaSelects = dadosParaPopularSelects();

    // --- MÊS ---
    const mesesUnicos = [...new Set(baseParaSelects.map(extrairMes).filter(Boolean))].sort();
    const selectMes = document.getElementById("filtroMes");
    const valorMesAnterior = filtroMes;
    selectMes.innerHTML = '<option value="TODOS">Todos</option>';
    mesesUnicos.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = formatarMes(m);
        selectMes.appendChild(opt);
    });
    selectMes.value = mesesUnicos.includes(valorMesAnterior) ? valorMesAnterior : "TODOS";
    filtroMes = selectMes.value;

    // --- SECCIONAL ---
    let baseParaSeccional = baseParaSelects;
    if (filtroMes !== "TODOS") {
        baseParaSeccional = baseParaSeccional.filter(linha => extrairMes(linha) === filtroMes);
    }
    const seccionaisUnicas = [...new Set(
        baseParaSeccional.map(linha => (linha.base || "").trim()).filter(Boolean)
    )].sort();
    const selectSeccional = document.getElementById("filtroSeccional");
    const valorSeccionalAnterior = filtroSeccional;
    selectSeccional.innerHTML = '<option value="TODAS">Todas</option>';
    seccionaisUnicas.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        selectSeccional.appendChild(opt);
    });
    selectSeccional.value = seccionaisUnicas.includes(valorSeccionalAnterior)
        ? valorSeccionalAnterior
        : "TODAS";
    filtroSeccional = selectSeccional.value;

    // --- SEGMENTO ---
    let baseParaSegmento = baseParaSeccional;
    if (filtroSeccional !== "TODAS") {
        baseParaSegmento = baseParaSegmento.filter(linha =>
            (linha.base || "").trim() === filtroSeccional
        );
    }
    const segmentosUnicos = [...new Set(
        baseParaSegmento.map(linha => (linha.SEGMENTO || "").trim()).filter(Boolean)
    )].sort();
    const selectSegmento = document.getElementById("filtroSegmento");
    const valorSegmentoAnterior = filtroSegmento;
    selectSegmento.innerHTML = '<option value="TODOS">Todos</option>';
    segmentosUnicos.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        selectSegmento.appendChild(opt);
    });
    selectSegmento.value = segmentosUnicos.includes(valorSegmentoAnterior)
        ? valorSegmentoAnterior
        : "TODOS";
    filtroSegmento = selectSegmento.value;
}

// ===== Aplica TODOS os filtros (nativos + cruzados) =====
function aplicarFiltros() {
    let dadosFiltrados = dadosCompletos;

    // Filtros nativos
    if (filtroGerencia !== "TODAS") {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.GERENCIA || "").trim().toUpperCase() === filtroGerencia.toUpperCase()
        );
    }
    if (filtroMes !== "TODOS") {
        dadosFiltrados = dadosFiltrados.filter(linha => extrairMes(linha) === filtroMes);
    }
    if (filtroSeccional !== "TODAS") {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.base || "").trim() === filtroSeccional
        );
    }
    if (filtroSegmento !== "TODOS") {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.SEGMENTO || "").trim() === filtroSegmento
        );
    }

    // Filtros cruzados
    if (filtrosCruzados.base) {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.base || "").trim() === filtrosCruzados.base
        );
    }
    if (filtrosCruzados.faixa) {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.faixa_indisp || "").trim() === filtrosCruzados.faixa
        );
    }
    if (filtrosCruzados.tipo) {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.TIPO_DE_INDISPONIBILIDADE || "").trim() === filtrosCruzados.tipo
        );
    }
    if (filtrosCruzados.equipe) {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.EQUIPE || "").trim() === filtrosCruzados.equipe
        );
    }
    if (filtrosCruzados.diaSemana !== null && filtrosCruzados.diaSemana !== undefined) {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            extrairDiaSemana(linha) === filtrosCruzados.diaSemana
        );
    }
    if (filtrosCruzados.periodo) {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            extrairPeriodo(linha) === filtrosCruzados.periodo
        );
    }

    atualizarInfoFiltro(dadosFiltrados.length);
    renderizarChipsCruzados();

    renderizarCards(dadosFiltrados);
    renderizarGraficoBase(dadosFiltrados);
    renderizarGraficoFaixa(dadosFiltrados);
    renderizarGraficoTipos(dadosFiltrados);
    renderizarGraficoEquipes(dadosFiltrados);
    renderizarGraficoPeriodos(dadosFiltrados);
    renderizarGraficoDias(dadosFiltrados);
}

// ===== Texto "Exibindo: ..." =====
function atualizarInfoFiltro(qtd) {
    const partes = [];
    partes.push(filtroGerencia === "TODAS" ? "Todas as gerências" : filtroGerencia);
    if (filtroMes !== "TODOS") partes.push(formatarMes(filtroMes));
    if (filtroSeccional !== "TODAS") partes.push("Secc: " + filtroSeccional);
    if (filtroSegmento !== "TODOS") partes.push("Seg: " + filtroSegmento);

    document.getElementById("infoFiltro").textContent =
        `Exibindo: ${partes.join(" • ")} (${qtd.toLocaleString("pt-BR")} registros)`;
}

// ===== Chips de filtros cruzados =====
function renderizarChipsCruzados() {
    const area = document.getElementById("areaChipsCruzados");
    const lista = document.getElementById("listaChips");
    lista.innerHTML = "";

    const mapaLabels = {
        base: "Base",
        faixa: "Faixa",
        tipo: "Tipo",
        equipe: "Equipe",
        diaSemana: "Dia",
        periodo: "Período"
    };

    let temAlgum = false;

    Object.keys(filtrosCruzados).forEach(chave => {
        const valor = filtrosCruzados[chave];
        if (valor === null || valor === undefined) return;
        temAlgum = true;

        let textoValor = valor;
        if (chave === "diaSemana") textoValor = NOMES_DIAS[valor];

        const chip = document.createElement("div");
        chip.className = "chip";
        chip.innerHTML = `
            <span>${mapaLabels[chave]}: <strong>${textoValor}</strong></span>
            <button class="chip-remover" data-chave="${chave}" title="Remover filtro">✕</button>
        `;
        lista.appendChild(chip);
    });

    area.style.display = temAlgum ? "flex" : "none";

    lista.querySelectorAll(".chip-remover").forEach(btn => {
        btn.addEventListener("click", function () {
            const chave = this.getAttribute("data-chave");
            filtrosCruzados[chave] = null;
            aplicarFiltros();
        });
    });
}

// ===== Limpar filtros cruzados =====
function limparFiltrosCruzados(reRenderizar) {
    filtrosCruzados = {
        base: null,
        faixa: null,
        tipo: null,
        equipe: null,
        diaSemana: null,
        periodo: null
    };
    if (reRenderizar) aplicarFiltros();
}

// ===== Alterna um filtro cruzado (clicou de novo = remove) =====
function alternarFiltroCruzado(chave, valor) {
    if (filtrosCruzados[chave] === valor) {
        filtrosCruzados[chave] = null;
    } else {
        filtrosCruzados[chave] = valor;
    }
    aplicarFiltros();
}

// ===== Renderiza os 3 cards =====
function renderizarCards(dados) {
    const totalGeral = dados.length;
    let totalTotal = 0;
    let totalParcial = 0;

    dados.forEach(linha => {
        const tipo = (linha.TIPO_INDISPONIBILIDADE_DIA || "").trim().toUpperCase();
        if (tipo === "TOTAL") totalTotal++;
        else if (tipo === "PARCIAL") totalParcial++;
    });

    document.getElementById("totalGeral").textContent = totalGeral.toLocaleString("pt-BR");
    document.getElementById("totalTotal").textContent = totalTotal.toLocaleString("pt-BR");
    document.getElementById("totalParcial").textContent = totalParcial.toLocaleString("pt-BR");
}

/* =========================================================
   GRÁFICOS
   ========================================================= */

// ====== 1. Volume por Base ======
function renderizarGraficoBase(dados) {
    const contagem = {};
    dados.forEach(linha => {
        const base = (linha.base || "Sem base").trim();
        contagem[base] = (contagem[base] || 0) + 1;
    });

    const labels = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
    const valores = labels.map(base => contagem[base]);

    if (graficoBase) graficoBase.destroy();
    const ctx = document.getElementById("graficoBase").getContext("2d");

    graficoBase = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Ocorrências",
                data: valores,
                backgroundColor: "rgba(0, 17, 252, 0.62)",
                borderColor: "rgb(0, 17, 252)",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements.length) return;
                alternarFiltroCruzado("base", labels[elements[0].index]);
            },
            plugins: {
                legend: { display: false },
                datalabels: { ...DATALABELS_HORIZONTAL },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.x.toLocaleString("pt-BR") + " ocorrências" }
                }
            },
          scales: {
    x: {
        beginAtZero: true,
        suggestedMax: Math.max(...valores) * 1.1,   // 👈 adiciona isto
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(51, 65, 85, 0.5)" }
    },
    y: { ticks: { color: "#f1f5f9", font: { size: 13 } }, grid: { display: false } }
}
        }
    });
}

// ====== 2. Faixa de Indisponibilidade ======
function renderizarGraficoFaixa(dados) {
    const ordemFaixas = ["< 2h", "2 a 4h", "4 a 6h", "> 6h"];
    const contagem = {};
    ordemFaixas.forEach(f => contagem[f] = 0);

    dados.forEach(linha => {
        const faixa = (linha.faixa_indisp || "").trim();
        if (contagem.hasOwnProperty(faixa)) contagem[faixa]++;
    });

    const valores = ordemFaixas.map(f => contagem[f]);

    if (graficoFaixa) graficoFaixa.destroy();
    const ctx = document.getElementById("graficoFaixa").getContext("2d");

    graficoFaixa = new Chart(ctx, {
        type: "line",
        data: {
            labels: ordemFaixas,
            datasets: [{
                label: "Ocorrências",
                data: valores,
                borderColor: "rgb(0, 17, 252)",
                backgroundColor: "rgba(20, 39, 146, 0.75)",
                borderWidth: 3,
                tension: 0.35,
                pointBackgroundColor: "rgb(0, 132, 252)",
                pointBorderColor: "#1e293b",
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 9,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements.length) return;
                alternarFiltroCruzado("faixa", ordemFaixas[elements[0].index]);
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.y.toLocaleString("pt-BR") + " ocorrências" }
                }
            },
            scales: {
                x: { ticks: { color: "#94a3b8", font: { size: 13 } }, grid: { color: "rgba(51, 65, 85, 0.5)" } },
                y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(51, 65, 85, 0.5)" } }
            }
        }
    });
}

// ====== 3. Top 10 Tipos ======
function renderizarGraficoTipos(dados) {
    const contagem = {};
    dados.forEach(linha => {
        const tipo = (linha.TIPO_DE_INDISPONIBILIDADE || "Não informado").trim() || "Não informado";
        contagem[tipo] = (contagem[tipo] || 0) + 1;
    });

    const labels = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]).slice(0, 10);
    const valores = labels.map(tipo => contagem[tipo]);

    if (graficoTipos) graficoTipos.destroy();
    const ctx = document.getElementById("graficoTipos").getContext("2d");

    graficoTipos = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Ocorrências",
                data: valores,
                backgroundColor: "rgba(255, 52, 1, 0.66)",
                borderColor: "rgba(184, 48, 6, 0.97)",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements.length) return;
                alternarFiltroCruzado("tipo", labels[elements[0].index]);
            },
            plugins: {
                legend: { display: false },
                datalabels: { ...DATALABELS_HORIZONTAL },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.x.toLocaleString("pt-BR") + " ocorrências" }
                }
            },
           scales: {
    x: {
        beginAtZero: true,
        suggestedMax: Math.max(...valores) * 1.0,   // 👈 adiciona isto
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(51, 65, 85, 0.5)" }
    },
    y: { ticks: { color: "#f1f5f9", font: { size: 13 } }, grid: { display: false } }
}
        }
    });
}

// ====== 4. Top 15 Equipes ======
function renderizarGraficoEquipes(dados) {
    const contagem = {};
    dados.forEach(linha => {
        const equipe = (linha.EQUIPE || "Não informada").trim() || "Não informada";
        contagem[equipe] = (contagem[equipe] || 0) + 1;
    });

    const labels = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]).slice(0, 15);
    const valores = labels.map(eq => contagem[eq]);

    if (graficoEquipes) graficoEquipes.destroy();
    const ctx = document.getElementById("graficoEquipes").getContext("2d");

    graficoEquipes = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Ocorrências",
                data: valores,
                backgroundColor: "rgba(43, 228, 126, 0.6)",
                borderColor: "rgb(0, 252, 168)",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements.length) return;
                alternarFiltroCruzado("equipe", labels[elements[0].index]);
            },
            plugins: {
                legend: { display: false },
                datalabels: { ...DATALABELS_HORIZONTAL },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.x.toLocaleString("pt-BR") + " ocorrências" }
                }
            },
            scales: {
                x: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(51, 65, 85, 0.5)" } },
                y: { ticks: { color: "#f1f5f9", font: { size: 12 }, autoSkip: false }, grid: { display: false } }
            }
        }
    });
}

// ====== 5. Volume por Período do Dia ======
// "Não informado" foi removido — apenas Manhã / Tarde / Noite
function renderizarGraficoPeriodos(dados) {
    const periodos = ["Manhã", "Tarde", "Noite"];
    const contagem = { "Manhã": 0, "Tarde": 0, "Noite": 0 };

    dados.forEach(linha => {
        const p = extrairPeriodo(linha);
        if (p) contagem[p]++;
    });

    const valores = periodos.map(p => contagem[p]);
    const cores = [
        "rgba(255, 0, 43, 0.78)",
        "rgba(233, 147, 19, 0.73)",
        "rgb(194, 187, 86)"
    ];

    if (graficoPeriodos) graficoPeriodos.destroy();
    const ctx = document.getElementById("graficoPeriodos").getContext("2d");

    graficoPeriodos = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: periodos,
            datasets: [{
                label: "Ocorrências",
                data: valores,
                backgroundColor: cores,
                borderColor: "#1e293b",
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (evt, elements) => {
                if (!elements.length) return;
                alternarFiltroCruzado("periodo", periodos[elements[0].index]);
            },
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.toLocaleString("pt-BR") + " ocorrências" }
                }
            }
        }
    });
}

// ====== 6. Volume por Dia da Semana ======
function renderizarGraficoDias(dados) {
    const contagem = [0, 0, 0, 0, 0, 0, 0];

    dados.forEach(linha => {
        const dia = extrairDiaSemana(linha);
        if (dia !== null) contagem[dia]++;
    });

    // Ordem de exibição: Segunda → Domingo
    const ordemExibicao = [1, 2, 3, 4, 5, 6, 0];
    const labelsExibicao = ordemExibicao.map(i => NOMES_DIAS[i]);
    const valoresExibicao = ordemExibicao.map(i => contagem[i]);

    if (graficoDias) graficoDias.destroy();
    const ctx = document.getElementById("graficoDias").getContext("2d");

    graficoDias = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labelsExibicao,
            datasets: [{
                label: "Ocorrências",
                data: valoresExibicao,
                backgroundColor: "rgba(131, 46, 243, 0.6)",
                borderColor: "rgba(173, 0, 253, 0.54)",
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (evt, elements) => {
        if (!elements.length) return;
        const idxExibicao = elements[0].index;
        alternarFiltroCruzado("diaSemana", ordemExibicao[idxExibicao]);
    },
    plugins: {
        legend: { display: false },
        datalabels: { ...DATALABELS_VERTICAL },   // 👈 adiciona isto
        tooltip: {
            callbacks: { label: ctx => ctx.parsed.y.toLocaleString("pt-BR") + " ocorrências" }
        }
    },
    scales: {
        x: { ticks: { color: "#f1f5f9", font: { size: 13 } }, grid: { display: false } },
        y: {
            beginAtZero: true,
            suggestedMax: Math.max(...valoresExibicao) * 1.1,   // 👈 respiro pra o rótulo
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(51, 65, 85, 0.5)" }
        }
    }
}
    });
}

// ===== Inicia =====
iniciarDashboard();
