let chart, tempChart, humChart, smokeChart;
let deviceIDs = [];
let selectedID = null;
let historyData = [];
let viewMode = 'all';
let alertActive = false;
let audioContext = null;
let oscillator = null;
let gainNode = null;
let alertMuted = false;

const smokeLevelCritical = 2000;
const temperatureCritical = 20;


// Função helper para formatar timestamp em dia/mês hora:minuto:segundo
function formatTimestamp(timestamp) {
    const date = new Date((timestamp * 1000) - (2 * 60 * 60 * 1000)); // Ajuste para UTC-2 (Brasil, horário de verão)

    return date.getDate() + '/' + (date.getMonth() + 1) + ' ' + date.getHours() + ':' + date.getMinutes().toString().padStart(2, '0') + ':' + date.getSeconds().toString().padStart(2, '0');
}

// vai criar o gráfico 
function createChart() {
    const ctx = document.getElementById("chart").getContext("2d");

    const chartOptions = {
        elements: {
            line: {
                tension: 0.1
            },
            point: {
                radius: 0
            }
        },
        responsive: true,
        maintainAspectRatio: false,
    };

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Temperature",
                data: [],
                borderColor: 'red',
                borderWidth: 2
            }, {
                label: "Humidity",
                data: [],
                borderColor: 'blue',
                borderWidth: 2
            }, {
                label: "Smoke Level",
                data: [],
                borderColor: 'green',
                borderWidth: 2
            }]
        },
        options: chartOptions
    });



    const tempCtx = document.getElementById("temp-chart").getContext("2d");
    tempChart = new Chart(tempCtx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Temperature",
                data: [],
                borderColor: 'red',
                borderWidth: 2
            }]
        },
        options: chartOptions
    });

    const humCtx = document.getElementById("hum-chart").getContext("2d");
    humChart = new Chart(humCtx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Humidity",
                data: [],
                borderColor: 'blue',
                borderWidth: 2
            }]
        },
        options: chartOptions
    });

    const smokeCtx = document.getElementById("smoke-chart").getContext("2d");
    smokeChart = new Chart(smokeCtx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Smoke Level",
                data: [],
                borderColor: 'green',
                borderWidth: 2
            }]
        },
        options: chartOptions
    });
}

// vai carregar os dispositivos disponíveis
async function loadDevices() {
    deviceIDs = await fetch("/devices").then(r => r.json());

    let select = document.getElementById("device-select");
    select.innerHTML = "";

    deviceIDs.forEach(id => {
        let opt = document.createElement("option");
        opt.value = id;
        opt.textContent = id;
        select.appendChild(opt);
    });

    selectedID = deviceIDs[0] || null;
}

document.getElementById("device-select").addEventListener("change", e => {
    selectedID = e.target.value;
});

// vai carregar o histórico do dispositivo
async function loadHistory() {
    if (!selectedID) return;

    let history = await fetch(`/history/${selectedID}`).then(r => r.json());

    historyData = history;
    updateCharts();
}

// vai iniciar o stream de dados em tempo real
function startStream() {
    const source = new EventSource("/stream");

    source.onmessage = (event) => {
        let data = JSON.parse(event.data);

        if (selectedID && data.id !== selectedID) return;

        historyData.push(data);
        updateCharts();
        checkAlert(data);
    };
}

// Verificar se deve ativar o alerta
function checkAlert(data) {
    const shouldAlert = data.smoke_level > smokeLevelCritical && data.temperature > temperatureCritical;

    if (shouldAlert && !alertActive) {
        activateAlert();
    } else if (!shouldAlert && alertActive) {
        deactivateAlert();
    }
}

// Ativar alerta audiovisual
function activateAlert() {
    alertActive = true;

    document.getElementById('alert-message').textContent = `⚠️ ALERTA DE INCÊNDIO: Fumaça > ${smokeLevelCritical} e Temperatura > ${temperatureCritical}°C!`;

    // Mostrar elementos visuais
    document.getElementById('alert').style.display = 'block';
    document.getElementById('alert-overlay').style.display = 'block';
    document.getElementById('alert-box').style.display = 'block';
    document.getElementById('alert').classList.add('alert-active');
    document.getElementById('alert-box').classList.add('alert-active');

    // Iniciar som de alarme se não estiver silenciado
    if (!alertMuted) {
        startAlarmSound();
    }
}

