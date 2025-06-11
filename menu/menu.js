function animação() {
    const menu = document.querySelector('.menu');
    const menuItems = document.querySelectorAll('.menu-item');

    menu.classList.toggle('active');

    menuItems.forEach((item, index) => {
        if (menu.classList.contains('active')) {
            item.style.animation = `fadeIn 0.5s ease forwards ${index / 7 + 0.3}s`;
        } else {
            item.style.animation = '';
        }
    }
)
}