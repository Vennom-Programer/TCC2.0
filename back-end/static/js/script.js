document.addEventListener('DOMContentLoaded', function () {
    const laboratorioBtn = document.querySelector('.menu-button.laboratorio');
    const auditorioBtn = document.querySelector('.menu-button.auditorio');
    const arquivosBtn = document.querySelector('.menu-button.arquivos');

    laboratorioBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/calendario.html';
    });

    auditorioBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/calendario.html';
    });

    arquivosBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/calendario.html';
    });
});