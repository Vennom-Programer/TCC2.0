(function() {
    // Recursos para apresentar
    const resources = [
      'Laboratório informática',
      'Laboratório línguas',
      'Laboratório Matemática',
      'Laboratório de Física',
      'Laboratório de Quimica',
      'Auditório',
      'Data-shows',
      'Microfones',
      'Notebooks',
      'Caixas de sons'
    ];

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

  document.addEventListener('DOMContentLoaded', function () {
    const monthYear = document.getElementById('monthYear');
    const calendarDays = document.getElementById('calendarDays');

    // Função para obter o mês e ano atual
    function getCurrentMonthYear() {
        const today = new Date();
        const month = today.toLocaleString('pt-BR', { month: 'long' });
        const year = today.getFullYear();
        return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
    }

    // Função para gerar os dias do mês
    function generateCalendar() {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const totalDays = lastDay.getDate();

        calendarDays.innerHTML = '';
        for (let i = 0; i < startDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('empty');
            calendarDays.appendChild(emptyCell);
        }
        for (let d = 1; d <= totalDays; d++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('day');
            dayCell.textContent = d;
            // Exemplo de disponibilidade (alternando dias)
            if (d % 2 === 0) {
                dayCell.classList.add('available');
                dayCell.title = 'Disponível';
            } else {
                dayCell.classList.add('unavailable');
                dayCell.title = 'Indisponível';
            }
            calendarDays.appendChild(dayCell);
        }
    }

    monthYear.textContent = getCurrentMonthYear();
    generateCalendar();

    // Botões dos dias úteis da semana
    const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
    diasSemana.forEach(function(dia) {
        const btn = document.querySelector('.weekday-btn[data-dia="' + dia.toLowerCase() + '"]');
        if (btn) {
            btn.addEventListener('click', function() {
                mostrarItensSemana(dia);
            });
        }
    });
  });

  function mostrarItensSemana(diaSemana) {
    // Exemplo de itens disponíveis/indisponíveis
    const itens = [
        { nome: 'Projetor', status: 'Disponível' },
        { nome: 'Notebook', status: 'Indisponível' },
        { nome: 'Laboratório 1', status: 'Disponível' },
        { nome: 'Auditório', status: 'Indisponível' }
    ];
    const lista = document.getElementById('itens-lista-semana');
    lista.innerHTML = '';
    itens.forEach(function(item) {
        const li = document.createElement('li');
        li.textContent = item.nome + ' - ' + item.status;
        li.className = item.status === 'Disponível' ? 'disponivel' : 'indisponivel';
        lista.appendChild(li);
    });
    document.getElementById('diaSemanaSelecionado').textContent = diaSemana;
    document.getElementById('reserva-aba-semana').style.display = 'block';
  }