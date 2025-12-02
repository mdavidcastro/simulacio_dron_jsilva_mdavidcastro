function toggleAccordion(id) {
            const content = document.getElementById('acc' + id);
            const icon = document.getElementById('icon' + id);

            content.classList.toggle('accordion-open');
            icon.textContent = icon.textContent === '▼' ? '▲' : '▼';
        }