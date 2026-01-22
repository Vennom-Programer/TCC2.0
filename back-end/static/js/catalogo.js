// =============================================
// CONFIGURAÇÃO INICIAL E VARIÁVEIS GLOBAIS
// =============================================

// Informações do usuário (passadas do template Flask)
let userInfo = null;

// Elementos do DOM
const resourcesTable = document.getElementById('resourcesTable');
const searchInput = document.getElementById('searchInput');

// Elementos específicos para admin (apenas se existirem)
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const editId = document.getElementById('edit-id');
const editName = document.getElementById('edit-name');
const editQuantity = document.getElementById('edit-quantity');
const editDescription = document.getElementById('edit-description');
const saveEditBtn = document.getElementById('saveEdit');
const cancelEditBtn = document.getElementById('cancelEdit');
const closeEditModal = document.getElementById('closeEditModal');

// Debug: verificar se elementos foram encontrados
console.log('Modal encontrado:', editModal);
console.log('EditForm encontrado:', editForm);
console.log('closeEditModal encontrado:', closeEditModal);

// Variável para controlar a linha sendo editada
let currentEditRow = null;

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================

function isAdmin() {
    return userInfo && userInfo.is_admin === true;
}

function showAlert(message, type = 'info') {
    // Criar elemento de alerta temporário
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        border-radius: 5px;
        color: white;
        background-color: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        z-index: 10000;
        max-width: 300px;
    `;

    document.body.appendChild(alertDiv);

    // Remover após 3 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 3000);
}

// =============================================
// CARREGAMENTO DE DADOS DO USUÁRIO
// =============================================

async function carregarInformacoesUsuario() {
    try {
        const response = await fetch('/api/usuario/atual');
        const data = await response.json();

        if (data.logado) {
            userInfo = {
                email: data.email,
                nome: data.nome,
                role: data.role,
                id: data.id,
                is_admin: data.is_admin || (data.role && data.role.trim().toLowerCase() === 'admin')
            };
            console.log('Informações do usuário carregadas:', userInfo);
            console.log('Tipo de usuário:', userInfo.is_admin ? 'Administrador (admin)' : 'Professor');
            console.log('Role no banco:', userInfo.role);
            // Aplicar classe no body para exibir colunas/ações de admin no CSS
            try {
                document.body.classList.toggle('admin-mode', !!userInfo.is_admin);
            } catch (e) {
                console.warn('Não foi possível aplicar classe admin-mode no body:', e);
            }
        } else {
            console.log('Usuário não logado');
            userInfo = null;
        }
    } catch (error) {
        console.error('Erro ao carregar informações do usuário:', error);
        userInfo = null;
    }
}

// =============================================
// CARREGAMENTO E EXIBIÇÃO DOS ITENS
// =============================================

async function carregarItensDoCatalogo() {
    try {
        console.log('Carregando itens do catálogo...');

        const response = await fetch('/api/catalogo/itens');
        const data = await response.json();

        if (data.success) {
            console.log('Itens carregados:', data.itens);
            preencherTabela(data.itens);
        } else {
            console.error('Erro ao carregar itens:', data.error);
            showAlert('Erro ao carregar itens do catálogo', 'error');
        }
    } catch (error) {
        console.error('Erro de conexão ao carregar itens:', error);
        showAlert('Erro de conexão ao carregar itens', 'error');
    }
}

function preencherTabela(itens) {
    if (!resourcesTable) {
        console.error('Elemento resourcesTable não encontrado');
        return;
    }

    // Limpar tabela
    resourcesTable.innerHTML = '';

    if (itens.length === 0) {
        const colCount = isAdmin() ? 8 : 7;
        resourcesTable.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px;">Nenhum item cadastrado</td></tr>`;
        return;
    }

    // Adicionar cada item na tabela
    itens.forEach(item => {
        const row = document.createElement('tr');

        // Coluna Ações apenas para admin
        const acoes = isAdmin() ? `
            <td class="admin-only admin-actions">
                <button class="btn btn-primary" data-action="edit" data-id="${item.id}" title="Editar item">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger" data-action="delete" data-id="${item.id}" title="Excluir item">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </td>
        ` : '';

        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.Nome || ''}</td>
            <td>${item.quantidade || 0}</td>
            <td>${item.classificacao || ''}</td>
            <td>${item.localizacao || ''}</td>
            <td>${item.descricao || 'Sem descrição'}</td>
            <td>${item.especificacoestec || 'N/A'}</td>
            ${acoes}
        `;

        resourcesTable.appendChild(row);
    });

    // Adicionar eventos aos botões se for admin
    if (isAdmin()) {
        console.log('👤 Usuário é admin, adicionando eventos aos botões...');
        adicionarEventosBotoesAdmin();
    } else {
        console.log('🔒 Usuário NÃO é admin, botões de ação não serão interativos');
    }
}

// =============================================
// FUNCIONALIDADES DE ADMIN
// =============================================

function adicionarEventosBotoesAdmin() {
    if (!isAdmin()) return;

    console.log('Adicionando eventos aos botões admin...');

    // Eventos para botões de edição (seleciona por data-action)
    const editBtns = document.querySelectorAll('button[data-action="edit"]');
    console.log('Botões de edição encontrados:', editBtns.length);

    editBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('Botão editar clicado!', this);
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');

            // Preencher modal de edição
            if (editId && editName && editQuantity && editDescription) {
                editId.value = this.getAttribute('data-id');
                editName.value = cells[1].textContent.trim(); // Nome
                editQuantity.value = cells[2].textContent.trim(); // Quantidade
                editDescription.value = cells[5].textContent.trim(); // Descrição

                currentEditRow = row;

                if (editModal) {
                    console.log('Abrindo modal...');
                    editModal.classList.add('active');
                }
            }
        });
    });

    // Eventos para botões de exclusão (seleciona por data-action)
    const deleteBtns = document.querySelectorAll('button[data-action="delete"]');
    console.log('Botões de exclusão encontrados:', deleteBtns.length);

    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async function() {
            const itemId = this.getAttribute('data-id');
            const itemName = this.closest('tr').querySelectorAll('td')[1].textContent.trim();

            await excluirItem(itemId, itemName);
        });
    });
}

async function excluirItem(itemId, itemName) {
    console.log('🗑️ Tentativa de exclusão - Verificando permissões...', { isAdmin: isAdmin(), userInfo });

    // Verificação de segurança - validar permissão de admin
    if (!isAdmin()) {
        showAlert('⛔ Você não tem permissão para excluir itens. Apenas administradores podem fazer isso.', 'error');
        console.warn('Tentativa de exclusão por usuário não-admin:', userInfo);
        return;
    }

    console.log('✅ Permissão de admin verificada. Prosseguindo com exclusão...');

    if (!confirm(`🗑️ Tem certeza que deseja excluir o item "${itemName}"?\n\nEsta ação não pode ser desfeita!`)) {
        console.log('❌ Exclusão cancelada pelo usuário');
        return;
    }

    try {
        console.log(`🔄 Excluindo: ID=${itemId} | Nome="${itemName}" | Usuário=${userInfo.nome} (${userInfo.role})`);

        const response = await fetch(`/api/itens/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success) {
            console.log('✅ Item excluído com sucesso:', data.message);
            showAlert(data.message || 'Item excluído com sucesso!', 'success');

            // Recarregar a tabela após 1 segundo para visualizar a mudança
            setTimeout(() => {
                carregarItensDoCatalogo();
            }, 500);
        } else {
            console.error('❌ Erro ao excluir item:', data.error);
            showAlert(`Erro ao excluir: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Erro na requisição de exclusão:', error);
        showAlert('Erro de conexão ao tentar excluir item', 'error');
    }
}

// =============================================
// CONFIGURAÇÃO DE EVENTOS
// =============================================

function configurarEventos() {
    // Evento de pesquisa
    if (searchInput) {
        searchInput.addEventListener('keyup', function() {
            const searchText = this.value.toLowerCase();
            const rows = resourcesTable.querySelectorAll('tr');

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const name = cells[1].textContent.toLowerCase(); // Nome
                    const quantity = cells[2].textContent.toLowerCase(); // Quantidade
                    const classification = cells[3] ? cells[3].textContent.toLowerCase() : '';
                    const location = cells[4] ? cells[4].textContent.toLowerCase() : '';
                    const description = cells[5] ? cells[5].textContent.toLowerCase() : '';
                    const specs = cells[6] ? cells[6].textContent.toLowerCase() : '';

                    if (name.includes(searchText) ||
                        classification.includes(searchText) ||
                        location.includes(searchText) ||
                        description.includes(searchText) ||
                        specs.includes(searchText) ||
                        quantity.includes(searchText)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                }
            });
        });
    }

    // Eventos do modal de edição (apenas para admin)
    if (editModal) {
        // Botão salvar edição
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', async () => {
                // Verificação de segurança - validar permissão de admin ANTES de fazer qualquer coisa
                if (!isAdmin()) {
                    showAlert('⛔ Você não tem permissão para editar itens. Apenas administradores podem fazer isso.', 'error');
                    console.warn('Tentativa de edição por usuário não-admin:', userInfo);
                    fecharModalEdicao();
                    return;
                }

                if (currentEditRow) {

                    try {
                        const itemId = editId.value;
                        const updatedData = {
                            nome: editName.value.trim(),
                            quantidade: parseInt(editQuantity.value),
                            descricao: editDescription.value.trim()
                        };

                        // Validação básica
                        if (!updatedData.nome) {
                            showAlert('O nome do item é obrigatório', 'error');
                            return;
                        }

                        if (updatedData.quantidade <= 0) {
                            showAlert('A quantidade deve ser maior que zero', 'error');
                            return;
                        }

                        console.log('📝 Atualizando item:', { id: itemId, nome: updatedData.nome, quantidade: updatedData.quantidade, usuario: userInfo.nome, role: userInfo.role });

                        const response = await fetch(`/api/itens/${itemId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(updatedData)
                        });

                        const data = await response.json();

                        if (data.success) {
                            console.log('✅ Item atualizado com sucesso:', data.message);
                            showAlert(data.message || 'Item atualizado com sucesso!', 'success');

                            // Atualizar visualmente
                            const cells = currentEditRow.querySelectorAll('td');
                            cells[1].textContent = updatedData.nome; // Nome
                            cells[2].textContent = updatedData.quantidade; // Quantidade
                            cells[5].textContent = updatedData.descricao; // Descrição

                            fecharModalEdicao();
                        } else {
                            console.error('❌ Erro ao atualizar item:', data.error);
                            showAlert(`Erro ao atualizar: ${data.error}`, 'error');
                        }
                    } catch (error) {
                        console.error('Erro na requisição de atualização:', error);
                        showAlert('Erro de conexão ao atualizar recurso', 'error');
                    }
                }
            });
        }

        // Botão cancelar edição
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', fecharModalEdicao);
        }

        // Botão fechar modal
        if (closeEditModal) {
            closeEditModal.addEventListener('click', fecharModalEdicao);
        }

        // Fechar modal clicando fora
        window.addEventListener('click', (e) => {
            if (e.target === editModal) {
                fecharModalEdicao();
            }
        });
    }
}

function fecharModalEdicao() {
    if (editModal) {
        editModal.classList.remove('active');
        currentEditRow = null;
        if (editForm) {
            editForm.reset();
        }
    }
}

// =============================================
// INICIALIZAÇÃO
// =============================================

async function inicializarCatalogo() {
    console.log('Inicializando catálogo...');

    // Carregar informações do usuário
    await carregarInformacoesUsuario();

    // Carregar itens do catálogo
    await carregarItensDoCatalogo();

    // Configurar eventos
    configurarEventos();

    console.log('Catálogo inicializado com sucesso');
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', inicializarCatalogo);
