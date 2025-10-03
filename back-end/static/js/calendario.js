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
  const prevMonthButton = document.getElementById('prevMonth');
  const nextMonthButton = document.getElementById('nextMonth');
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
  
  // NOVOS ELEMENTOS: Minhas reservas e Indicador
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
  
  // NOVO: Semáforo para operações assíncronas
  let operationInProgress = false;
  
  // CORREÇÃO: Variável global para armazenar reservas
  let currentReservations = {};
  
  // CORREÇÃO: Variáveis para recursos
  let resourceNames = {};
  let availableItems = [];

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
    const uid = String(u.numeroDaMatricula); // CORREÇÃO: usar numeroDaMatricula
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
  // FUNÇÕES CORRIGIDAS PARA CARREGAMENTO DO CATÁLOGO
  // =============================================

  // FUNÇÃO CORRIGIDA: Carregar itens do catálogo nos selects
  async function loadItemsIntoSelects(tipo = 'all') {
      try {
          console.log('Carregando itens do catálogo, tipo:', tipo);
          
          // Determinar a URL baseada no tipo
          let url = '/api/itens/disponiveis';
          if (tipo !== 'all') {
              url += `?tipo=${tipo}`;
          }
          
          const response = await fetch(url);
          
          if (!response.ok) {
              throw new Error(`Erro HTTP: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.error) {
              console.error('Erro do servidor:', data.error);
              throw new Error(data.error);
          }
          
          const items = data.itens || [];
          console.log(`Itens carregados do catálogo (${tipo}):`, items);

          // Limpar selects
          if (equipmentSelect) {
              equipmentSelect.innerHTML = '<option value="">Selecione um equipamento</option>';
          }
          if (spaceSelect) {
              spaceSelect.innerHTML = '<option value="">Selecione um espaço</option>';
          }
          
          // Popular resourceNames com dados do catálogo
          items.forEach(item => {
              resourceNames[item.id] = item.nome;
              
              const option = document.createElement('option');
              option.value = item.id;
              option.textContent = `${item.nome} (${item.quantidade} disponíveis)`;
              option.dataset.resourceName = item.nome;
              option.dataset.quantity = item.quantidade;
              option.dataset.classification = item.id_classificacao;
              
              // Classificar baseado em id_classificacao do catálogo
              if (equipmentSelect && (item.id_classificacao === 1 || item.id_classificacao === 2 || item.id_classificacao === 4)) {
                  equipmentSelect.appendChild(option.cloneNode(true));
              }
              
              if (spaceSelect && item.id_classificacao === 3) {
                  spaceSelect.appendChild(option.cloneNode(true));
              }
          });
          
          // Se não há itens, mostrar mensagem
          if (items.length === 0) {
              if (equipmentSelect && (tipo === 'equipment' || tipo === 'all')) {
                  equipmentSelect.innerHTML = '<option value="">Nenhum equipamento disponível no catálogo</option>';
              }
              if (spaceSelect && (tipo === 'space' || tipo === 'all')) {
                  spaceSelect.innerHTML = '<option value="">Nenhum espaço disponível no catálogo</option>';
              }
          }
          
          return items;
          
      } catch (error) {
          console.error('Erro ao carregar itens do catálogo:', error);
          
          // Fallback para selects vazios com mensagem de erro
          if (equipmentSelect && (tipo === 'equipment' || tipo === 'all')) {
              equipmentSelect.innerHTML = '<option value="">Erro ao carregar equipamentos do catálogo</option>';
          }
          if (spaceSelect && (tipo === 'space' || tipo === 'all')) {
              spaceSelect.innerHTML = '<option value="">Erro ao carregar espaços do catálogo</option>';
          }
          
          return [];
      }
  }

  // FUNÇÃO DE DEBUG ATUALIZADA: Verificar estado dos elementos e dados do catálogo
  function debugResourceSelection() {
      console.log('=== DEBUG RESOURCE SELECTION ===');
      console.log('selectedResourceType:', selectedResourceType);
      console.log('selectedResource:', selectedResource);
      console.log('equipmentSelect options:', equipmentSelect ? equipmentSelect.options.length : 'N/A');
      console.log('spaceSelect options:', spaceSelect ? spaceSelect.options.length : 'N/A');
      console.log('resourceNames (do catálogo):', resourceNames);
      console.log('availableItems (do catálogo):', availableItems);
      
      // Verificar dados específicos do catálogo
      if (equipmentSelect && equipmentSelect.options.length > 0) {
          console.log('Primeiro equipamento:', equipmentSelect.options[1]?.textContent);
      }
      if (spaceSelect && spaceSelect.options.length > 0) {
          console.log('Primeiro espaço:', spaceSelect.options[1]?.textContent);
      }
      
      console.log('================================');
  }

  // NOVA FUNÇÃO: Carregar dados quando o modal abre
  async function loadModalData() {
      try {
          console.log('Carregando dados do modal...');
          
          // Carregar tipos de recursos
          const response = await fetch('/api/recursos/tipos');
          if (response.ok) {
              const data = await response.json();
              console.log('Tipos de recursos:', data.tipos);
          }
          
          // Carregar alguns itens inicialmente (equipamentos) do catálogo
          await loadItemsIntoSelects('equipment');
          
          // Debug
          debugResourceSelection();
          
      } catch (error) {
          console.error('Erro ao carregar dados do modal:', error);
      }
  }

  // =============================================
  // FUNÇÕES DE INTEGRAÇÃO COM BACKEND - CORRIGIDAS
  // =============================================
  
  // Função para buscar reservas do backend
  async function getReservationsFromBackend() {
    try {
      const response = await fetch('/api/reservas');
      if (response.ok) {
        const data = await response.json();
        return data.reservas || {};
      } else {
        console.error('Erro na resposta do servidor:', response.status);
      }
    } catch (error) {
      console.error('Erro ao buscar reservas:', error);
    }
    return {};
  }
  
  // FUNÇÃO CORRIGIDA: Salvar reserva no backend
  async function saveReservationToBackend(reservationData) {
    try {
      const response = await fetch('/api/reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reservationData)
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao salvar reserva');
      }
    } catch (error) {
      console.error('Erro:', error);
      throw error;
    }
  }
  
  // FUNÇÃO CORRIGIDA: Cancelar reserva no backend
  async function cancelReservationInBackend(reservationId) {
    try {
      const response = await fetch(`/api/reservas/${reservationId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao cancelar reserva');
      }
    } catch (error) {
      console.error('Erro:', error);
      throw error;
    }
  }
  
  // FUNÇÃO CORRIGIDA: Buscar itens disponíveis do backend
  async function getAvailableItems() {
    try {
      const response = await fetch('/api/itens');
      if (response.ok) {
        const data = await response.json();
        
        // CORREÇÃO: Popular resourceNames com dados do banco
        if (data.itens && Array.isArray(data.itens)) {
          availableItems = data.itens;
          data.itens.forEach(item => {
            resourceNames[item.id] = item.nome; // CORREÇÃO: usar id como chave
          });
        }
        
        return data.itens || [];
      }
    } catch (error) {
      console.error('Erro ao buscar itens:', error);
    }
    return [];
  }

  // NOVA FUNÇÃO: Buscar usuários (para admin)
  async function getAvailableUsers() {
    try {
      const response = await fetch('/api/admin/usuarios');
      if (response.ok) {
        const data = await response.json();
        return data.usuarios || [];
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
    return [];
  }
  
  // =============================================
  // NOVAS FUNÇÕES MELHORADAS PARA CANCELAMENTO
  // =============================================
  
  // NOVA FUNÇÃO: Verificar se o usuário pode cancelar uma reserva
  function canUserCancelReservation(reservation) {
    // Admin pode cancelar qualquer reserva
    if (currentUserData.role === 'adm') {
      return true;
    }
    
    // CORREÇÃO: Usuário comum só pode cancelar suas próprias reservas
    // Usar numeroDaMatricula para comparação
    return String(reservation.userId) === String(currentUserData.id);
  }

  // NOVA FUNÇÃO: Obter texto descritivo para o cancelamento
  function getCancelConfirmationText(selectedToCancel) {
    if (selectedToCancel.length === 1) {
      const slot = selectedToCancel[0];
      const reservation = getReservationBySlot(slot);
      const resourceName = reservation?.resourceName || 'Recurso desconhecido';
      return `Tem certeza que deseja cancelar a reserva de ${resourceName} no horário ${getTimeSlotText(slot)}?`;
    } else {
      return `Tem certeza que deseja cancelar ${selectedToCancel.length} reservas selecionadas?`;
    }
  }

  // NOVA FUNÇÃO: Obter reserva por slot
  function getReservationBySlot(slotElement) {
    const slotKey = slotElement.dataset.slotKey;
    const dayReservations = currentReservations[selectedDateKey] || {};
    
    const reservationEntry = Object.entries(dayReservations).find(([key, reservation]) => 
      reservation.originalSlotKey === slotKey
    );
    
    return reservationEntry ? reservationEntry[1] : null;
  }

  // NOVA FUNÇÃO: Obter texto do horário
  function getTimeSlotText(slotElement) {
    const timeRange = slotElement.querySelector('.time-range');
    return timeRange ? timeRange.textContent : 'horário desconhecido';
  }

  // FUNÇÃO MELHORADA: Processar cancelamento individual
  async function processSingleCancellation(slotElement) {
    const slotKey = slotElement.dataset.slotKey;
    const dayReservations = currentReservations[selectedDateKey] || {};
    
    // Encontrar a reserva pelo slot key
    const reservationEntry = Object.entries(dayReservations).find(([key, reservation]) => 
      reservation.originalSlotKey === slotKey
    );
    
    if (reservationEntry) {
      const [reservationKey, reservation] = reservationEntry;
      
      // Verificar permissão
      if (!canUserCancelReservation(reservation)) {
        throw new Error('Você não tem permissão para cancelar esta reserva.');
      }
      
      // CORREÇÃO: Usar reservation.id que vem do backend
      await cancelReservationInBackend(reservation.id);
      return { success: true, resourceName: reservation.resourceName };
    }
    
    throw new Error('Reserva não encontrada.');
  }

  // NOVA FUNÇÃO CORRIGIDA: Cancelar reservas selecionadas com Promise.all
  async function cancelSelectedReservations(selectedToCancel) {
    const promises = selectedToCancel.map(slot => 
      processSingleCancellation(slot).catch(error => ({
        success: false,
        error: error.message,
        slot: slot
      }))
    );
    
    const results = await Promise.all(promises);
    return {
      success: results.filter(r => r.success),
      failed: results.filter(r => !r.success)
    };
  }

  // NOVA FUNÇÃO: Mostrar resultados do cancelamento
  function showCancellationResults(results) {
    const successCount = results.success.length;
    const failedCount = results.failed.length;
    
    let message = '';
    
    if (successCount > 0) {
      if (successCount === 1) {
        const resourceName = results.success[0].resourceName;
        message = `Reserva de ${resourceName} cancelada com sucesso!`;
      } else {
        message = `${successCount} reservas canceladas com sucesso!`;
      }
    }
    
    if (failedCount > 0) {
      if (successCount > 0) {
        message += `\n\nNo entanto, ${failedCount} reserva(s) não puderam ser canceladas:`;
      } else {
        message = `${failedCount} reserva(s) não puderam ser canceladas:`;
      }
      
      results.failed.forEach((fail, index) => {
        const resourceName = getReservationBySlot(fail.slot)?.resourceName || 'Recurso desconhecido';
        message += `\n${index + 1}. ${resourceName}: ${fail.error}`;
      });
    }
    
    // Mostrar modal de resultados em vez de alert simples
    showResultModal(message, successCount > 0);
  }

  // NOVA FUNÇÃO: Modal de resultados
  function showResultModal(message, isSuccess) {
    // Criar modal dinâmico para resultados
    const existingModal = document.getElementById('resultModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'resultModal';
    modal.className = 'result-modal-overlay';
    modal.innerHTML = `
      <div class="result-modal ${isSuccess ? 'success' : 'error'}">
        <div class="result-modal-header">
          <i class="fas ${isSuccess ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
          <h3>${isSuccess ? 'Cancelamento Concluído' : 'Erro no Cancelamento'}</h3>
          <button class="close-result-modal">&times;</button>
        </div>
        <div class="result-modal-content">
          <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="result-modal-footer">
          <button class="result-modal-ok-btn">OK</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners para fechar o modal
    modal.querySelector('.close-result-modal').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.querySelector('.result-modal-ok-btn').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // NOVA FUNÇÃO CORRIGIDA: Atualizar interface após cancelamento com semáforo
  async function refreshInterfaceAfterCancellation() {
    if (operationInProgress) return;
    operationInProgress = true;
    
    try {
      // CORREÇÃO: Recarregar reservas do backend primeiro
      currentReservations = await getReservationsFromBackend();
      
      await Promise.all([
        generateTimeSlots(),
        generateMyReservations(),
        generateCalendar()
      ]);
      
      // Sair do modo de cancelamento
      isCancelMode = false;
      updateCancelButton();
      updateCancelModeIndicator();
      await generateMyReservations(); // Atualizar botões para modo normal
      updateButtonStates();
    } finally {
      operationInProgress = false;
    }
  }

  // NOVA FUNÇÃO: Destacar reservas que podem ser canceladas
  function highlightCancellableReservations() {
    document.querySelectorAll('.time-slot.reserved').forEach(slot => {
      const reservation = getReservationBySlot(slot);
      if (reservation && canUserCancelReservation(reservation)) {
        slot.classList.add('cancellable');
        
        // Adicionar tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'cancel-tooltip';
        tooltip.textContent = 'Clique para selecionar para cancelamento';
        slot.appendChild(tooltip);
      }
    });
  }

  // NOVA FUNÇÃO: Remover destaque quando sair do modo de cancelamento
  function removeCancellationHighlights() {
    document.querySelectorAll('.time-slot.cancellable').forEach(slot => {
      slot.classList.remove('cancellable');
      const tooltip = slot.querySelector('.cancel-tooltip');
      if (tooltip) {
        tooltip.remove();
      }
    });
  }
  
  // =============================================
  // FUNÇÕES EXISTENTES ATUALIZADAS
  // =============================================
  
  // NOVA FUNÇÃO: Limpeza de event listeners
  function cleanupEventListeners(selector) {
    document.querySelectorAll(selector).forEach(element => {
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
    });
  }

  // Funções de utilidade
  async function getReservations() {
    // Tenta buscar do backend primeiro
    const backendReservations = await getReservationsFromBackend();
    currentReservations = backendReservations; // Armazenar globalmente
    return backendReservations;
  }
  
  function getDateKey(day, month, year) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

  // NOVA FUNÇÃO: Validar se pode selecionar horário
  function canSelectTimeSlot(slot) {
    // Verificar se já está reservado
    if (slot.classList.contains('reserved')) return false;
    
    // Verificar se está no modo de cancelamento
    if (isCancelMode) return false;
    
    // Verificar se é horário passado
    if (slot.classList.contains('past')) return false;
    
    return true;
  }

  // NOVA FUNÇÃO: Gerar minhas reservas no modal
  async function generateMyReservations() {
    if (!myReservationsList) return;
    
    myReservationsList.innerHTML = '';
    
    const dayReservations = currentReservations[selectedDateKey] || {};
    
    // CORREÇÃO: Filtrar apenas minhas reservas usando numeroDaMatricula
    const myReservations = Object.values(dayReservations).filter(reservation => 
      reservation.reserved && String(reservation.userId) === String(currentUserData.id)
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
        
        reservationElement.innerHTML = `
          <div class="my-reservation-info">
            <div class="my-reservation-time">${timeData.time}</div>
            <div class="my-reservation-resource">${reservation.resourceName}</div>
          </div>
          <button class="cancel-reservation-btn" data-slot-key="${reservation.originalSlotKey}" ${isCancelMode ? '' : 'disabled'}>
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
    
    // Limpar event listeners antigos antes de adicionar novos
    cleanupEventListeners('.cancel-reservation-btn');
    
    // Adicionar eventos aos botões de cancelamento
    document.querySelectorAll('.cancel-reservation-btn').forEach(button => {
      button.addEventListener('click', function() {
        if (!isCancelMode) return;
        
        const slotKey = this.dataset.slotKey;
        const timeSlot = document.querySelector(`.time-slot[data-slot-key="${slotKey}"]`);
        
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
      });
    });
  }
  
  // Função para mostrar o popup de reservas
  async function showReservationsPopup(dayElement, day, month, year) {
    const dateKey = getDateKey(day, month, year);
    const dayReservations = currentReservations[dateKey];
    
    // Limpar conteúdo anterior
    if (popupContent) popupContent.innerHTML = '';
    
    // Atualizar título
    if (popupTitle) popupTitle.textContent = `Reservas para ${day}/${month + 1}/${year}`;
    
    if (!dayReservations || Object.keys(dayReservations).length === 0) {
      if (popupContent) popupContent.innerHTML = '<div class="no-reservations">Nenhuma reserva para este dia</div>';
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
        if (popupContent) popupContent.innerHTML = '<div class="no-reservations">Nenhuma reserva para este dia</div>';
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
          
          if (popupContent) popupContent.appendChild(timeElement);
        });
      }
    }
    
    // Posicionar o popup
    if (reservationsPopup && calendarDays) {
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
  }
  
  // Função para mudar o mês
  function changeMonth(offset) {
    currentMonth += offset;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    generateCalendar();
  }
  
  // Função para gerar o calendário
  async function generateCalendar() {
    if (!calendarDays) return;
    
    calendarDays.innerHTML = '';
    if (monthYearElement) monthYearElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Obter o primeiro dia do mês
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startingDay = firstDay.getDay(); // 0 (Domingo) a 6 (Sábado)
    
    // Obter o último dia do mês
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    
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
        const dayReservations = currentReservations[dateKey];
        
        // Contar reservas
        let totalReservations = 0;
        let myReservationsCount = 0;
        
        if (dayReservations) {
          // Contar todas as reservas
          totalReservations = Object.values(dayReservations).filter(r => r.reserved).length;
          
          // Contar minhas reservas
          myReservationsCount = Object.values(dayReservations).filter(r => 
            r.reserved && String(r.userId) === String(currentUserData.id)
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
              if (reservationsPopup) reservationsPopup.classList.remove('visible');
            }, 300);
          });
        }
      }
      
      calendarDays.appendChild(dayElement);
    }
    
    // Adicionar evento para fechar popup ao clicar fora
    document.addEventListener('click', (e) => {
      if (reservationsPopup && !reservationsPopup.contains(e.target) && !e.target.closest('.day.available')) {
        reservationsPopup.classList.remove('visible');
      }
    });
  }
  
  // FUNÇÃO CORRIGIDA: Selecionar um dia com await
  async function selectDay(dayElement, day, dayOfWeek) {
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
    
    if (selectedDateElement) selectedDateElement.textContent = formattedDate;
    if (modalTitle) modalTitle.textContent = `Horários para ${formattedDate}`;
    
    // Sair do modo de cancelamento ao selecionar novo dia
    isCancelMode = false;
    updateCancelButton();
    updateCancelModeIndicator();
    removeCancellationHighlights();
    
    // Limpar seleções de recursos
    clearResourceSelection();
    
    // CORREÇÃO: Garantir que as reservas estão carregadas
    if (Object.keys(currentReservations).length === 0) {
      currentReservations = await getReservationsFromBackend();
    }
    
    // NOVO: Carregar dados do modal DO CATÁLOGO
    await loadModalData();
    
    // Gerar os horários COM AWAIT
    await generateTimeSlots();
    
    // Gerar minhas reservas COM AWAIT
    await generateMyReservations();
    
    // Mostrar o modal
    if (modalOverlay) modalOverlay.style.display = 'flex';
    
    // Fechar popup de reservas
    if (reservationsPopup) {
      reservationsPopup.classList.remove('visible');
    }
  }

  // Atualizar indicador de modo de cancelamento COM VERIFICAÇÃO DE NULL
  function updateCancelModeIndicator() {
    if (!cancelModeIndicator) return;
    
    if (isCancelMode) {
      cancelModeIndicator.style.display = 'block';
    } else {
      cancelModeIndicator.style.display = 'none';
    }
  }
  
  // Limpar seleção de recursos
  function clearResourceSelection() {
    if (resourceOptions) {
      resourceOptions.forEach(option => {
        option.classList.remove('selected');
      });
    }
    if (equipmentOptions) equipmentOptions.classList.remove('visible');
    if (spaceOptions) spaceOptions.classList.remove('visible');
    if (equipmentSelect) equipmentSelect.value = '';
    if (spaceSelect) spaceSelect.value = '';
    selectedResourceType = null;
    selectedResource = null;
    updateReservationDetails();
  }
  
  // Função para gerar os horários de aula
  async function generateTimeSlots() {
    if (!morningSlots || !afternoonSlots || !eveningSlots) return;
    
    morningSlots.innerHTML = '';
    afternoonSlots.innerHTML = '';
    eveningSlots.innerHTML = '';
    
    const dayReservations = currentReservations[selectedDateKey] || {};
    const selectedDate = new Date(currentYear, currentMonth, parseInt(selectedDateKey.split('-')[2]));
    
    // Limpar event listeners antigos
    cleanupEventListeners('.time-slot');
    
    // Gerar horários da manhã
    morningSchedule.forEach(slot => {
      const reservation = Object.values(dayReservations).find(r => r.originalSlotKey === slot.key);
      const isReserved = reservation && reservation.reserved;
      const isMyReservation = isReserved && String(reservation.userId) === String(currentUserData.id);
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
      const reservation = Object.values(dayReservations).find(r => r.originalSlotKey === slot.key);
      const isReserved = reservation && reservation.reserved;
      const isMyReservation = isReserved && String(reservation.userId) === String(currentUserData.id);
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
      const reservation = Object.values(dayReservations).find(r => r.originalSlotKey === slot.key);
      const isReserved = reservation && reservation.reserved;
      const isMyReservation = isReserved && String(reservation.userId) === String(currentUserData.id);
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
  
  // FUNÇÃO ATUALIZADA: Criar elemento de horário com verificação de permissão
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
      const canCancel = reservation && canUserCancelReservation(reservation);
      
      if (isMyReservation) {
        timeSlot.classList.add('reserved', 'my-reservation');
      } else {
        timeSlot.classList.add('reserved');
      }
      
      if (canCancel) {
        timeSlot.classList.add('user-cancellable');
      }
      
      let reservedText = isMyReservation ? 'Minha reserva' : 'Reservado';
      if (reservation && reservation.resourceName) {
        reservedText += ` (${reservation.resourceName})`;
      }
      
      // Adicionar indicador visual para admin em reservas de outros usuários
      if (!isMyReservation && currentUserData.role === 'adm') {
        reservedText += ' ⚙️'; // Ícone de administrador
      }
      
      timeSlot.innerHTML = `
        <div class="time-slot-number">${slot.number}</div>
        <div class="time-range">${slot.start} às ${slot.end}</div>
        <div class="time-slot-status ${isMyReservation ? 'status-my-reservation' : 'status-reserved'}">${reservedText}</div>
      `;
      
      // Adicionar badge de usuário
      if (reservation && reservation.userId) {
        const userBadge = document.createElement('div');
        userBadge.classList.add('reservation-user-modal');
        userBadge.innerHTML = `
          <span class="user-badge-modal" style="background-color: ${reservation.userColor || '#e74c3c'}"></span>
          ${reservation.userName || reservation.userId}
        `;
        timeSlot.appendChild(userBadge);
      }
      
      // Adicionar evento de clique para modo de cancelamento (apenas se usuário pode cancelar)
      if (canCancel) {
        timeSlot.addEventListener('click', function() {
          if (isCancelMode) {
            this.classList.toggle('to-cancel');
            
            // Atualizar o botão correspondente na lista de minhas reservas
            const cancelBtn = document.querySelector(`.cancel-reservation-btn[data-slot-key="${slot.key}"]`);
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
      
      if (!isCancelMode) {
        timeSlot.addEventListener('click', function() {
          if (canSelectTimeSlot(this)) {
            this.classList.toggle('selected');
            updateButtonStates();
            updateReservationDetails();
          }
        });
      }
    }
    
    return timeSlot;
  }
  
  // Atualizar detalhes da reserva
  function updateReservationDetails() {
    if (!reservationDetails) return;
    
    const selectedSlots = document.querySelectorAll('.time-slot.selected');
    
    if (selectedSlots.length === 0 || !selectedResource) {
      reservationDetails.innerHTML = 'Selecione os horários e um recurso do catálogo para ver os detalhes da reserva.';
      return;
    }
    
    const selectedTimes = Array.from(selectedSlots).map(slot => {
      return slot.querySelector('.time-range').textContent;
    });
    
    // CORREÇÃO: Usar resourceNames do catálogo
    const resourceName = resourceNames[selectedResource] || selectedResource;
    
    reservationDetails.innerHTML = `
      <div><strong>Usuário:</strong> ${currentUserData.nome}</div>
      <div><strong>Recurso:</strong> ${resourceName}</div>
      <div><strong>Horários selecionados:</strong></div>
      <div>${selectedTimes.join(', ')}</div>
    `;
  }
  
  // Função para atualizar o estado dos botões
  function updateButtonStates() {
    if (!reserveButton || !cancelButton) return;
    
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
      // Esta verificação será feita de forma assíncrona quando necessário
      cancelButton.disabled = false;
      cancelButton.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Reservas';
    }
  }
  
  // FUNÇÃO ATUALIZADA: Atualizar aparência do botão de cancelamento
  function updateCancelButton() {
    if (!cancelButton) return;
    
    if (isCancelMode) {
      cancelButton.classList.add('cancel-mode-active');
      cancelButton.innerHTML = '<i class="fas fa-times"></i> Confirmar Cancelamento';
      highlightCancellableReservations();
    } else {
      cancelButton.classList.remove('cancel-mode-active');
      cancelButton.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Reservas';
      removeCancellationHighlights();
    }
  }
  
  // =============================================
  // EVENT LISTENERS ATUALIZADOS PARA CATÁLOGO
  // =============================================
  
  // CORREÇÃO MELHORADA: Selecionar tipo de recurso - CARREGAR ITENS DO CATÁLOGO
  if (resourceOptions) {
    resourceOptions.forEach(option => {
      option.addEventListener('click', async function() {
        const type = this.dataset.type;
        
        console.log('Tipo de recurso selecionado:', type);
        
        // Desselecionar outros recursos
        resourceOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Selecionar este recurso
        this.classList.add('selected');
        selectedResourceType = type;
        
        // Mostrar loading
        if (type === 'equipment' && equipmentSelect) {
          equipmentSelect.innerHTML = '<option value="">Carregando equipamentos do catálogo...</option>';
        } else if (type === 'space' && spaceSelect) {
          spaceSelect.innerHTML = '<option value="">Carregando espaços do catálogo...</option>';
        }
        
        // Mostrar opções apropriadas
        if (type === 'equipment') {
          if (equipmentOptions) equipmentOptions.classList.add('visible');
          if (spaceOptions) spaceOptions.classList.remove('visible');
          if (spaceSelect) spaceSelect.value = '';
          
          // CARREGAR EQUIPAMENTOS DO CATÁLOGO
          await loadItemsIntoSelects('equipment');
        } else {
          if (spaceOptions) spaceOptions.classList.add('visible');
          if (equipmentOptions) equipmentOptions.classList.remove('visible');
          if (equipmentSelect) equipmentSelect.value = '';
          
          // CARREGAR ESPAÇOS DO CATÁLOGO
          await loadItemsIntoSelects('space');
        }
        
        // Debug
        debugResourceSelection();
        
        updateButtonStates();
      });
    });
  }
  
  // Selecionar equipamento específico
  if (equipmentSelect) {
    equipmentSelect.addEventListener('change', function() {
      selectedResource = this.value;
      updateButtonStates();
      updateReservationDetails();
    });
  }
  
  // Selecionar espaço específico
  if (spaceSelect) {
    spaceSelect.addEventListener('change', function() {
      selectedResource = this.value;
      updateButtonStates();
      updateReservationDetails();
    });
  }
  
  // Admin user selection (if dropdown exists)
  const userSelect = document.getElementById('userSelect');
  if (userSelect) {
    userSelect.addEventListener('change', function() {
      currentUserData.id = String(this.value);
      generateCalendar();
      if (selectedDay) {
        generateTimeSlots();
      }
    });
  }
  
  // Aplicar filtro
  if (filterOptions) {
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
  }
  
  // Inicializar filtro "Todas as reservas" como ativo
  if (filterOptions && filterOptions.length > 0) {
    const allFilter = document.querySelector('.filter-option[data-filter="all"]');
    if (allFilter) allFilter.classList.add('active');
  }
  
  // FUNÇÃO MELHORADA: Alternar entre modos de reserva e cancelamento
  if (cancelButton) {
    cancelButton.addEventListener('click', async function() {
      if (operationInProgress) return;
      
      const dayReservations = currentReservations[selectedDateKey] || {};
      
      // Verificar se há reservas que o usuário pode cancelar
      const userCancellableReservations = Object.values(dayReservations).filter(r => 
        r.reserved && canUserCancelReservation(r)
      );
      
      if (userCancellableReservations.length === 0) {
        showResultModal(
          currentUserData.role === 'adm' 
            ? 'Não há reservas para cancelar neste dia.'
            : 'Você não tem reservas para cancelar neste dia.',
          false
        );
        return;
      }
      
      if (!isCancelMode) {
        // Entrar no modo de cancelamento
        isCancelMode = true;
        updateCancelButton();
        updateCancelModeIndicator();
        await generateMyReservations();
        
        // Desselecionar quaisquer horários selecionados para reserva
        document.querySelectorAll('.time-slot.selected').forEach(slot => {
          slot.classList.remove('selected');
        });
        
      } else {
        // Processar cancelamento
        const selectedToCancel = document.querySelectorAll('.time-slot.to-cancel');
        
        if (selectedToCancel.length === 0) {
          showResultModal('Selecione pelo menos um horário para cancelar.', false);
          return;
        }
        
        // Verificar permissões antes de confirmar
        const unauthorizedCancellations = Array.from(selectedToCancel).filter(slot => {
          const reservation = getReservationBySlot(slot);
          return reservation && !canUserCancelReservation(reservation);
        });
        
        if (unauthorizedCancellations.length > 0) {
          showResultModal('Você não tem permissão para cancelar algumas das reservas selecionadas.', false);
          return;
        }
        
        // Confirmar cancelamento com informações detalhadas
        const confirmationMessage = getCancelConfirmationText(selectedToCancel);
        
        if (confirm(confirmationMessage)) {
          try {
            // Mostrar indicador de carregamento
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelando...';
            this.disabled = true;
            
            // Processar cancelamentos
            const results = await cancelSelectedReservations(selectedToCancel);
            
            // Mostrar resultados
            showCancellationResults(results);
            
            // Atualizar interface
            await refreshInterfaceAfterCancellation();
            
          } catch (error) {
            console.error('Erro no cancelamento:', error);
            showResultModal('Erro inesperado ao processar cancelamentos. Tente novamente.', false);
          } finally {
            // Restaurar estado do botão
            this.innerHTML = '<i class="fas fa-times-circle"></i> Cancelar Reservas';
            this.disabled = false;
          }
        }
      }
      
      updateButtonStates();
    });
  }
  
  // FUNÇÃO MELHORADA: Fazer uma reserva com dados do catálogo
  if (reserveButton) {
    reserveButton.addEventListener('click', async function() {
      if (this.disabled || operationInProgress) return;
      
      const selectedSlots = document.querySelectorAll('.time-slot.selected');
      
      if (selectedSlots.length === 0 || !selectedResource) {
        alert('Selecione pelo menos um horário e um recurso do catálogo para reservar.');
        return;
      }
      
      operationInProgress = true;
      
      try {
        // CORREÇÃO: Usar resourceNames do catálogo
        const resourceName = resourceNames[selectedResource] || selectedResource;
        const selectedOption = equipmentSelect?.querySelector(`option[value="${selectedResource}"]`) || 
                             spaceSelect?.querySelector(`option[value="${selectedResource}"]`);
        const quantity = selectedOption?.dataset.quantity || '1';
        
        console.log('Reservando recurso do catálogo:', {
          id: selectedResource,
          nome: resourceName,
          quantidade: quantity
        });
        
        // Criar reservas no backend
        const reservationPromises = Array.from(selectedSlots).map(slot => {
          const slotKey = slot.dataset.slotKey;
          const timeSlot = getTimeSlotByKey(slotKey);
          
          const reservationData = {
            data_reserva: selectedDateKey,
            horario: `${timeSlot.start} às ${timeSlot.end}`,
            recurso: selectedResource,
            id_usuario: currentUserData.id,
            resource_name: resourceName
          };
          
          return saveReservationToBackend(reservationData);
        });
        
        const results = await Promise.allSettled(reservationPromises);
        
        // Verificar resultados
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');
        
        if (failed.length > 0) {
          const errorMessages = failed.map(f => f.reason?.message || 'Erro desconhecido').join('\n• ');
          alert(`${successful} reserva(s) criada(s) com sucesso, mas ${failed.length} falharam:\n• ${errorMessages}`);
        } else {
          alert(`${selectedSlots.length} horário(s) reservado(s) com sucesso para ${resourceName}!`);
        }
        
        // CORREÇÃO: Recarregar reservas e recursos do catálogo
        const [updatedReservations, updatedItems] = await Promise.all([
          getReservationsFromBackend(),
          loadItemsIntoSelects(selectedResourceType)
        ]);
        
        currentReservations = updatedReservations;
        availableItems = updatedItems;
        
        // Atualizar a visualização
        await Promise.all([
          generateTimeSlots(),
          generateMyReservations(),
          generateCalendar()
        ]);
        
        // Desselecionar horários
        selectedSlots.forEach(slot => {
          slot.classList.remove('selected');
        });
        
        // Limpar seleção de recurso
        clearResourceSelection();
        
        // Atualizar botões
        updateButtonStates();
        
      } catch (error) {
        console.error('Erro geral na reserva:', error);
        alert('Erro ao fazer reserva. Tente novamente.');
      } finally {
        operationInProgress = false;
      }
    });
  }
  
  // Fechar modal
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      if (modalOverlay) modalOverlay.style.display = 'none';
      isCancelMode = false;
      updateCancelButton();
      updateCancelModeIndicator();
      removeCancellationHighlights();
    });
  }
  
  // Fechar modal clicando fora
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) {
        modalOverlay.style.display = 'none';
        isCancelMode = false;
        updateCancelButton();
        updateCancelModeIndicator();
        removeCancellationHighlights();
      }
    });
  }
  
  // Navegação do calendário
  if (prevMonthButton) {
    prevMonthButton.addEventListener('click', function() {
      changeMonth(-1);
    });
  }
  
  if (nextMonthButton) {
    nextMonthButton.addEventListener('click', function() {
      changeMonth(1);
    });
  }
  
  // =============================================
  // INICIALIZAÇÃO CORRIGIDA COM CATÁLOGO
  // =============================================
  
  // Inicializar o calendário e carregar dados DO CATÁLOGO
  generateCalendar();
  loadItemsIntoSelects('equipment'); // Carregar equipamentos do catálogo por padrão

  // CORREÇÃO: Carregar reservas e recursos do catálogo na inicialização
  Promise.all([
    getReservationsFromBackend(),
    getAvailableItems()
  ]).then(([reservations, items]) => {
    currentReservations = reservations;
    availableItems = items;
    generateCalendar();
  });

  // Debug inicial
  setTimeout(() => {
    console.log('=== INICIALIZAÇÃO COMPLETA COM CATÁLOGO ===');
    debugResourceSelection();
  }, 1000);
});