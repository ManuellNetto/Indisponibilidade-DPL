// ===== Configurações =====
const ARQUIVO_CSV = "dados.csv";
const FILTRO_PADRAO = "GSTC";

// ===== Estado global =====
let dadosCompletos = [];
let filtroGerencia = FILTRO_PADRAO;
let filtroMes = "TODOS";
let filtroSeccional = "TODAS";
let filtroSegmento = "TODOS";

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
            atualizarOpcoesFiltros();   // popula selects com base no filtro inicial
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

// ===== Extrai o mês (ex: "03/2026") da coluna DATA =====
function extrairMes(linha) {
    const dataStr = (linha.DATA || "").trim();
    if (!dataStr) return null;

    const partes = dataStr.split("/");
    if (partes.length !== 3) return null;

    const mes = parseInt(partes[1], 10);
    const ano = partes[2];
    if (isNaN(mes) || mes < 1 || mes > 12) return null;

    // Retorna algo como "2026-03" para ordenar corretamente
    return `${ano}-${String(mes).padStart(2, "0")}`;
}

// ===== Converte "2026-03" em "Março/2026" =====
function formatarMes(mesChave) {
    if (!mesChave || mesChave === "TODOS") return "Todos";
    const [ano, mes] = mesChave.split("-");
    return `${MESES_NOMES[parseInt(mes, 10) - 1]}/${ano}`;
}

// ===== Botões de gerência =====
function configurarFiltrosGerencia() {
    const botoes = document.querySelectorAll(".filtro-btn");

    botoes.forEach(botao => {
        botao.addEventListener("click", function () {
            botoes.forEach(b => b.classList.remove("ativo"));
            this.classList.add("ativo");

            filtroGerencia = this.getAttribute("data-filtro");

            // Reset dos filtros dependentes ao trocar gerência
            filtroMes = "TODOS";
            filtroSeccional = "TODAS";
            filtroSegmento = "TODOS";

            atualizarOpcoesFiltros();
            aplicarFiltros();
        });
    });

    // Listeners dos selects
    document.getElementById("filtroMes").addEventListener("change", function () {
        filtroMes = this.value;
        filtroSeccional = "TODAS";
        filtroSegmento = "TODOS";
        atualizarOpcoesFiltros();
        aplicarFiltros();
    });

    document.getElementById("filtroSeccional").addEventListener("change", function () {
        filtroSeccional = this.value;
        filtroSegmento = "TODOS";
        atualizarOpcoesFiltros();
        aplicarFiltros();
    });

    document.getElementById("filtroSegmento").addEventListener("change", function () {
        filtroSegmento = this.value;
        aplicarFiltros();
    });
}

// ===== Retorna os dados já filtrados por gerência + mês (base para popular selects) =====
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
    const mesesUnicos = [...new Set(
        baseParaSelects.map(extrairMes).filter(Boolean)
    )].sort();

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

    // --- SECCIONAL (base) ---
    // Aplicamos também o filtro de mês para refinar as seccionais disponíveis
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

// ===== Aplica TODOS os filtros e renderiza =====
function aplicarFiltros() {
    let dadosFiltrados = dadosCompletos;

    // 1. Gerência
    if (filtroGerencia !== "TODAS") {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.GERENCIA || "").trim().toUpperCase() === filtroGerencia.toUpperCase()
        );
    }

    // 2. Mês
    if (filtroMes !== "TODOS") {
        dadosFiltrados = dadosFiltrados.filter(linha => extrairMes(linha) === filtroMes);
    }

    // 3. Seccional (base)
    if (filtroSeccional !== "TODAS") {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.base || "").trim() === filtroSeccional
        );
    }

    // 4. Segmento
    if (filtroSegmento !== "TODOS") {
        dadosFiltrados = dadosFiltrados.filter(linha =>
            (linha.SEGMENTO || "").trim() === filtroSegmento
        );
    }

    // Texto informativo
    atualizarInfoFiltro(dadosFiltrados.length);

    console.log(`Filtros → Gerência: ${filtroGerencia} | Mês: ${filtroMes} | Seccional: ${filtroSeccional} | Segmento: ${filtroSegmento} | Registros: ${dadosFiltrados.length}`);

    renderizarCards(dadosFiltrados);
    renderizarGraficoBase(dadosFiltrados);
    renderizarGraficoFaixa(dadosFiltrados);
    renderizarGraficoTipos(dadosFiltrados);
    renderizarGraficoEquipes(dadosFiltrados);
    renderizarGraficoPeriodos(dadosFiltrados);
    renderizarGraficoDias(dadosFiltrados);
}

