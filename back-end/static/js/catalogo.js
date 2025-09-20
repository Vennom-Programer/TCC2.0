 // Controle de modo de acesso
        const adminModeBtn = document.getElementById('adminMode');
        const userModeBtn = document.getElementById('userMode');
        const body = document.body;
        
        // Elementos dos modais
        const editModal = document.getElementById('editModal');
        const addModal = document.getElementById('addModal');
        const closeBtns = document.querySelectorAll('.close-btn');
        const cancelEditBtn = document.getElementById('cancelEdit');
        const cancelAddBtn = document.getElementById('cancelAdd');
        const saveEditBtn = document.getElementById('saveEdit');
        const saveAddBtn = document.getElementById('saveAdd');
        const addResourceBtn = document.getElementById('addResource');
        
        // Campos do formulário
        const editName = document.getElementById('edit-name');
        const editQuantity = document.getElementById('edit-quantity');
        const editId = document.getElementById('edit-id');
        
        const addName = document.getElementById('add-name');
        const addQuantity = document.getElementById('add-quantity');
        const addId = document.getElementById('add-id');
        const addCategory = document.getElementById('add-category');
        const addDescription = document.getElementById('add-description');
        
        // Tabela
        const resourcesTable = document.getElementById('resourcesTable');
        
        // Variável para armazenar a linha sendo editada
        let currentEditRow = null;
        
        // Verificar se já existe um modo salvo
        const savedMode = localStorage.getItem('catalogMode');
        if (savedMode === 'admin') {
            body.classList.add('admin-mode');
        }
        
        adminModeBtn.addEventListener('click', () => {
            const adminPassword = prompt("Digite a senha de administrador:");
            if (adminPassword === "admin123") {
                body.classList.add('admin-mode');
                localStorage.setItem('catalogMode', 'admin');
            } else {
                alert("Senha incorreta. Acesso negado.");
            }
        });
        
        userModeBtn.addEventListener('click', () => {
            body.classList.remove('admin-mode');
            localStorage.setItem('catalogMode', 'user');
        });
        
        // Funcionalidade de pesquisa
        document.getElementById('searchInput').addEventListener('keyup', function() {
            const searchText = this.value.toLowerCase();
            const rows = resourcesTable.querySelectorAll('tr');
            
            rows.forEach(row => {
                const name = row.querySelector('td:first-child').textContent.toLowerCase();
                const id = row.querySelector('td:nth-child(3)').textContent.toLowerCase();
                
                if (name.includes(searchText) || id.includes(searchText)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
        
        // Abrir modal de edição
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('tr');
                const cells = row.querySelectorAll('td');
                
                // Preencher o modal com os dados atuais
                editName.value = cells[0].textContent;
                editQuantity.value = cells[1].textContent;
                editId.value = cells[2].textContent;
                
                // Armazenar a linha sendo editada
                currentEditRow = row;
                
                // Exibir o modal
                editModal.style.display = 'flex';
            });
        });
        
        // Abrir modal de adição
        addResourceBtn.addEventListener('click', () => {
            // Limpar o formulário
            addName.value = '';
            addQuantity.value = '1';
            addId.value = '';
            addCategory.value = '';
            addDescription.value = '';
            
            // Exibir o modal
            addModal.style.display = 'flex';
        });
        
        // Fechar modais
        const closeModal = () => {
            editModal.style.display = 'none';
            addModal.style.display = 'none';
            currentEditRow = null;
        };
        
        closeBtns.forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
        
        cancelEditBtn.addEventListener('click', closeModal);
        cancelAddBtn.addEventListener('click', closeModal);
        
        // Salvar edição
        saveEditBtn.addEventListener('click', () => {
            if (currentEditRow) {
                const cells = currentEditRow.querySelectorAll('td');
                cells[0].textContent = editName.value;
                cells[1].textContent = editQuantity.value;
                cells[2].textContent = editId.value;
                
                alert("Recurso atualizado com sucesso!");
                closeModal();
            }
        });
        
        // Salvar novo recurso
        saveAddBtn.addEventListener('click', () => {
            if (addName.value && addQuantity.value && addId.value) {
                // Criar nova linha na tabela
                const newRow = document.createElement('tr');
                
                newRow.innerHTML = `
                    <td>${addName.value}</td>
                    <td>${addQuantity.value}</td>
                    <td>${addId.value}</td>
                    <td class="actions admin-only">
                        <button class="btn btn-edit" data-id="${addId.value}">Editar</button>
                        <button class="btn btn-delete">Excluir</button>
                    </td>
                `;
                
                // Adicionar a nova linha à tabela
                resourcesTable.appendChild(newRow);
                
                // Adicionar eventos aos novos botões
                newRow.querySelector('.btn-edit').addEventListener('click', function() {
                    const row = this.closest('tr');
                    const cells = row.querySelectorAll('td');
                    
                    editName.value = cells[0].textContent;
                    editQuantity.value = cells[1].textContent;
                    editId.value = cells[2].textContent;
                    
                    currentEditRow = row;
                    editModal.style.display = 'flex';
                });
                
                newRow.querySelector('.btn-delete').addEventListener('click', function() {
                    const row = this.closest('tr');
                    const name = row.querySelector('td:first-child').textContent;
                    if (confirm(`Tem certeza que deseja excluir o recurso "${name}"?`)) {
                        row.remove();
                        alert("Recurso excluído com sucesso!");
                    }
                });
                
                alert("Recurso adicionado com sucesso!");
                closeModal();
            } else {
                alert("Por favor, preencha todos os campos obrigatórios.");
            }
        });
        
        // Fechar modal clicando fora dele
        window.addEventListener('click', (e) => {
            if (e.target === editModal) closeModal();
            if (e.target === addModal) closeModal();
        });
        
        // Adicionar eventos para os botões de excluir
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const row = btn.closest('tr');
                const name = row.querySelector('td:first-child').textContent;
                if (confirm(`Tem certeza que deseja excluir o recurso "${name}"?`)) {
                    row.remove();
                    alert("Recurso excluído com sucesso!");
                }
            });
        });