// Desativar alerta
function deactivateAlert() {
    alertActive = false;

    document.getElementById('alert').style.display = 'none';
    document.getElementById('alert-overlay').style.display = 'none';
    document.getElementById('alert-box').style.display = 'none';
    document.getElementById('alert').classList.remove('alert-active');
    document.getElementById('alert-box').classList.remove('alert-active');

    stopAlarmSound();
}

// Iniciar som de alarme usando Web Audio API
function startAlarmSound() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (oscillator) return; // Já está tocando

    // Criar oscilador para o som de sirene
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

    oscillator.start();

    // Alternar entre duas frequências para criar efeito de sirene
    let toggle = true;
    setInterval(() => {
        if (oscillator && alertActive && !alertMuted) {
            oscillator.frequency.setValueAtTime(toggle ? 800 : 600, audioContext.currentTime);
            toggle = !toggle;
        }
    }, 500);
}

// Parar som de alarme
function stopAlarmSound() {
    if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        oscillator = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
}

// Silenciar alarme (função chamada pelo botão)
function muteAlert() {
    alertMuted = true;
    stopAlarmSound();
}

createChart();
loadDevices();
startStream();
changeView();

function clearHistory() {
    historyData = [];
    updateCharts();
}

function changeView() {
    viewMode = document.querySelector('input[name="view"]:checked').value;
    const allDiv = document.getElementById("all-chart");
    const sepDiv = document.getElementById("separate-charts");
    if (viewMode === 'all') {
        allDiv.style.display = 'block';
        sepDiv.style.display = 'none';
    } else {
        allDiv.style.display = 'none';
        sepDiv.style.display = 'grid';
        sepDiv.style.gridTemplateColumns = 'repeat(3, 1fr)';
        sepDiv.style.gap = '20px';
    }
    updateCharts();
}

function updateCharts() {
    if (viewMode === 'all') {
        chart.data.labels = historyData.map(item => item.timestamp);
        chart.data.datasets[0].data = historyData.map(item => item.temperature);
        chart.data.datasets[1].data = historyData.map(item => item.humidity);
        chart.data.datasets[2].data = historyData.map(item => item.smoke_level);
        chart.update();
    } else {
        tempChart.data.labels = historyData.map(item => item.timestamp);
        tempChart.data.datasets[0].data = historyData.map(item => item.temperature);
        tempChart.update();

        humChart.data.labels = historyData.map(item => item.timestamp);
        humChart.data.datasets[0].data = historyData.map(item => item.humidity);
        humChart.update();

        smokeChart.data.labels = historyData.map(item => item.timestamp);
        smokeChart.data.datasets[0].data = historyData.map(item => item.smoke_level);
        smokeChart.update();
    }
    updateTable();
}

function updateTable() {
    const tbody = document.getElementById('data-tbody');
    tbody.innerHTML = '';
    historyData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="padding: 8px; border: 1px solid #555;">${formatTimestamp(item.timestamp)}     ${item.timestamp}</td>
            <td style="padding: 8px; border: 1px solid #555;">${item.temperature}</td>
            <td style="padding: 8px; border: 1px solid #555;">${item.humidity}</td>
            <td style="padding: 8px; border: 1px solid #555;">${item.smoke_level}</td>
        `;
        tbody.appendChild(row);
    });
}

async function exportToCSV() {
    if (!selectedID) {
        alert("Selecione um dispositivo primeiro.");
        return;
    }

    // Carregar o histórico completo
    let history = await fetch(`/history/${selectedID}`).then(r => r.json());

    // Combinar histórico com dados em tempo real (evitar duplicatas baseadas no timestamp)
    let allData = [...history];
    historyData.forEach(item => {
        if (!allData.some(h => h.timestamp === item.timestamp)) {
            allData.push(item);
        }
    });

    // Ordenar por timestamp
    allData.sort((a, b) => a.timestamp - b.timestamp);

    // Criar conteúdo CSV
    const csvContent = "data:text/csv;charset=utf-8," +
        "Timestamp,Temperature,Humidity,Smoke Level\n" +
        allData.map(item => `${item.timestamp},${item.temperature},${item.humidity},${item.smoke_level}`).join("\n");

    // Criar link para download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dados_monitoramento_${selectedID}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
