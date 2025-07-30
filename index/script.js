document.addEventListener('DOMContentLoaded', function () {
    const laboratorioBtn = document.querySelector('.menu-button.laboratorio');
    const auditorioBtn = document.querySelector('.menu-button.auditorio');
    const arquivosBtn = document.querySelector('.menu-button.arquivos');

    laboratorioBtn.addEventListener('click', function (e) {
        e.preventDefault();
        alert('Você clicou em Laboratórios!');
        // window.location.href = 'laboratorios.html'; // Exemplo de redirecionamento
    });

    auditorioBtn.addEventListener('click', function (e) {
        e.preventDefault();
        alert('Você clicou em Auditório!');
        // window.location.href = 'auditorio.html';
    });

    arquivosBtn.addEventListener('click', function (e) {
        e.preventDefault();
        alert('Você clicou em Arquivos Educacionais!');
        // window.location.href = 'arquivos.html';
    });
});