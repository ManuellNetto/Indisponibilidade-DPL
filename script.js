// ===== Configurações =====
const ARQUIVO_CSV = "dados.csv";
const FILTRO_PADRAO = "GSTC";   // Filtro inicial

// ===== Estado global =====
let dadosCompletos = [];        // Todos os dados do CSV
let filtroAtual = FILTRO_PADRAO;

// Variáveis globais dos gráficos (para poder destruí-los antes de recriar)
let graficoBase = null;
let graficoFaixa = null;
let graficoTipos = null;
let graficoEquipes = null;
let graficoPeriodos = null;
let graficoDias = null;


// ===== Função principal =====
function iniciarDashboard() {
    Papa.parse(ARQUIVO_CSV, {
        download: true,
        header: true,
        dynamicTyping: false,
        skipEmptyLines: true,
        complete: function(resultado) {
            if (resultado.errors.length > 0) {
                console.error("Erros ao ler o CSV:", resultado.errors);
            }

            dadosCompletos = resultado.data;
            console.log("Total de linhas lidas do CSV:", dadosCompletos.length);

            // Configura os botões de filtro
            configurarFiltros();

            // Renderiza o dashboard com o filtro padrão
            aplicarFiltro(FILTRO_PADRAO);
        },
        error: function(erro) {
            console.error("Erro ao carregar o CSV:", erro);
            document.getElementById("totalGeral").textContent = "Erro";
            document.getElementById("totalTotal").textContent = "Erro";
            document.getElementById("totalParcial").textContent = "Erro";
        }
    });
}

// ===== Configura os botões de filtro =====
function configurarFiltros() {
    const botoes = document.querySelectorAll(".filtro-btn");

    botoes.forEach(botao => {
        botao.addEventListener("click", function() {
            const valorFiltro = this.getAttribute("data-filtro");

            // Atualiza a classe "ativo" visualmente
            botoes.forEach(b => b.classList.remove("ativo"));
            this.classList.add("ativo");

            // Aplica o filtro
            aplicarFiltro(valorFiltro);
        });
    });
}

// ===== Aplica o filtro e renderiza o dashboard =====
function aplicarFiltro(valorFiltro) {
    filtroAtual = valorFiltro;

    // Filtra os dados
    let dadosFiltrados;
    if (valorFiltro === "TODAS") {
        dadosFiltrados = dadosCompletos;
        document.getElementById("infoFiltro").textContent = "Exibindo: Todas as gerências";
    } else {
        dadosFiltrados = dadosCompletos.filter(linha => {
            const gerencia = (linha.GERENCIA || "").trim().toUpperCase();
            return gerencia === valorFiltro.toUpperCase();
        });
        document.getElementById("infoFiltro").textContent = "Exibindo: " + valorFiltro;
    }

    console.log(`Filtro aplicado: ${valorFiltro} | Registros: ${dadosFiltrados.length}`);

    // Renderiza os cards com os dados filtrados
    renderizarCards(dadosFiltrados);

    // Renderiza os gráficos com os dados filtrados
    renderizarGraficoBase(dadosFiltrados);
    renderizarGraficoFaixa(dadosFiltrados);
    renderizarGraficoTipos(dadosFiltrados);
    renderizarGraficoEquipes(dadosFiltrados);
    renderizarGraficoPeriodos(dadosFiltrados);
    renderizarGraficoDias(dadosFiltrados);
    
}

// ===== Renderiza os 3 cards =====
function renderizarCards(dados) {
    const totalGeral = dados.length;
    let totalTotal = 0;
    let totalParcial = 0;

    dados.forEach(linha => {
        const tipo = (linha.TIPO_INDISPONIBILIDADE_DIA || "").trim().toUpperCase();
        if (tipo === "TOTAL") {
            totalTotal++;
        } else if (tipo === "PARCIAL") {
            totalParcial++;
        }
    });

    document.getElementById("totalGeral").textContent = totalGeral.toLocaleString('pt-BR');
    document.getElementById("totalTotal").textContent = totalTotal.toLocaleString('pt-BR');
    document.getElementById("totalParcial").textContent = totalParcial.toLocaleString('pt-BR');
}

