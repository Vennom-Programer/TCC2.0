document.addEventListener('DOMContentLoaded', function () {
    class ItemManager {
        constructor() {
            this.locations = [];
            this.items = JSON.parse(localStorage.getItem('items')) || [];
            this.selectedLocationType = '';
            this.editingLocationIndex = null;
            
            this.initializeElements();
            this.attachEventListeners();
            this.loadLocationsFromServer();
            this.initializeCategorySelection();
        }
        
        initializeElements() {
            // Formulário principal
            this.itemForm = document.getElementById('itemForm');
            this.saveBtn = document.getElementById('saveBtn');
            this.backBtn = document.getElementById('backBtn');
            this.loadingIndicator = document.getElementById('loadingIndicator');
            this.successMessage = document.getElementById('successMessage');
            this.errorMessage = document.getElementById('errorMessage');
            
            // Elementos de categoria
            this.categoriaBtns = document.querySelectorAll('.categoria-btn');
            this.categoriaSelecionadaInput = document.getElementById('categoria-selecionada');
            this.subcategoriasEquipamento = document.getElementById('subcategorias-equipamento');
            this.subcategoriasEspaco = document.getElementById('subcategorias-espaco');
            this.selectEquipamento = document.getElementById('item-type-equipamento');
            this.selectEspaco = document.getElementById('item-type-espaco');
            
            // Modal de localização
            this.addLocationBtn = document.getElementById('addLocationBtn');
            this.locationModal = document.getElementById('locationModal');
            this.closeModal = document.getElementById('closeModal');
            this.cancelLocation = document.getElementById('cancelLocation');
            this.locationForm = document.getElementById('locationForm');
            this.locationSelect = document.getElementById('item-location');
            this.locationList = document.getElementById('locationList');
            this.locationTypeButtons = document.querySelectorAll('.location-type-btn');
            
            // Campos hidden
            this.categoriaHiddenInput = document.getElementById('categoria-hidden');
            this.tipoHiddenInput = document.getElementById('tipo-hidden');
            
            // Criar campos hidden se não existirem
            if (!this.categoriaHiddenInput) {
                this.categoriaHiddenInput = document.createElement('input');
                this.categoriaHiddenInput.type = 'hidden';
                this.categoriaHiddenInput.name = 'categoria';
                this.categoriaHiddenInput.id = 'categoria-hidden';
                this.itemForm.appendChild(this.categoriaHiddenInput);
            }
            
            if (!this.tipoHiddenInput) {
                this.tipoHiddenInput = document.createElement('input');
                this.tipoHiddenInput.type = 'hidden';
                this.tipoHiddenInput.name = 'item-type';
                this.tipoHiddenInput.id = 'tipo-hidden';
                this.itemForm.appendChild(this.tipoHiddenInput);
            }
        }
        
        attachEventListeners() {
            // Formulário principal
            this.itemForm.addEventListener('submit', (e) => this.handleItemSubmit(e));
            this.backBtn.addEventListener('click', () => this.handleBack());
            
            // Categorias
            this.categoriaBtns.forEach(btn => {
                btn.addEventListener('click', () => this.handleCategorySelection(btn));
            });
            
            if (this.selectEquipamento) {
                this.selectEquipamento.addEventListener('change', () => {
                    this.tipoHiddenInput.value = this.selectEquipamento.value;
                });
            }
            
            if (this.selectEspaco) {
                this.selectEspaco.addEventListener('change', () => {
                    this.tipoHiddenInput.value = this.selectEspaco.value;
                });
            }
            
            // Modal de localização
            this.addLocationBtn.addEventListener('click', () => this.openLocationModal());
            this.closeModal.addEventListener('click', () => this.closeLocationModal());
            this.cancelLocation.addEventListener('click', () => this.closeLocationModal());
            this.locationModal.addEventListener('click', (e) => {
                if (e.target === this.locationModal) this.closeLocationModal();
            });
            
            // Seleção de tipo de localização
            this.locationTypeButtons.forEach(button => {
                button.addEventListener('click', () => this.selectLocationType(button));
            });
            
            // Formulário de localização
            this.locationForm.addEventListener('submit', (e) => this.handleLocationSubmit(e));
        }
        
        initializeCategorySelection() {
            // Selecionar primeira categoria por padrão
            if (this.categoriaBtns.length > 0 && !document.querySelector('.categoria-btn.selected')) {
                this.categoriaBtns[0].click();
            }
        }
        
        handleCategorySelection(btn) {
            // Remover seleção anterior
            this.categoriaBtns.forEach(b => b.classList.remove('selected'));
            
            // Selecionar este botão
            btn.classList.add('selected');
            
            const categoria = btn.dataset.categoria;
            
            // Atualizar campos hidden
            this.categoriaSelecionadaInput.value = categoria;
            this.categoriaHiddenInput.value = categoria;
            
            // Mostrar/ocultar subcategorias apropriadas
            if (categoria === 'equipamento') {
                this.subcategoriasEquipamento.classList.remove('hidden');
                this.subcategoriasEspaco.classList.add('hidden');
                this.selectEquipamento.disabled = false;
                this.selectEspaco.disabled = true;
                this.tipoHiddenInput.value = this.selectEquipamento.value;
            } else if (categoria === 'espaco') {
                this.subcategoriasEspaco.classList.remove('hidden');
                this.subcategoriasEquipamento.classList.add('hidden');
                this.selectEspaco.disabled = false;
                this.selectEquipamento.disabled = true;
                this.tipoHiddenInput.value = this.selectEspaco.value;
            }
        }
        
        // Carregar localizações do servidor
        async loadLocationsFromServer() {
            try {
                const response = await fetch('/api/localizacoes');
                const data = await response.json();
                
                if (data.success) {
                    this.locations = data.localizacoes;
                    this.updateLocationUI();
                } else {
                    console.error('Erro ao carregar localizações:', data.error);
                    this.showError('Erro ao carregar localizações do servidor');
                }
            } catch (error) {
                console.error('Erro ao carregar localizações:', error);
                this.showError('Erro ao conectar com o servidor');
            }
        }
        
        // Atualizar interface com as localizações
        updateLocationUI() {
            this.locationSelect.innerHTML = '<option value="">Selecione uma localização...</option>';
            this.locationList.innerHTML = '';
            
            if (this.locations.length === 0) {
                this.locationList.innerHTML = '<p style="text-align: center; color: #666;">Nenhuma localização cadastrada</p>';
                return;
            }
            
            this.locations.forEach((location) => {
                // Adicionar ao select
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.nome;
                this.locationSelect.appendChild(option);
                
                // Adicionar à lista
                const locationItem = document.createElement('div');
                locationItem.className = 'location-item';
                locationItem.innerHTML = `
                    <span>${location.nome} ${location.tipo ? `- ${location.tipo}` : ''} ${location.predio ? `- ${location.predio}` : ''} ${location.andar ? `- ${location.andar}` : ''}</span>
                    <button type="button" class="remove-location" data-id="${location.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                this.locationList.appendChild(locationItem);
            });
            
            // Adicionar event listeners para os botões de remover
            this.locationList.querySelectorAll('.remove-location').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const locationId = e.currentTarget.getAttribute('data-id');
                    this.removeLocationFromServer(locationId);
                });
            });
        }
        
        // Selecionar tipo de localização
        selectLocationType(button) {
            this.locationTypeButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            this.selectedLocationType = button.dataset.type;
        }
        
        // Abrir modal de localização
        openLocationModal() {
            this.locationModal.style.display = 'flex';
            this.locationForm.reset();
            this.locationTypeButtons.forEach(btn => btn.classList.remove('selected'));
            this.selectedLocationType = '';
            this.editingLocationIndex = null;
        }
        
        // Fechar modal de localização
        closeLocationModal() {
            this.locationModal.style.display = 'none';
        }
        
        // Salvar localização no servidor
        async handleLocationSubmit(e) {
            e.preventDefault();
            
            if (!this.selectedLocationType) {
                this.showError('Por favor, selecione um tipo de localização.', 'locationForm');
                return;
            }

            const locationData = {
                nome: document.getElementById('location-name').value,
            };

            try {
                const response = await fetch('/api/localizacoes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(locationData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Recarregar a lista de localizações
                    await this.loadLocationsFromServer();
                    
                    // Selecionar automaticamente a nova localização
                    this.locationSelect.value = data.localizacao.id;
                    
                    // Fechar o modal
                    this.closeLocationModal();
                    
                    // Mostrar mensagem de sucesso
                    this.showSuccess('Localização criada com sucesso!');
                } else {
                    this.showError(data.error || 'Erro ao criar localização');
                }
                
            } catch (error) {
                console.error('Erro ao salvar localização:', error);
                this.showError('Erro ao conectar com o servidor');
            }
        }
        
        // Remover localização do servidor
        async removeLocationFromServer(locationId) {
            if (!confirm('Tem certeza que deseja remover esta localização?')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/localizacoes/${locationId}`, {
                    method: 'DELETE'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    await this.loadLocationsFromServer();
                    this.showSuccess('Localização removida com sucesso!');
                } else {
                    this.showError(data.error || 'Erro ao remover localização');
                }
            } catch (error) {
                console.error('Erro ao remover localização:', error);
                this.showError('Erro ao conectar com o servidor');
            }
        }
        
        // cadastroItem.js - ATUALIZADO
// ... (código anterior mantido)

// Salvar item - CORRIGIDO: Agora envia para o servidor
async handleItemSubmit(e) {
    e.preventDefault();
    
    // Validar formulário
    if (!this.validateForm()) {
        return;
    }
    
    // Mostrar indicador de carregamento
    this.showLoading(true);
    
    try {
        // Coletar dados do formulário
        const formData = new FormData(this.itemForm);
        
        // Garantir que todos os campos necessários estão incluídos
        const formDataObj = {
            'item-name': document.getElementById('item-name').value,
            'item-type': this.tipoHiddenInput.value,
            'item-description': document.getElementById('item-description').value,
            'item-quantity': document.getElementById('item-quantity').value,
            'item-location': document.getElementById('item-location').value,
            'item-specs': document.getElementById('item-specs').value,
            'categoria': this.categoriaHiddenInput.value
        };
        
        console.log('Enviando dados para o servidor:', formDataObj);
        
        // Enviar para o servidor Flask usando FormData
        const response = await fetch('/cadastroItem.html', {
            method: 'POST',
            body: new URLSearchParams(formDataObj)
        });
        
        if (response.redirected) {
            // Se o servidor redirecionou, seguir o redirecionamento
            window.location.href = response.url;
        } else {
            // Se não houve redirecionamento, verificar se foi bem-sucedido
            const result = await response.text();
            if (response.ok) {
                this.showSuccess('Item cadastrado com sucesso!');
                setTimeout(() => {
                    window.location.href = '/catalogo.html?success=1';
                }, 2000);
            } else {
                throw new Error('Erro do servidor: ' + response.status);
            }
        }
        
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        this.showError('Erro ao salvar item. Tente novamente.');
    } finally {
        this.showLoading(false);
    }
}
        
        // Validar formulário
        validateForm() {
            const name = document.getElementById('item-name').value.trim();
            const categoriaSelecionada = document.querySelector('.categoria-btn.selected');
            const quantidade = document.getElementById('item-quantity').value;
            const localizacao = document.getElementById('item-location').value;
            
            // Limpar mensagens de erro anteriores
            this.clearErrorMessages();
            
            let isValid = true;

            // Validar cada campo individualmente
            if (!name) {
                this.showFieldError('item-name', 'Nome do item é obrigatório');
                isValid = false;
            }

            // Validar se uma categoria foi selecionada
            if (!categoriaSelecionada) {
                this.showError('Por favor, selecione uma categoria (Equipamento ou Espaço)');
                isValid = false;
            }

            // Validar se um tipo foi selecionado na subcategoria
            if (categoriaSelecionada) {
                const categoria = categoriaSelecionada.dataset.categoria;
                let tipoValido = false;
                
                if (categoria === 'equipamento' && this.selectEquipamento && this.selectEquipamento.value) {
                    tipoValido = true;
                } else if (categoria === 'espaco' && this.selectEspaco && this.selectEspaco.value) {
                    tipoValido = true;
                }
                
                if (!tipoValido) {
                    this.showError('Por favor, selecione um tipo para a categoria escolhida');
                    isValid = false;
                }
            }

            if (!quantidade || parseInt(quantidade) <= 0) {
                this.showFieldError('item-quantity', 'Quantidade deve ser maior que zero');
                isValid = false;
            }

            if (!localizacao) {
                this.showFieldError('item-location', 'Localização é obrigatória');
                isValid = false;
            }

            // Se há erros básicos, parar aqui
            if (!isValid) {
                return false;
            }

            // Validar compatibilidade categoria-tipo
            if (categoriaSelecionada) {
                const categoria = categoriaSelecionada.dataset.categoria;
                
                if (categoria === 'equipamento') {
                    const tipoInt = parseInt(this.selectEquipamento.value);
                    if (tipoInt === 3) {
                        this.showFieldError('item-type-equipamento', 'Equipamentos não podem ser do tipo Mobiliário. Selecione outro tipo.');
                        return false;
                    }
                } else if (categoria === 'espaco') {
                    const tipoInt = parseInt(this.selectEspaco.value);
                    if (tipoInt !== 3 && tipoInt !== 5) {
                        this.showFieldError('item-type-espaco', 'Espaços devem ser do tipo Mobiliário ou Outros.');
                        return false;
                    }
                }
            }

            return true;
        }
        
        // Voltar para index
        handleBack() {
            window.location.href = '/index.html';
        }
        
        // Mostrar indicador de carregamento
        showLoading(show) {
            if (show) {
                this.loadingIndicator.style.display = 'block';
                this.saveBtn.disabled = true;
            } else {
                this.loadingIndicator.style.display = 'none';
                this.saveBtn.disabled = false;
            }
        }
        
        // Mostrar mensagem de sucesso
        showSuccess(message) {
            this.successMessage.textContent = message;
            this.successMessage.style.display = 'block';
            this.errorMessage.style.display = 'none';
            
            // Ocultar mensagem após 5 segundos
            setTimeout(() => {
                this.successMessage.style.display = 'none';
            }, 5000);
        }
        
        // Mostrar mensagem de erro
        showError(message, context = 'itemForm') {
            this.errorMessage.textContent = message;
            this.errorMessage.style.display = 'block';
            this.successMessage.style.display = 'none';
            
            // Ocultar mensagem após 5 segundos
            setTimeout(() => {
                this.errorMessage.style.display = 'none';
            }, 5000);
        }
        
        // Mostrar erro em campo específico
        showFieldError(fieldId, message) {
            const field = document.getElementById(fieldId);
            if (!field) return;

            // Remove erro anterior do campo
            const existingError = field.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }

            // Adiciona estilo de erro ao campo
            field.style.borderColor = '#dc3545';
            
            // Cria mensagem de erro para o campo
            const errorSpan = document.createElement('span');
            errorSpan.className = 'field-error';
            errorSpan.style.color = '#dc3545';
            errorSpan.style.fontSize = '12px';
            errorSpan.style.display = 'block';
            errorSpan.style.marginTop = '5px';
            errorSpan.textContent = message;

            field.parentNode.appendChild(errorSpan);

            // Adiciona evento para remover erro quando o campo for modificado
            field.addEventListener('input', function clearError() {
                field.style.borderColor = '';
                if (errorSpan.parentNode) {
                    errorSpan.remove();
                }
                field.removeEventListener('input', clearError);
            }, { once: true });
        }
        
        // Limpar mensagens de erro
        clearErrorMessages() {
            // Remove mensagens de erro gerais
            const formErrors = document.querySelectorAll('.form-error-message');
            formErrors.forEach(error => error.remove());

            // Remove mensagens de erro de campos e estilos
            const fieldErrors = document.querySelectorAll('.field-error');
            fieldErrors.forEach(error => error.remove());

            const fields = this.itemForm.querySelectorAll('input, select, textarea');
            fields.forEach(field => {
                field.style.borderColor = '';
            });
        }
    }
    
    // Inicializar o gerenciador
    new ItemManager();
});