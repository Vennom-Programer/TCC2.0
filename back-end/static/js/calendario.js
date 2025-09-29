document.addEventListener('DOMContentLoaded', function() {
      const calendarDays = document.getElementById('calendarDays');
      const monthYearElement = document.getElementById('monthYear');
      const modalOverlay = document.getElementById('modalOverlay');
      const modalTitle = document.getElementById('modalTitle');
      const selectedDateElement = document.getElementById('selectedDate');
      const morningSlots = document.getElementById('morningSlots');
      const afternoonSlots = document.getElementById('afternoonSlots');
      const eveningSlots = document.getElementById('eveningSlots');
      const reserveButton = document.getElementById('reserveButton');
      const cancelButton = document.getElementById('cancelButton');
      const closeModal = document.getElementById('closeModal');
      const itemOptions = document.getElementById('itemOptions');
      const spaceOptions = document.getElementById('spaceOptions');
      const itemSelect = document.getElementById('itemSelect');
      const spaceSelect = document.getElementById('spaceSelect');
      const reservationDetails = document.getElementById('reservationDetails');
      const resourceOptions = document.querySelectorAll('.resource-option');
      
      let currentDate = new Date();
      let currentMonth = currentDate.getMonth();
      let currentYear = currentDate.getFullYear();
      let selectedDay = null;
      let selectedDateKey = null;
      let isCancelMode = false;
      let selectedResourceType = null;
      let selectedResource = null;
      
      // Nomes dos meses
      const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                         "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      
      // Dias da semana
      const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", 
                       "Quinta-feira", "Sexta-feira", "Sábado"];
      
      // Horários conforme especificado
      const morningSchedule = [
        { number: '1º', start: '07:30', end: '08:20', key: '1' },
        { number: '2º', start: '08:20', end: '09:10', key: '2' },
        { number: '3º', start: '09:40', end: '10:20', key: '3' },
        { number: '4º', start: '10:20', end: '11:10', key: '4' },
        { number: '5º', start: '11:10', end: '12:00', key: '5' }
      ];
      
      const afternoonSchedule = [
        { number: '6º', start: '13:30', end: '14:20', key: '6' },
        { number: '7º', start: '14:20', end: '15:00', key: '7' },
        { number: '8º', start: '15:30', end: '16:10', key: '8' },
        { number: '9º', start: '16:10', end: '17:00', key: '9' }
      ];
      
      const eveningSchedule = [
        { number: '10º', start: '19:30', end: '20:20', key: '10' },
        { number: '11º', start: '20:20', end: '21:10', key: '11' },
        { number: '12º', start: '21:10', end: '22:00', key: '12' }
      ];
      
      // Mapeamento de recursos para nomes amigáveis
      const resourceNames = {
        'projetor': 'Projetor Multimídia',
        'notebook': 'Notebook',
        'microfone': 'Microfone',
        'caixa-som': 'Caixa de Som',
        'tablet': 'Tablet',
        'lab-info': 'Laboratório de Informática',
        'lab-quimica': 'Laboratório de Química',
        'lab-fisica': 'Laboratório de Física',
        'auditorio': 'Auditório',
        'sala-reuniao': 'Sala de Reunião'
      };

      // Build server reservations map (by dateKey) if server provided data
      const serverReservationsRaw = (window.serverReservations && Array.isArray(window.serverReservations)) ? window.serverReservations : [];
      const serverReservationsMap = {};
      serverReservationsRaw.forEach(r => {
        try {
          const d = new Date(r.data_reserva);
          if (!isNaN(d)) {
            const key = getDateKey(d.getDate(), d.getMonth(), d.getFullYear());
            if (!serverReservationsMap[key]) serverReservationsMap[key] = [];
            serverReservationsMap[key].push(r);
          }
        } catch (e) {
          // ignore malformed dates
        }
      });
      
      // Obter reservas do localStorage ou inicializar objeto vazio
      function getReservations() {
        const reservations = localStorage.getItem('reservations');
        return reservations ? JSON.parse(reservations) : {};
      }
      
      // Salvar reservas no localStorage
      function saveReservations(reservations) {
        localStorage.setItem('reservations', JSON.stringify(reservations));
      }
      
      // Função para formatar a chave da data
      function getDateKey(day, month, year) {
        return `${year}-${month + 1}-${day}`;
      }
      
      // Função para gerar o calendário
      function generateCalendar() {
        calendarDays.innerHTML = '';
        monthYearElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        
        // Obter o primeiro dia do mês
        const firstDay = new Date(currentYear, currentMonth, 1);
        const startingDay = firstDay.getDay(); // 0 (Domingo) a 6 (Sábado)
        
        // Obter o último dia do mês
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        
  // Obter reservas (cliente) e verificar reservas vindas do servidor
  const reservations = getReservations();
        
        // Preencher os dias vazios no início do mês
        for (let i = 0; i < startingDay; i++) {
          const emptyDay = document.createElement('div');
          emptyDay.classList.add('day', 'inactive');
          calendarDays.appendChild(emptyDay);
        }
        
        // Preencher os dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
          const dayElement = document.createElement('div');
          const dayOfWeek = new Date(currentYear, currentMonth, day).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
          dayElement.classList.add('day');
          
          if (isWeekend) {
            dayElement.classList.add('inactive');
          } else {
            const dateKey = getDateKey(day, currentMonth, currentYear);
            const dayReservations = reservations[dateKey];
            const hasClientReservations = dayReservations && Object.values(dayReservations).some(r => r.reserved);
            const hasServerReservations = serverReservationsMap[dateKey] && serverReservationsMap[dateKey].length > 0;
            const hasReservations = hasClientReservations || hasServerReservations;

            if (hasReservations) {
              dayElement.classList.add('has-reservations');
              const clientCount = dayReservations ? Object.values(dayReservations).filter(r => r.reserved).length : 0;
              const serverCount = hasServerReservations ? serverReservationsMap[dateKey].length : 0;
              const reservationCount = clientCount + serverCount;
              dayElement.innerHTML = `
                <div class="day-number">${day}</div>
                <div class="day-reservations">${reservationCount} reserva(s)</div>
              `;
            } else {
              dayElement.classList.add('available');
              dayElement.innerHTML = `
                <div class="day-number">${day}</div>
              `;
            }
            
            dayElement.addEventListener('click', () => selectDay(dayElement, day, dayOfWeek));
          }
          
          calendarDays.appendChild(dayElement);
        }
      }
      
      // Função para selecionar um dia
      function selectDay(dayElement, day, dayOfWeek) {
        // Remover seleção anterior
        if (selectedDay) {
          selectedDay.classList.remove('selected');
        }
        
        // Definir nova seleção
        dayElement.classList.add('selected');
        selectedDay = dayElement;
        
        // Guardar a chave da data selecionada
        selectedDateKey = getDateKey(day, currentMonth, currentYear);
        
        // Mostrar o modal com os horários
        const formattedDate = `${day} de ${monthNames[currentMonth]} de ${currentYear}`;
        
        selectedDateElement.textContent = formattedDate;
        modalTitle.textContent = `Horários para ${formattedDate}`;
        
        // Sair do modo de cancelamento ao selecionar novo dia
        isCancelMode = false;
        updateCancelButton();
        
        // Limpar seleções de recursos
        clearResourceSelection();
        
  // Gerar os horários
  generateTimeSlots();

  // Preencher detalhes vindos do servidor para esta data (se houver)
  populateServerReservations(selectedDateKey);
        
        // Mostrar o modal
        modalOverlay.style.display = 'flex';
      }

      // Populate reservationDetails with server-side reservations for the selected date
      function populateServerReservations(dateKey) {
        const serverList = serverReservationsMap[dateKey] || [];
        if (serverList.length === 0) return;
        // Build a simple HTML summary
        const html = serverList.map(r => {
          const dataReserva = r.data_reserva || '';
          const status = r.status || '';
          return `<div class="server-reservation">Usuário: ${r.id_usuario} — Item: ${r.id_item} — Status: ${status} — Data: ${dataReserva}</div>`;
        }).join('');
        // Prepend server reservations into reservationDetails
        reservationDetails.innerHTML = html + reservationDetails.innerHTML;
      }
      
      // Limpar seleção de recursos
      function clearResourceSelection() {
        resourceOptions.forEach(option => {
          option.classList.remove('selected');
        });
        itemOptions.classList.remove('visible');
        spaceOptions.classList.remove('visible');
        itemSelect.value = '';
        spaceSelect.value = '';
        selectedResourceType = null;
        selectedResource = null;
        updateReservationDetails();
      }
      
      // Função para gerar os horários de aula
      function generateTimeSlots() {
        morningSlots.innerHTML = '';
        afternoonSlots.innerHTML = '';
        eveningSlots.innerHTML = '';
        
        // Obter reservas
        const reservations = getReservations();
        const dayReservations = reservations[selectedDateKey] || {};
        
        // Gerar horários da manhã
        morningSchedule.forEach(slot => {
          const reservation = dayReservations[slot.key];
          const isReserved = reservation && reservation.reserved;
          const timeSlot = createTimeSlotElement(slot, isReserved, reservation);
          morningSlots.appendChild(timeSlot);
        });
        
        // Gerar horários da tarde
        afternoonSchedule.forEach(slot => {
          const reservation = dayReservations[slot.key];
          const isReserved = reservation && reservation.reserved;
          const timeSlot = createTimeSlotElement(slot, isReserved, reservation);
          afternoonSlots.appendChild(timeSlot);
        });
        
        // Gerar horários da noite
        eveningSchedule.forEach(slot => {
          const reservation = dayReservations[slot.key];
          const isReserved = reservation && reservation.reserved;
          const timeSlot = createTimeSlotElement(slot, isReserved, reservation);
          eveningSlots.appendChild(timeSlot);
        });
        
        // Atualizar o estado dos botões
        updateButtonStates();
      }
      
      // Função para criar elemento de horário
      function createTimeSlotElement(slot, isReserved, reservation) {
        const timeSlot = document.createElement('div');
        timeSlot.classList.add('time-slot');
        timeSlot.dataset.slotKey = slot.key;
        
        if (isReserved) {
          timeSlot.classList.add('reserved');
          let reservedText = 'Reservado';
          if (reservation && reservation.resourceType && reservation.resource) {
            reservedText = `Reservado (${resourceNames[reservation.resource]})`;
          }
          
          timeSlot.innerHTML = `
            <div class="time-slot-number">${slot.number}</div>
            <div class="time-range">${slot.start} às ${slot.end}</div>
            <div class="time-slot-status status-reserved">${reservedText}</div>
          `;
          
          // Adicionar evento de clique para modo de cancelamento
          timeSlot.addEventListener('click', function() {
            if (isCancelMode) {
              this.classList.toggle('to-cancel');
              updateButtonStates();
            }
          });
        } else {
          timeSlot.innerHTML = `
            <div class="time-slot-number">${slot.number}</div>
            <div class="time-range">${slot.start} às ${slot.end}</div>
            <div class="time-slot-status status-available">Disponível</div>
          `;
          
          // Adicionar evento de clique apenas se não estiver no modo de cancelamento
          if (!isCancelMode) {
            timeSlot.addEventListener('click', function() {
              this.classList.toggle('selected');
              updateButtonStates();
              updateReservationDetails();
            });
          }
        }
        
        return timeSlot;
      }
      
      // Atualizar detalhes da reserva
      function updateReservationDetails() {
        const selectedSlots = document.querySelectorAll('.time-slot.selected');
        
        if (selectedSlots.length === 0 || !selectedResource) {
          reservationDetails.innerHTML = 'Selecione os horários e um recurso para ver os detalhes da reserva.';
          return;
        }
        
        const selectedTimes = Array.from(selectedSlots).map(slot => {
          return slot.querySelector('.time-range').textContent;
        });
        
        reservationDetails.innerHTML = `
          <div><strong>Recurso:</strong> ${resourceNames[selectedResource]}</div>
          <div><strong>Horários selecionados:</strong></div>
          <div>${selectedTimes.join(', ')}</div>
        `;
      }
      
      // Função para atualizar o estado dos botões
      function updateButtonStates() {
        if (isCancelMode) {
          const selectedToCancel = document.querySelectorAll('.time-slot.to-cancel');
          cancelButton.disabled = selectedToCancel.length === 0;
          reserveButton.disabled = true;
        } else {
          const selectedSlots = document.querySelectorAll('.time-slot.selected');
          const canReserve = selectedSlots.length > 0 && selectedResource;
          
          reserveButton.disabled = !canReserve;
          
          // Verificar se há reservas para este dia
          const reservations = getReservations();
          const dayReservations = reservations[selectedDateKey] || {};
          const hasReservations = Object.keys(dayReservations).length > 0;
          
          cancelButton.disabled = !hasReservations;
        }
      }
      
      // Atualizar aparência do botão de cancelamento
      function updateCancelButton() {
        if (isCancelMode) {
          cancelButton.innerHTML = '<i class="fas fa-times"></i> Confirmar Cancelamento';
          cancelButton.classList.add('cancel-mode-active');
        } else {
          cancelButton.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Reservas';
          cancelButton.classList.remove('cancel-mode-active');
        }
      }
      
      // Selecionar tipo de recurso
      resourceOptions.forEach(option => {
        option.addEventListener('click', function() {
          const type = this.dataset.type;
          
          // Desselecionar outros recursos
          resourceOptions.forEach(opt => opt.classList.remove('selected'));
          
          // Selecionar este recurso
          this.classList.add('selected');
          selectedResourceType = type;
          
          // Mostrar opções apropriadas
          if (type === 'item') {
            itemOptions.classList.add('visible');
            spaceOptions.classList.remove('visible');
            spaceSelect.value = '';
          } else {
            spaceOptions.classList.add('visible');
            itemOptions.classList.remove('visible');
            itemSelect.value = '';
          }
          
          updateButtonStates();
        });
      });
      
      // Selecionar item específico
      itemSelect.addEventListener('change', function() {
        selectedResource = this.value;
        updateButtonStates();
        updateReservationDetails();
      });
      
      // Selecionar espaço específico
      spaceSelect.addEventListener('change', function() {
        selectedResource = this.value;
        updateButtonStates();
        updateReservationDetails();
      });
      
      // Alternar entre modos de reserva e cancelamento
      cancelButton.addEventListener('click', function() {
        const reservations = getReservations();
        const dayReservations = reservations[selectedDateKey] || {};
        const hasReservations = Object.keys(dayReservations).length > 0;
        
        if (!hasReservations) {
          alert('Não há reservas para cancelar neste dia.');
          return;
        }
        
        if (!isCancelMode) {
          // Entrar no modo de cancelamento
          isCancelMode = true;
          updateCancelButton();
          
          // Desselecionar quaisquer horários selecionados para reserva
          document.querySelectorAll('.time-slot.selected').forEach(slot => {
            slot.classList.remove('selected');
          });
        } else {
          // Processar cancelamento - encontrar horários selecionados para cancelar
          const selectedToCancel = document.querySelectorAll('.time-slot.to-cancel');
          
          if (selectedToCancel.length === 0) {
            alert('Selecione pelo menos um horário para cancelar.');
            return;
          }
          
          // Confirmar cancelamento
          if (confirm(`Tem certeza que deseja cancelar ${selectedToCancel.length} reserva(s)?`)) {
            // Processar cancelamento
            selectedToCancel.forEach(slot => {
              const slotKey = slot.dataset.slotKey;
              if (reservations[selectedDateKey] && reservations[selectedDateKey][slotKey]) {
                delete reservations[selectedDateKey][slotKey];
              }
            });
            
            // Se não há mais reservas para este dia, remover a entrada
            if (reservations[selectedDateKey] && Object.keys(reservations[selectedDateKey]).length === 0) {
              delete reservations[selectedDateKey];
            }
            
            // Salvar reservas atualizadas
            saveReservations(reservations);
            
            alert('Reserva(s) cancelada(s) com sucesso!');
            
            // Atualizar o calendário e horários
            generateCalendar();
            generateTimeSlots();
          }
          
          // Sair do modo de cancelamento
          isCancelMode = false;
          updateCancelButton();
        }
        
        updateButtonStates();
      });
      
      // Fechar o modal
      closeModal.addEventListener('click', function() {
        closeModalHandler();
      });
      
      // Fechar o modal clicando fora dele
      modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
          closeModalHandler();
        }
      });
      
      // Função para fechar o modal
      function closeModalHandler() {
        modalOverlay.style.display = 'none';
        
        // Limpar seleções e modos
        document.querySelectorAll('.time-slot.selected, .time-slot.to-cancel').forEach(slot => {
          slot.classList.remove('selected', 'to-cancel');
        });
        
        isCancelMode = false;
        updateCancelButton();
        clearResourceSelection();
      }
      
      // Adicionar evento de clique ao botão de reserva
      reserveButton.addEventListener('click', function() {
        const selectedSlots = document.querySelectorAll('.time-slot.selected');
        const selectedTimes = Array.from(selectedSlots).map(slot => {
          return slot.querySelector('.time-range').textContent;
        });
        
        if (!selectedResource) {
          alert('Por favor, selecione um recurso para reservar.');
          return;
        }
        
        // Obter reservas atuais
        const reservations = getReservations();
        
        // Inicializar reservas para esta data se não existir
        if (!reservations[selectedDateKey]) {
          reservations[selectedDateKey] = {};
        }
        
        // Marcar os horários selecionados como reservados
        selectedSlots.forEach(slot => {
          const slotKey = slot.dataset.slotKey;
          reservations[selectedDateKey][slotKey] = {
            reserved: true,
            resourceType: selectedResourceType,
            resource: selectedResource,
            resourceName: resourceNames[selectedResource]
          };
        });
        
        // Salvar reservas atualizadas
        saveReservations(reservations);
        
        alert(`Reserva confirmada para ${resourceNames[selectedResource]} nos horários:\n- ${selectedTimes.join('\n- ')}`);
        
        // Atualizar o calendário para refletir as novas reservas
        generateCalendar();
        generateTimeSlots();
        
        // Fechar o modal
        closeModalHandler();
      });
      
      // Inicializar o calendário
      generateCalendar();
    });