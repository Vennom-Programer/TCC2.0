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
                is_admin: data.role === 'adm'
            };
            console.log('Informações do usuário carregadas:', userInfo);
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
            <td class="admin-only">
                <button class="btn btn-edit" data-id="${item.id}">Editar</button>
                <button class="btn btn-delete" data-id="${item.id}">Excluir</button>
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
        adicionarEventosBotoesAdmin();
    }
}

// =============================================
// FUNCIONALIDADES DE ADMIN
// =============================================

function adicionarEventosBotoesAdmin() {
    if (!isAdmin()) return;

    // Eventos para botões de edição
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const row = this.closest('tr');
            const cells = row.querySelectorAll('td');

            // Preencher modal de edição
            if (editId && editName && editQuantity && editDescription) {
                editId.value = this.getAttribute('data-id');
                editName.value = cells[1].textContent; // Nome
                editQuantity.value = cells[2].textContent; // Quantidade
                editDescription.value = cells[5].textContent; // Descrição

                currentEditRow = row;

                if (editModal) {
                    editModal.style.display = 'flex';
                }
            }
        });
    });

    // Eventos para botões de exclusão
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async function() {
            const itemId = this.getAttribute('data-id');
            const itemName = this.closest('tr').querySelectorAll('td')[1].textContent;

            await excluirItem(itemId, itemName);
        });
    });
}

async function excluirItem(itemId, itemName) {
    if (!confirm(`Tem certeza que deseja excluir o item "${itemName}"? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        console.log(`Tentando excluir item ID: ${itemId}`);

        const response = await fetch(`/api/itens/${itemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success) {
            console.log('Item excluído com sucesso:', data.message);
            showAlert('Item excluído com sucesso!', 'success');

            // Recarregar a tabela
            await carregarItensDoCatalogo();
        } else {
            console.error('Erro ao excluir item:', data.error);
            showAlert(`Erro ao excluir item: ${data.error}`, 'error');
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
    if (isAdmin() && editModal) {
        // Botão salvar edição
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', async () => {
                if (currentEditRow) {
                    try {
                        const itemId = editId.value;
                        const updatedData = {
                            nome: editName.value,
                            quantidade: editQuantity.value,
                            descricao: editDescription.value
                        };

                        console.log('Atualizando item:', itemId, updatedData);

                        const response = await fetch(`/api/itens/${itemId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(updatedData)
                        });

                        const data = await response.json();

                        if (data.success) {
                            console.log('Item atualizado com sucesso:', data.message);

                            // Atualizar visualmente
                            const cells = currentEditRow.querySelectorAll('td');
                            cells[1].textContent = editName.value; // Nome
                            cells[2].textContent = editQuantity.value; // Quantidade
                            cells[5].textContent = editDescription.value; // Descrição

                            showAlert('Recurso atualizado com sucesso!', 'success');
                            fecharModalEdicao();
                        } else {
                            console.error('Erro ao atualizar item:', data.error);
                            showAlert(`Erro ao atualizar recurso: ${data.error}`, 'error');
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
        editModal.style.display = 'none';
        currentEditRow = null;
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