// ===== Monta o texto "Exibindo: ..." =====
function atualizarInfoFiltro(qtd) {
    const partes = [];

    if (filtroGerencia === "TODAS") {
        partes.push("Todas as gerências");
    } else {
        partes.push(filtroGerencia);
    }

    if (filtroMes !== "TODOS") partes.push(formatarMes(filtroMes));
    if (filtroSeccional !== "TODAS") partes.push("Secc: " + filtroSeccional);
    if (filtroSegmento !== "TODOS") partes.push("Seg: " + filtroSegmento);

    document.getElementById("infoFiltro").textContent =
        `Exibindo: ${partes.join(" • ")} (${qtd.toLocaleString("pt-BR")} registros)`;
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
   GRÁFICOS — o código abaixo é o mesmo que você já tinha
   ========================================================= */

function renderizarGraficoBase(dados) {
    const contagem = {};
    dados.forEach(linha => {
        const base = (linha.base || "Sem base").trim();
        contagem[base] = (contagem[base] || 0) + 1;
    });

    const basesOrdenadas = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
    const valoresOrdenados = basesOrdenadas.map(base => contagem[base]);

    if (graficoBase) graficoBase.destroy();
    const ctx = document.getElementById("graficoBase").getContext("2d");

    graficoBase = new Chart(ctx, {
        type: "bar",
        data: {
            labels: basesOrdenadas,
            datasets: [{
                label: "Ocorrências",
                data: valoresOrdenados,
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.parsed.x.toLocaleString("pt-BR") + " ocorrências"
                    }
                }
            },
            scales: {
                x: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(51, 65, 85, 0.5)" } },
                y: { ticks: { color: "#f1f5f9", font: { size: 13 } }, grid: { display: false } }
            }
        }
    });
}

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

function renderizarGraficoTipos(dados) {
    const contagem = {};
    dados.forEach(linha => {
        const tipo = (linha.TIPO_DE_INDISPONIBILIDADE || "Não informado").trim() || "Não informado";
        contagem[tipo] = (contagem[tipo] || 0) + 1;
    });

    const tiposOrdenados = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
    const top10 = tiposOrdenados.slice(0, 10);
    const valoresTop10 = top10.map(tipo => contagem[tipo]);

    if (graficoTipos) graficoTipos.destroy();
    const ctx = document.getElementById("graficoTipos").getContext("2d");

    graficoTipos = new Chart(ctx, {
        type: "bar",
        data: {
            labels: top10,
            datasets: [{
                label: "Ocorrências",
                data: valoresTop10,
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.x.toLocaleString("pt-BR") + " ocorrências" }
                }
            },
            scales: {
                x: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(51, 65, 85, 0.5)" } },
                y: { ticks: { color: "#f1f5f9", font: { size: 13 }, autoSkip: false }, grid: { display: false } }
            }
        }
    });
}

function renderizarGraficoEquipes(dados) {
    const contagem = {};
    dados.forEach(linha => {
        const equipe = (linha.EQUIPE || "Não informada").trim() || "Não informada";
        contagem[equipe] = (contagem[equipe] || 0) + 1;
    });

    const equipesOrdenadas = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
    const top15 = equipesOrdenadas.slice(0, 15);
    const valoresTop15 = top15.map(eq => contagem[eq]);

    if (graficoEquipes) graficoEquipes.destroy();
    const ctx = document.getElementById("graficoEquipes").getContext("2d");

    graficoEquipes = new Chart(ctx, {
        type: "bar",
        data: {
            labels: top15,
            datasets: [{
                label: "Ocorrências",
                data: valoresTop15,
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
            plugins: {
                legend: { display: false },
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

function renderizarGraficoPeriodos(dados) {
    const periodos = ["Manhã", "Tarde", "Noite", "Não informado"];
    const contagem = { "Manhã": 0, "Tarde": 0, "Noite": 0, "Não informado": 0 };

    dados.forEach(linha => {
        const inicio = (linha.INICIO || "").trim();
        if (!inicio) { contagem["Não informado"]++; return; }
        const partes = inicio.split(":");
        if (partes.length < 2) { contagem["Não informado"]++; return; }
        const hora = parseInt(partes[0], 10);
        if (isNaN(hora)) { contagem["Não informado"]++; return; }

        if (hora >= 6 && hora < 12) contagem["Manhã"]++;
        else if (hora >= 12 && hora < 18) contagem["Tarde"]++;
        else contagem["Noite"]++;
    });

    const valores = periodos.map(p => contagem[p]);
    const cores = [
        "rgba(255, 0, 43, 0.78)",
        "rgba(233, 147, 19, 0.73)",
        "rgb(194, 187, 86)",
        "rgb(253, 254, 255)"
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
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.toLocaleString("pt-BR") + " ocorrências" }
                }
            }
        }
    });
}

function renderizarGraficoDias(dados) {
    const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const contagem = [0, 0, 0, 0, 0, 0, 0];

    dados.forEach(linha => {
        const dataStr = (linha.DATA || "").trim();
        if (!dataStr) return;
        const partes = dataStr.split("/");
        if (partes.length !== 3) return;

        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const ano = parseInt(partes[2], 10);

        const dataObj = new Date(ano, mes, dia);
        if (isNaN(dataObj.getTime())) return;

        contagem[dataObj.getDay()]++;
    });

    const ordemExibicao = [1, 2, 3, 4, 5, 6, 0];
    const labelsExibicao = ordemExibicao.map(i => nomesDias[i]);
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
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: ctx => ctx.parsed.y.toLocaleString("pt-BR") + " ocorrências" }
                }
            },
            scales: {
                x: { ticks: { color: "#f1f5f9", font: { size: 13 } }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(51, 65, 85, 0.5)" } }
            }
        }
    });
}

// ===== Inicia =====
iniciarDashboard();
