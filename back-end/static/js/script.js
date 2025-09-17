document.addEventListener('DOMContentLoaded', function () {
    const laboratorioBtn = document.querySelector('.menu-button.laboratorio');
    const auditorioBtn = document.querySelector('.menu-button.auditorio');
    const arquivosBtn = document.querySelector('.menu-button.arquivos');
    const catalogoBtn = document.querySelector('.menu-button.catalogo');

    laboratorioBtn.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.setItem('tipoReserva', 'laboratorio');
        window.location.href = '/calendario.html';
    });

    auditorioBtn.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.setItem('tipoReserva', 'auditorio');
        window.location.href = '/calendario.html';
    });

    arquivosBtn.addEventListener('click', function (e) {
        e.preventDefault();
        localStorage.setItem('tipoReserva', 'arquivos');
        window.location.href = '/calendario.html';
    });

    catalogoBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = '/catalogo.html';
    });
});