// ===== Gráfico 1: Volume por Base (Barras horizontais) =====
function renderizarGraficoBase(dados) {
    // 1. Contagem por base
    const contagem = {};
    dados.forEach(linha => {
        const base = (linha.base || "Sem base").trim();
        contagem[base] = (contagem[base] || 0) + 1;
    });

    // 2. Ordena do maior para o menor
    const basesOrdenadas = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
    const valoresOrdenados = basesOrdenadas.map(base => contagem[base]);

    // 3. Destrói o gráfico antigo (se existir)
    if (graficoBase) graficoBase.destroy();

    // 4. Cria o novo gráfico
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
                        label: function(context) {
                            return context.parsed.x.toLocaleString("pt-BR") + " ocorrências";
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                },
                y: {
                    ticks: { color: "#f1f5f9", font: { size: 13 } },
                    grid: { display: false }
                }
            }
        }
    });
}

// ===== Gráfico 2: Quantidade por Faixa de Indisponibilidade (Linhas) =====
function renderizarGraficoFaixa(dados) {
    // 1. Ordem fixa das faixas (do menor tempo para o maior)
    const ordemFaixas = ["< 2h", "2 a 4h", "4 a 6h", "> 6h"];

    // 2. Inicializa contagem com zero em todas as faixas
    const contagem = {};
    ordemFaixas.forEach(f => contagem[f] = 0);

    // 3. Conta as ocorrências por faixa
    dados.forEach(linha => {
        const faixa = (linha.faixa_indisp || "").trim();
        if (contagem.hasOwnProperty(faixa)) {
            contagem[faixa]++;
        }
    });

    const valores = ordemFaixas.map(f => contagem[f]);

    // 4. Destrói o gráfico antigo (se existir)
    if (graficoFaixa) graficoFaixa.destroy();

    // 5. Cria o novo gráfico
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
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString("pt-BR") + " ocorrências";
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#94a3b8", font: { size: 13 } },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                }
            }
        }
    });
}

