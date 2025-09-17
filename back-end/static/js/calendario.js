(function() {
    // Recursos para apresentar
    const recursosLaboratorio = [
      'Laboratório informática',
      'Laboratório línguas',
      'Laboratório Matemática',
      'Laboratório de Física',
      'Laboratório de Quimica'
    ];
    const recursosAuditorio = [
      'Auditório'
    ];
    const recursosArquivos = [
      'Data-shows',
      'Microfones',
      'Notebooks',
      'Caixas de sons'
    ];
    // Seleciona recursos conforme tipoReserva
    let resources = recursosLaboratorio.concat(recursosAuditorio, recursosArquivos);
    const tipoReservaSelecionado = localStorage.getItem('tipoReserva');
    if (tipoReservaSelecionado === 'laboratorio') {
      resources = recursosLaboratorio;
    } else if (tipoReservaSelecionado === 'auditorio') {
      resources = recursosAuditorio;
    } else if (tipoReservaSelecionado === 'arquivos') {
      resources = recursosArquivos;
    }

    // Dados de disponibilidade simulados para o mês atual (exemplo)
    // Chave: 'YYYY-MM-DD'
    // Valor: objeto com recurso: true/false (disponível/não disponível)
    const availabilityData = {
      // Exemplo alguns dias
      // Ajuste para dias do mês atual
    };

    // Função para formatar date para yyyy-mm-dd
    function formatDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth()+1).padStart(2,'0');
      const d = String(date.getDate()).padStart(2,'0');
      return `${y}-${m}-${d}`;
    }

    // Gerar dados aleatórios estáticos para o exemplo para o mês atual
    function generateExampleData(year, month) {
      const data = {};
      const daysInMonth = new Date(year, month+1, 0).getDate();
      for(let day=1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        data[dateStr] = {};
        resources.forEach(r=>{
          // Aleatório disponível 70%/30%
          data[dateStr][r] = Math.random() < 0.7;
        });
      }
      return data;
    }

    // Construir calendário
    function buildCalendar(year, month) {
      const daysContainer = document.getElementById('calendarDays');
      daysContainer.innerHTML = '';

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month+1, 0);
      const monthYearText = firstDay.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
      document.getElementById('monthYear').textContent = monthYearText[0].toUpperCase() + monthYearText.slice(1);

      // Quantidade de dias no mês
      const daysInMonth = lastDay.getDate();
      // Qual dia da semana começa (0=Domingo, 6=Sábado)
      const startWeekDay = firstDay.getDay();

      // Dias anteriores do mês para preencher a grade (dias do mês anterior)
      // Para simplicidade, preenchimento com bloco vazio sem número
      for (let i=0; i < startWeekDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('day','inactive');
        emptyCell.setAttribute('aria-hidden','true');
        daysContainer.appendChild(emptyCell);
      }

      // Dias do mês atual
      for(let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateStr = formatDate(dateObj);

        const dayCell = document.createElement('div');
        dayCell.classList.add('day');
        dayCell.setAttribute('role', 'gridcell');
        dayCell.setAttribute('aria-label', `Dia ${day}`);

        // Número do dia
        const dayNumber = document.createElement('div');
        dayNumber.classList.add('day-number');
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        // Lista recursos e disponibilidade
        const resourceList = document.createElement('div');
        resourceList.classList.add('resource-list');

        const availability = availabilityData[dateStr];
        resources.forEach(r => {
          const resDiv = document.createElement('div');
          resDiv.classList.add('resource');
          if(availability && availability[r] === true){
            resDiv.classList.add('available');
            resDiv.textContent = "✓ " + r;
          } else {
            resDiv.classList.add('unavailable');
            resDiv.textContent = "✗ " + r;
          }
          resourceList.appendChild(resDiv);
        });

        dayCell.appendChild(resourceList);

        daysContainer.appendChild(dayCell);
      }
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Gerar dados para o mês atual e armazenar globalmente
    Object.assign(availabilityData, generateExampleData(currentYear, currentMonth));

    // Construir calendário
    buildCalendar(currentYear, currentMonth);

  })();

  // Funções utilitárias
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Modal de reserva
window.abrirReserva = function(dia, semana) {
  document.getElementById('diaReserva').textContent = dia;
  document.getElementById('semanaReserva').textContent = semana;
  document.getElementById('reserva-modal').style.display = 'block';
  atualizarOpcoes();
}
window.fecharReserva = function() {
  document.getElementById('reserva-modal').style.display = 'none';
}
function atualizarOpcoes() {
  var tipo = document.getElementById('tipoReserva').value;
  var opcoesDiv = document.getElementById('opcoesReserva');
  var opcoes = '';
  if (tipo === 'item') {
    opcoes = '<label>Escolha o item:</label><select><option>Projetor</option><option>Notebook</option><option>Microfone</option></select>';
  } else {
    opcoes = '<label>Escolha o espaço:</label><select><option>Laboratório 1</option><option>Auditório</option></select>';
  }
  opcoesDiv.innerHTML = opcoes;
}

document.addEventListener('DOMContentLoaded', function () {
  // Atualiza opções ao trocar tipo
  var tipoReserva = document.getElementById('tipoReserva');
  if (tipoReserva) {
    tipoReserva.addEventListener('change', atualizarOpcoes);
  }

  // Construir calendário: apenas dias úteis com botão, finais de semana inativos
  const calendarDays = document.getElementById('calendarDays');
  const monthYear = document.getElementById('monthYear');
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  monthYear.textContent = now.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'}).replace(/^./, c => c.toUpperCase());

  calendarDays.innerHTML = '';
  for (let i = 0; i < startDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('empty');
    calendarDays.appendChild(emptyCell);
  }
  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, month, d);
    const weekDay = diasSemana[dateObj.getDay()];
    const dayCell = document.createElement('div');
    dayCell.classList.add('day');
    if (['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].includes(weekDay)) {
      dayCell.classList.add('available');
      dayCell.innerHTML = `${d} <button class='ver-itens-btn' onclick="abrirReserva('${d}', '${weekDay}')">Reservar</button>`;
    } else {
      dayCell.classList.add('inactive');
      dayCell.textContent = d;
    }
    calendarDays.appendChild(dayCell);
  }
});