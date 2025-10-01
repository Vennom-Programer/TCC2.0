document.addEventListener('DOMContentLoaded', function() {
    // Get current user data from HTML element
      const userDataElement = document.getElementById('user-data');
      const currentUserData = userDataElement ? {
        id: parseInt(userDataElement.dataset.id),
        nome: userDataElement.dataset.nome,
        email: userDataElement.dataset.email,
        role: userDataElement.dataset.role
      } : {
        id: 1,
        nome: 'Usuário',
        email: 'user@example.com',
        role: 'professor'
      };
      
      // Users provided by backend (for admin selection)
      const allUsers = Array.isArray(window.__USERS__) ? window.__USERS__ : [];
  // Elementos DOM
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
  const equipmentOptions = document.getElementById('equipmentOptions');
  const spaceOptions = document.getElementById('spaceOptions');
  const equipmentSelect = document.getElementById('equipmentSelect');
  const spaceSelect = document.getElementById('spaceSelect');
  const reservationDetails = document.getElementById('reservationDetails');
  const resourceOptions = document.querySelectorAll('.resource-option');
  const filterOptions = document.querySelectorAll('.filter-option');
  const reservationsPopup = document.getElementById('reservationsPopup');
  const popupTitle = document.getElementById('popupTitle');
  const popupContent = document.getElementById('popupContent');
  
  // NOVOS ELEMENTOS: Minhas Reservas e Indicador
  const myReservationsSection = document.getElementById('myReservationsSection');
  const myReservationsList = document.getElementById('myReservationsList');
  const cancelModeIndicator = document.getElementById('cancelModeIndicator');
  
  // Estado da aplicação
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  let selectedDay = null;
  let selectedDateKey = null;
  let isCancelMode = false;
  let selectedResourceType = null;
  let selectedResource = null;
  
  let currentFilter = 'all';
  let popupTimeout = null;
  
  // Constantes
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                     "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  
  const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", 
                   "Quinta-feira", "Sexta-feira", "Sábado"];
  
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


  // Build user maps (name and color) from backend list plus current
      const userNames = {};
      const userColors = {};
      const colorPalette = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c', '#16a085', '#8e44ad', '#c0392b'];
      let colorIndex = 0;
      const ensureColor = (id) => {
        if (!userColors[id]) {
          userColors[id] = colorPalette[colorIndex % colorPalette.length];
          colorIndex += 1;
        }
      };

      // Seed with backend users
      allUsers.forEach(u => {
        const uid = String(u.id);
        userNames[uid] = u.nome;
        ensureColor(uid);
      });
      // Ensure current user exists
      if (currentUserData && currentUserData.id != null) {
        const uid = String(currentUserData.id);
        if (!userNames[uid]) userNames[uid] = currentUserData.nome || 'Usuário';
        ensureColor(uid);
      }
  
  // =============================================
  // DADOS DO USUÁRIO - OBTIDOS DO BANCO DE DADOS
  // =============================================
  
  // Esta função simula a obtenção do usuário logado do banco de dados
  // Em uma aplicação real, você substituiria esta função por uma chamada AJAX
  // para seu backend que retorna os dados do usuário autenticado
  function getCurrentUserFromDatabase() {
    // Simulando uma chamada ao banco de dados
    // Em uma aplicação real, isso seria uma requisição AJAX para seu backend
    
    // Dados de exemplo - substitua com dados reais do seu banco
    return {
      id: 'user123', // ID único do usuário
      name: 'João Silva', // Nome do usuário
      email: 'joao.silva@exemplo.com', // Email do usuário
      color: '#e74c3c' // Cor para identificação visual
    };
  }
  
  // Obter o usuário atual do banco de dados
  const currentUser = getCurrentUserFromDatabase();
  
  // =============================================
  // FIM DA INTEGRAÇÃO COM BANCO DE DADOS
  // =============================================
  
  // Funções de utilidade
  function getReservations() {
    const reservations = localStorage.getItem('reservations');
    return reservations ? JSON.parse(reservations) : {};
  }
  
  function saveReservations(reservations) {
    localStorage.setItem('reservations', JSON.stringify(reservations));
  }
  
  function getDateKey(day, month, year) {
    return `${year}-${month + 1}-${day}`;
  }
  
  function isPastDate(day, month, year) {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }
  
  function isPastTime(day, month, year, hour, minute) {
    const dateTime = new Date(year, month, day, hour, minute);
    return dateTime < new Date();
  }
  
  function getTimeSlotByKey(key) {
    const allSlots = [...morningSchedule, ...afternoonSchedule, ...eveningSchedule];
    return allSlots.find(slot => slot.key === key);
  }
  
  // NOVA FUNÇÃO: Gerar minhas reservas no modal
  function generateMyReservations() {
    myReservationsList.innerHTML = '';
    
    const reservations = getReservations();
    const dayReservations = reservations[selectedDateKey] || {};
    
    // Filtrar apenas minhas reservas
    const myReservations = Object.values(dayReservations).filter(reservation => 
      reservation.reserved && reservation.userId === currentUser.id
    );
    
    if (myReservations.length === 0) {
      myReservationsList.innerHTML = '<div class="no-my-reservations">Você não tem reservas para este dia</div>';
      return;
    }
    
    // Agrupar minhas reservas por horário
    const myReservationsByTime = {};
    
    myReservations.forEach(reservation => {
      const timeSlot = getTimeSlotByKey(reservation.originalSlotKey);
      if (timeSlot) {
        const timeKey = `${timeSlot.start}-${timeSlot.end}`;
        if (!myReservationsByTime[timeKey]) {
          myReservationsByTime[timeKey] = {
            time: `${timeSlot.start} às ${timeSlot.end}`,
            reservations: []
          };
        }
        myReservationsByTime[timeKey].reservations.push(reservation);
      }
    });
    
    // Ordenar horários
    const sortedTimes = Object.keys(myReservationsByTime).sort((a, b) => {
      return parseInt(a.split('-')[0].replace(':', '')) - parseInt(b.split('-')[0].replace(':', ''));
    });
    
    // Criar elementos para cada reserva
    sortedTimes.forEach(timeKey => {
      const timeData = myReservationsByTime[timeKey];
      
      timeData.reservations.forEach(reservation => {
        const reservationElement = document.createElement('div');
        reservationElement.classList.add('my-reservation-item');
        
        // Encontrar a chave da reserva
        const reservationKey = Object.keys(dayReservations).find(key => 
          dayReservations[key].originalSlotKey === reservation.originalSlotKey && 
          dayReservations[key].resource === reservation.resource
        );
        
        reservationElement.innerHTML = `
          <div class="my-reservation-info">
            <div class="my-reservation-time">${timeData.time}</div>
            <div class="my-reservation-resource">${reservation.resourceName}</div>
          </div>
          <button class="cancel-reservation-btn" data-reservation-key="${reservationKey}" ${isCancelMode ? '' : 'disabled'}>
            <i class="fas fa-times"></i> ${isCancelMode ? 'Selecionar para Cancelar' : 'Cancelar'}
          </button>
        `;
        
        // Adicionar classe se estiver selecionado para cancelamento
        if (isCancelMode && document.querySelector(`.time-slot[data-slot-key="${reservation.originalSlotKey}"].to-cancel`)) {
          reservationElement.classList.add('to-cancel');
          reservationElement.querySelector('.cancel-reservation-btn').innerHTML = '<i class="fas fa-check"></i> Selecionado';
        }
        
        myReservationsList.appendChild(reservationElement);
      });
    });
    
    // Adicionar eventos aos botões de cancelamento
    document.querySelectorAll('.cancel-reservation-btn').forEach(button => {
      button.addEventListener('click', function() {
        if (!isCancelMode) return;
        
        const reservationKey = this.dataset.reservationKey;
        const reservation = dayReservations[reservationKey];
        
        if (reservation) {
          const timeSlot = document.querySelector(`.time-slot[data-slot-key="${reservation.originalSlotKey}"]`);
          if (timeSlot) {
            timeSlot.classList.toggle('to-cancel');
            
            // Atualizar o texto do botão
            if (timeSlot.classList.contains('to-cancel')) {
              this.innerHTML = '<i class="fas fa-check"></i> Selecionado';
              this.closest('.my-reservation-item').classList.add('to-cancel');
            } else {
              this.innerHTML = '<i class="fas fa-times"></i> Selecionar para Cancelar';
              this.closest('.my-reservation-item').classList.remove('to-cancel');
            }
            
            updateButtonStates();
          }
        }
      });
    });
  }
  
  // Função para mostrar o popup de reservas
  function showReservationsPopup(dayElement, day, month, year) {
    const dateKey = getDateKey(day, month, year);
    const reservations = getReservations();
    const dayReservations = reservations[dateKey];
    
    // Limpar conteúdo anterior
    popupContent.innerHTML = '';
    
    // Atualizar título
    popupTitle.textContent = `Reservas para ${day}/${month + 1}/${year}`;
    
    if (!dayReservations || Object.keys(dayReservations).length === 0) {
      popupContent.innerHTML = '<div class="no-reservations">Nenhuma reserva para este dia</div>';
    } else {
      // Agrupar reservas por horário
      const reservationsByTime = {};
      
      Object.values(dayReservations).forEach(reservation => {
        if (reservation.reserved) {
          const timeSlot = getTimeSlotByKey(reservation.originalSlotKey);
          if (timeSlot) {
            const timeKey = `${timeSlot.start}-${timeSlot.end}`;
            if (!reservationsByTime[timeKey]) {
              reservationsByTime[timeKey] = {
                time: `${timeSlot.start} às ${timeSlot.end}`,
                reservations: []
              };
            }
            reservationsByTime[timeKey].reservations.push(reservation);
          }
        }
      });
      
      // Ordenar horários
      const sortedTimes = Object.keys(reservationsByTime).sort((a, b) => {
        return parseInt(a.split('-')[0].replace(':', '')) - parseInt(b.split('-')[0].replace(':', ''));
      });
      
      // Criar conteúdo do popup
      if (sortedTimes.length === 0) {
        popupContent.innerHTML = '<div class="no-reservations">Nenhuma reserva para este dia</div>';
      } else {
        sortedTimes.forEach(timeKey => {
          const timeData = reservationsByTime[timeKey];
          const timeElement = document.createElement('div');
          timeElement.classList.add('reservation-item');
          
          timeElement.innerHTML = `
            <div class="reservation-time">${timeData.time}</div>
          `;
          
          timeData.reservations.forEach(reservation => {
            const reservationElement = document.createElement('div');
            reservationElement.classList.add('reservation-detail');
            reservationElement.innerHTML = `
              <div><strong>Recurso:</strong> ${reservation.resourceName}</div>
              <div class="reservation-user">
                <span class="user-badge" style="background-color: ${reservation.userColor || '#e74c3c'}"></span>
                ${reservation.userName}
              </div>
            `;
            timeElement.appendChild(reservationElement);
          });
          
          popupContent.appendChild(timeElement);
        });
      }
    }
    
    // Posicionar o popup
    const rect = dayElement.getBoundingClientRect();
    const calendarRect = calendarDays.getBoundingClientRect();
    
    let top = rect.bottom + window.scrollY;
    let left = rect.left + window.scrollX;
    
    // Ajustar posição se o popup ultrapassar a tela
    if (left + 280 > window.innerWidth) {
      left = window.innerWidth - 280;
    }
    
    if (top + 300 > window.innerHeight) {
      top = rect.top + window.scrollY - 300;
    }
    
    reservationsPopup.style.top = top + 'px';
    reservationsPopup.style.left = left + 'px';
    reservationsPopup.classList.add('visible');
    
    // Configurar timeout para fechar o popup
    clearTimeout(popupTimeout);
    popupTimeout = setTimeout(() => {
      reservationsPopup.classList.remove('visible');
    }, 5000); // Fechar após 5 segundos
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
    
    // Obter reservas
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
      const isPast = isPastDate(day, currentMonth, currentYear);
      
      dayElement.classList.add('day');
      
      if (isWeekend) {
        dayElement.classList.add('weekend');
      } else if (isPast) {
        dayElement.classList.add('past');
      } else {
        const dateKey = getDateKey(day, currentMonth, currentYear);
        const dayReservations = reservations[dateKey];
        
        // Contar reservas
        let totalReservations = 0;
        let myReservationsCount = 0;
        
        if (dayReservations) {
          // Contar todas as reservas
          totalReservations = Object.values(dayReservations).filter(r => r.reserved).length;
          
          // Contar minhas reservas
          myReservationsCount = Object.values(dayReservations).filter(r => 
            r.reserved && r.userId === currentUser.id
          ).length;
        }
        
        // Aplicar o filtro atual
        if (currentFilter === 'all') {
          // No filtro "Todas as reservas", mostrar número total de reservas
          if (totalReservations > 0) {
            dayElement.classList.add('has-reservations');
            dayElement.innerHTML = `
              <div class="day-number">${day}</div>
              <div class="day-reservations">${totalReservations} reserva(s)</div>
            `;
          } else {
            dayElement.classList.add('available');
            dayElement.innerHTML = `
              <div class="day-number">${day}</div>
            `;
          }
        } else if (currentFilter === 'my') {
          // No filtro "Minhas reservas", mostrar apenas minhas reservas
          if (myReservationsCount > 0) {
            dayElement.classList.add('has-my-reservations');
            dayElement.innerHTML = `
              <div class="day-number">${day}</div>
              <div class="day-reservations day-my-reservations">${myReservationsCount} minhas</div>
            `;
          } else {
            dayElement.classList.add('available');
            dayElement.innerHTML = `
              <div class="day-number">${day}</div>
            `;
          }
        }
        
        if (!isPast) {
          // Adicionar evento de clique para selecionar o dia
          dayElement.addEventListener('click', () => selectDay(dayElement, day, dayOfWeek));
          
          // Adicionar evento de mouseenter para mostrar reservas
          dayElement.addEventListener('mouseenter', () => {
            showReservationsPopup(dayElement, day, currentMonth, currentYear);
          });
          
          // Adicionar evento de mouseleave para esconder reservas
          dayElement.addEventListener('mouseleave', () => {
            clearTimeout(popupTimeout);
            popupTimeout = setTimeout(() => {
              reservationsPopup.classList.remove('visible');
            }, 300);
          });
        }
      }
      
      calendarDays.appendChild(dayElement);
    }
    
    // Adicionar evento para fechar popup ao clicar fora
    document.addEventListener('click', (e) => {
      if (!reservationsPopup.contains(e.target) && !e.target.closest('.day.available')) {
        reservationsPopup.classList.remove('visible');
      }
    });
  }
  
  // Função para selecionar um dia - ATUALIZADA
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
    updateCancelModeIndicator();
    
    // Limpar seleções de recursos
    clearResourceSelection();
    
    // Gerar os horários
    generateTimeSlots();
    
    // Gerar minhas reservas
    generateMyReservations();
    
    // Mostrar o modal
    modalOverlay.style.display = 'flex';
    
    // Fechar popup de reservas
    reservationsPopup.classList.remove('visible');
  }
  
  // Atualizar indicador de modo de cancelamento
  function updateCancelModeIndicator() {
    if (isCancelMode) {
      cancelModeIndicator.style.display = 'block';
    } else {
      cancelModeIndicator.style.display = 'none';
    }
  }
  
  // Limpar seleção de recursos
  function clearResourceSelection() {
    resourceOptions.forEach(option => {
      option.classList.remove('selected');
    });
    equipmentOptions.classList.remove('visible');
    spaceOptions.classList.remove('visible');
    equipmentSelect.value = '';
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
    const selectedDate = new Date(currentYear, currentMonth, parseInt(selectedDateKey.split('-')[2]));
    
    // Gerar horários da manhã
    morningSchedule.forEach(slot => {
      const reservation = dayReservations[slot.key];
      const isReserved = reservation && reservation.reserved;
      const isMyReservation = isReserved && reservation.userId === currentUser.id;
      const isPast = isPastTime(
        selectedDate.getDate(), 
        currentMonth, 
        currentYear, 
        parseInt(slot.start.split(':')[0]), 
        parseInt(slot.start.split(':')[1])
      );
      
      const timeSlot = createTimeSlotElement(slot, isReserved, isMyReservation, reservation, isPast);
      morningSlots.appendChild(timeSlot);
    });
    
    // Gerar horários da tarde
    afternoonSchedule.forEach(slot => {
      const reservation = dayReservations[slot.key];
      const isReserved = reservation && reservation.reserved;
      const isMyReservation = isReserved && reservation.userId === currentUser.id;
      const isPast = isPastTime(
        selectedDate.getDate(), 
        currentMonth, 
        currentYear, 
        parseInt(slot.start.split(':')[0]), 
        parseInt(slot.start.split(':')[1])
      );
      
      const timeSlot = createTimeSlotElement(slot, isReserved, isMyReservation, reservation, isPast);
      afternoonSlots.appendChild(timeSlot);
    });
    
    // Gerar horários da noite
    eveningSchedule.forEach(slot => {
      const reservation = dayReservations[slot.key];
      const isReserved = reservation && reservation.reserved;
      const isMyReservation = isReserved && reservation.userId === currentUser.id;
      const isPast = isPastTime(
        selectedDate.getDate(), 
        currentMonth, 
        currentYear, 
        parseInt(slot.start.split(':')[0]), 
        parseInt(slot.start.split(':')[1])
      );
      
      const timeSlot = createTimeSlotElement(slot, isReserved, isMyReservation, reservation, isPast);
      eveningSlots.appendChild(timeSlot);
    });
    
    // Atualizar o estado dos botões
    updateButtonStates();
  }
  
  // Função para criar elemento de horário
  function createTimeSlotElement(slot, isReserved, isMyReservation, reservation, isPast) {
    const timeSlot = document.createElement('div');
    timeSlot.classList.add('time-slot');
    timeSlot.dataset.slotKey = slot.key;
    
    if (isPast) {
      timeSlot.classList.add('past');
      timeSlot.innerHTML = `
        <div class="time-slot-number">${slot.number}</div>
        <div class="time-range">${slot.start} às ${slot.end}</div>
        <div class="time-slot-status status-past">Horário passado</div>
      `;
    } else if (isReserved) {
      if (isMyReservation) {
        timeSlot.classList.add('reserved', 'my-reservation');
      } else {
        timeSlot.classList.add('reserved');
      }
      
      let reservedText = isMyReservation ? 'Minha reserva' : 'Reservado';
      if (reservation && reservation.resourceName) {
        reservedText += ` (${reservation.resourceName})`;
      }
      
      timeSlot.innerHTML = `
        <div class="time-slot-number">${slot.number}</div>
        <div class="time-range">${slot.start} às ${slot.end}</div>
        <div class="time-slot-status ${isMyReservation ? 'status-my-reservation' : 'status-reserved'}">${reservedText}</div>
      `;
      
      // Adicionar badge de usuário para diferenciar reservas
      if (reservation && reservation.userId) {
        const userBadge = document.createElement('div');
        userBadge.classList.add('reservation-user-modal');
        userBadge.innerHTML = `
          <span class="user-badge-modal" style="background-color: ${reservation.userColor || '#e74c3c'}"></span>
          ${reservation.userName || reservation.userId}
        `;
        timeSlot.appendChild(userBadge);
      }
      // Admin user selection (if dropdown exists)
      const userSelect = document.getElementById('userSelect');
      if (userSelect) {
        userSelect.addEventListener('change', function() {
          currentUser = String(this.value);
          generateCalendar();
          if (selectedDay) {
            generateTimeSlots();
          }
        });
      }
      
      // Adicionar evento de clique para modo de cancelamento (apenas minhas reservas)
      if (isMyReservation) {
        timeSlot.addEventListener('click', function() {
          if (isCancelMode) {
            this.classList.toggle('to-cancel');
            
            // Atualizar o botão correspondente na lista de minhas reservas
            const reservationKey = Object.keys(getReservations()[selectedDateKey] || {}).find(key => 
              getReservations()[selectedDateKey][key].originalSlotKey === slot.key
            );
            
            const cancelBtn = document.querySelector(`.cancel-reservation-btn[data-reservation-key="${reservationKey}"]`);
            if (cancelBtn) {
              if (this.classList.contains('to-cancel')) {
                cancelBtn.innerHTML = '<i class="fas fa-check"></i> Selecionado';
                cancelBtn.closest('.my-reservation-item').classList.add('to-cancel');
              } else {
                cancelBtn.innerHTML = '<i class="fas fa-times"></i> Selecionar para Cancelar';
                cancelBtn.closest('.my-reservation-item').classList.remove('to-cancel');
              }
            }
            
            updateButtonStates();
          }
        });
      }
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
      <div><strong>Usuário:</strong> ${currentUser.name}</div>
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
      cancelButton.innerHTML = selectedToCancel.length > 0 ? 
        `<i class="fas fa-times"></i> Confirmar Cancelamento (${selectedToCancel.length})` : 
        `<i class="fas fa-times-circle"></i> Cancelar Reservas`;
      reserveButton.disabled = true;
    } else {
      const selectedSlots = document.querySelectorAll('.time-slot.selected');
      const canReserve = selectedSlots.length > 0 && selectedResource;
      
      reserveButton.disabled = !canReserve;
      
      // Verificar se há minhas reservas para este dia
      const reservations = getReservations();
      const dayReservations = reservations[selectedDateKey] || {};
      const hasMyReservations = Object.values(dayReservations).some(r => 
        r.reserved && r.userId === currentUser.id
      );
      
      cancelButton.disabled = !hasMyReservations;
      cancelButton.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Reservas';
    }
  }
  
  // Atualizar aparência do botão de cancelamento
  function updateCancelButton() {
    if (isCancelMode) {
      cancelButton.classList.add('cancel-mode-active');
    } else {
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
      if (type === 'equipment') {
        equipmentOptions.classList.add('visible');
        spaceOptions.classList.remove('visible');
        spaceSelect.value = '';
      } else {
        spaceOptions.classList.add('visible');
        equipmentOptions.classList.remove('visible');
        equipmentSelect.value = '';
      }
      
      updateButtonStates();
    });
  });
  
  // Selecionar equipamento específico
  equipmentSelect.addEventListener('change', function() {
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
  
  // Aplicar filtro
  filterOptions.forEach(option => {
    option.addEventListener('click', function() {
      const filter = this.dataset.filter;
      
      // Desselecionar outros filtros
      filterOptions.forEach(opt => opt.classList.remove('active'));
      
      // Selecionar este filtro
      this.classList.add('active');
      currentFilter = filter;
      
      // Atualizar calendário
      generateCalendar();
    });
  });
  
  // Inicializar filtro "Todas as reservas" como ativo
  document.querySelector('.filter-option[data-filter="all"]').classList.add('active');
  
  // Alternar entre modos de reserva e cancelamento
  cancelButton.addEventListener('click', function() {
    const reservations = getReservations();
    const dayReservations = reservations[selectedDateKey] || {};
    const hasMyReservations = Object.values(dayReservations).some(r => 
      r.reserved && r.userId === currentUser.id
    );
    
    if (!hasMyReservations) {
      alert('Você não tem reservas para cancelar neste dia.');
      return;
    }
    
    if (!isCancelMode) {
      // Entrar no modo de cancelamento
      isCancelMode = true;
      updateCancelButton();
      updateCancelModeIndicator();
      generateMyReservations(); // Atualizar botões para modo de cancelamento
      
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
          // Encontrar a chave da reserva correspondente
          const reservationKey = Object.keys(dayReservations).find(key => 
            dayReservations[key].originalSlotKey === slotKey
          );
          
          if (reservationKey) {
            delete reservations[selectedDateKey][reservationKey];
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
        generateMyReservations();
        generateTimeSlots();
      }
      
      // Sair do modo de cancelamento
      isCancelMode = false;
      updateCancelButton();
      updateCancelModeIndicator();
      generateMyReservations(); // Atualizar botões para modo normal
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
    updateCancelModeIndicator();
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
    
    // Verificar se o usuário já reservou este mesmo recurso nos horários selecionados
    const conflictingSlots = [];
    selectedSlots.forEach(slot => {
      const slotKey = slot.dataset.slotKey;
      const existingReservation = reservations[selectedDateKey][slotKey];
      
      // Verificar se já existe uma reserva para o MESMO RECURSO e MESMO USUÁRIO
      if (existingReservation && existingReservation.reserved && 
          existingReservation.resource === selectedResource &&
          existingReservation.userId === currentUser.id) {
        conflictingSlots.push(slotKey);
      }
    });
    
    if (conflictingSlots.length === 0) {
      // Marcar os horários selecionados como reservados
      selectedSlots.forEach(slot => {
        const slotKey = slot.dataset.slotKey;
        // Criar uma chave única combinando horário e recurso
        const reservationKey = `${slotKey}_${selectedResource}`;
        
        reservations[selectedDateKey][reservationKey] = {
          reserved: true,
          resourceType: selectedResourceType,
          resource: selectedResource,
          resourceName: resourceNames[selectedResource],
          userId: currentUser.id,
          userName: currentUser.name,
          userColor: currentUser.color,
          originalSlotKey: slotKey // Manter referência ao horário original
        };
      });
      
      // Salvar reservas atualizadas
      saveReservations(reservations);
      
      alert(`Reserva confirmada para ${resourceNames[selectedResource]} nos horários:\n- ${selectedTimes.join('\n- ')}`);
      
      // Atualizar o calendário e horários
      generateCalendar();
      generateMyReservations();
      generateTimeSlots();
      
      // Fechar o modal
      closeModalHandler();
    } else {
      alert('Você já possui reservas para este mesmo recurso nos horários selecionados.');
    }
  });
  
  // Inicializar o calendário
  generateCalendar();
});