// ===== Gráfico 3: Top 10 Tipos de Indisponibilidade (Barras horizontais) =====
function renderizarGraficoTipos(dados) {
    // 1. Contagem por tipo
    const contagem = {};
    dados.forEach(linha => {
        const tipo = (linha.TIPO_DE_INDISPONIBILIDADE || "Não informado").trim() || "Não informado";
        contagem[tipo] = (contagem[tipo] || 0) + 1;
    });

    // 2. Ordena do maior para o menor
    const tiposOrdenados = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);

    // 3. Pega apenas os Top 10
    const top10 = tiposOrdenados.slice(0, 10);
    const valoresTop10 = top10.map(tipo => contagem[tipo]);

    // 4. Destrói o gráfico antigo (se existir)
    if (graficoTipos) graficoTipos.destroy();

    // 5. Cria o novo gráfico
    const ctx = document.getElementById("graficoTipos").getContext("2d");

    graficoTipos = new Chart(ctx, {
        type: "bar",
        data: {
            labels: top10,
            datasets: [{
                label: "Ocorrências",
                data: valoresTop10,
                backgroundColor: "rgba(255, 52, 1, 0.66)",   // verde-água
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
                    callbacks: {
                        label: function(context) {
                            return context.parsed.x.toLocaleString("pt-BR") + " ocorrências";
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                },
                y: {
                    ticks: {
                        color: "#f1f5f9",
                        font: { size: 13 },
                        autoSkip: false   // Garante que todos os 10 nomes apareçam
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// ===== Gráfico 4: Top 15 Equipes (Barras horizontais) =====
function renderizarGraficoEquipes(dados) {
    // 1. Contagem por equipe
    const contagem = {};
    dados.forEach(linha => {
        const equipe = (linha.EQUIPE || "Não informada").trim() || "Não informada";
        contagem[equipe] = (contagem[equipe] || 0) + 1;
    });

    // 2. Ordena do maior para o menor
    const equipesOrdenadas = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);

    // 3. Pega apenas as Top 15
    const top15 = equipesOrdenadas.slice(0, 15);
    const valoresTop15 = top15.map(eq => contagem[eq]);

    // 4. Destrói o gráfico antigo (se existir)
    if (graficoEquipes) graficoEquipes.destroy();

    // 5. Cria o novo gráfico
    const ctx = document.getElementById("graficoEquipes").getContext("2d");

    graficoEquipes = new Chart(ctx, {
        type: "bar",
        data: {
            labels: top15,
            datasets: [{
                label: "Ocorrências",
                data: valoresTop15,
                backgroundColor: "rgba(43, 228, 126, 0.6)",   // roxo/lilás
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
                    callbacks: {
                        label: function(context) {
                            return context.parsed.x.toLocaleString("pt-BR") + " ocorrências";
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                },
                y: {
                    ticks: {
                        color: "#f1f5f9",
                        font: { size: 12 },
                        autoSkip: false
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// ===== Gráfico 6: Volume por Período do Dia (Barras verticais) =====
function renderizarGraficoPeriodos(dados) {
    // 1. Classificação conforme regra:
    //    06:00 a 11:59 → Manhã
    //    12:00 a 17:59 → Tarde
    //    18:00 a 05:59 → Noite
    const periodos = ["Manhã", "Tarde", "Noite", "Não informado"];
    const contagem = {
        "Manhã": 0,
        "Tarde": 0,
        "Noite": 0,
        "Não informado": 0
    };

    dados.forEach(linha => {
        const inicio = (linha.INICIO || "").trim();
        if (!inicio) {
            contagem["Não informado"]++;
            return;
        }

        const partes = inicio.split(":");
        if (partes.length < 2) {
            contagem["Não informado"]++;
            return;
        }

        const hora = parseInt(partes[0], 10);
        if (isNaN(hora)) {
            contagem["Não informado"]++;
            return;
        }

        if (hora >= 6 && hora < 12) {
            contagem["Manhã"]++;
        } else if (hora >= 12 && hora < 18) {
            contagem["Tarde"]++;
        } else {
            // 18h às 05h
            contagem["Noite"]++;
        }
    });

    const valores = periodos.map(p => contagem[p]);

    // 2. Cores por período (manhã = amarelo, tarde = laranja, noite = azul escuro, não informado = cinza)
    const cores = [
        "rgba(255, 0, 43, 0.78)",    // Manhã - amarelo
        "rgba(233, 147, 19, 0.73)",    // Tarde - laranja
        "rgb(194, 187, 86)",    // Noite - azul índigo
        "rgb(253, 254, 255)"    // Não informado - cinza
    ];

    // 3. Destrói o gráfico antigo
    if (graficoPeriodos) graficoPeriodos.destroy();

    // 4. Cria o gráfico
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
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString("pt-BR") + " ocorrências";
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#f1f5f9", font: { size: 13 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                }
            }
        }
    });
}

// ===== Gráfico 5: Volume por Dia da Semana (Barras verticais) =====
function renderizarGraficoDias(dados) {
    const nomesDias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

    // Inicializa contagem com zero
    const contagem = [0, 0, 0, 0, 0, 0, 0];

    dados.forEach(linha => {
        const dataStr = (linha.DATA || "").trim();
        if (!dataStr) return;

        const partes = dataStr.split("/");
        if (partes.length !== 3) return;

        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;   // Mês no JS é 0-11
        const ano = parseInt(partes[2], 10);

        const dataObj = new Date(ano, mes, dia);
        if (isNaN(dataObj.getTime())) return;

        const diaSemana = dataObj.getDay();  // 0 = Domingo, 1 = Segunda...
        contagem[diaSemana]++;
    });

    // Reordena para começar na Segunda
    const ordemExibicao = [1, 2, 3, 4, 5, 6, 0];
    const labelsExibicao = ordemExibicao.map(i => nomesDias[i]);
    const valoresExibicao = ordemExibicao.map(i => contagem[i]);

    // Destaca o dia com mais ocorrências
    const maiorValor = Math.max(...valoresExibicao);
    const coresBarras = valoresExibicao.map(v =>
        v === maiorValor
            ? "rgba(131, 46, 243, 0.6)"
            : "rgba(131, 46, 243, 0.6)"
    );

    // Destrói o gráfico antigo
    if (graficoDias) graficoDias.destroy();

    // Cria o gráfico
    const ctx = document.getElementById("graficoDias").getContext("2d");

    graficoDias = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labelsExibicao,
            datasets: [{
                label: "Ocorrências",
                data: valoresExibicao,
                backgroundColor: coresBarras,
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
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString("pt-BR") + " ocorrências";
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#f1f5f9", font: { size: 13 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#94a3b8" },
                    grid: { color: "rgba(51, 65, 85, 0.5)" }
                }
            }
        }
    });
}
// ===== Inicia quando a página carregar =====
iniciarDashboard();