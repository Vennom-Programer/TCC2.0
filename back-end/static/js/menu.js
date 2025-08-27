document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.querySelector('.menu-toggle');
    const menu = document.querySelector('.menu');
    const menuLinks = document.querySelectorAll('.menu a');

    if (menuToggle && menu) {
        menuToggle.addEventListener('click', function () {
            menu.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });

        menuLinks.forEach(link => {
            link.addEventListener('click', function () {
                menu.classList.remove('active');
                menuToggle.classList.remove('active');
            });
        });
    }
});