
// Отдельный обработчик для скругления правой панели
(function() {
    const leftPanel = document.getElementById('editor-panel');
    const rightPanel = document.getElementById('viewer-panel');
    if (!leftPanel || !rightPanel) return;

    function updateRightPanelRounding() {
        if (leftPanel.classList.contains('collapsed')) {
            rightPanel.classList.add('left-collapsed');
        } else {
            rightPanel.classList.remove('left-collapsed');
        }
    }

    const observer = new MutationObserver(() => updateRightPanelRounding());
    observer.observe(leftPanel, { attributes: true, attributeFilter: ['class'] });
    updateRightPanelRounding();
})();

// Сворачивание левой панели
(function() {
    const panel = document.getElementById('editor-panel');
    const btn = document.getElementById('collapse-editor');
    if (!panel || !btn) return;
    btn.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        btn.textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
    }); })(); 
// Ресайзер (с блокировкой iframe)
(function() {
    const resizer = document.getElementById('resizer');
    const leftPanel = document.getElementById('editor-panel');
    const iframe = document.getElementById('mapFrame');
    if (!resizer || !leftPanel) return;

    let startX, startWidth;
    let isDragging = false;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startWidth = leftPanel.offsetWidth;
        isDragging = true;
        if (iframe) iframe.style.pointerEvents = 'none';
        leftPanel.style.transition = 'none';
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
    }); 
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newWidth = startWidth + (e.clientX - startX);
        newWidth = Math.min(Math.max(newWidth, 200), window.innerWidth * 0.9);
        leftPanel.style.width = newWidth + 'px';
        localStorage.setItem('panelWidth', newWidth);
    }); 
    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            if (iframe) iframe.style.pointerEvents = 'auto';
            leftPanel.style.transition = '';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
    }   }); })(); 
	// Клик по ресайзеру для сворачивания  панели (добавлено после тестов)
(function() {
    const resizer = document.getElementById('resizer');
    const leftPanel = document.getElementById('editor-panel');
    if (!resizer || !leftPanel) return;

    let mouseDownTime = 0;
    let dragHappened = false;

    resizer.addEventListener('mousedown', () => {
        mouseDownTime = Date.now();
        dragHappened = false;   }); 
    resizer.addEventListener('mousemove', () => {
        dragHappened = true;  }); 
    resizer.addEventListener('mouseup', () => {
        if (!dragHappened && (Date.now() - mouseDownTime < 200)) {
            leftPanel.classList.toggle('collapsed');
            const isCollapsed = leftPanel.classList.contains('collapsed');
            localStorage.setItem('panelCollapsed', isCollapsed);
            const btn = document.getElementById('collapse-editor');
            if (btn) btn.textContent = isCollapsed ? '▶' : '◀';
    }   }); })();
// Управление картой (кнопки collapse / expand)
(function() {
    const iframe = document.getElementById('mapFrame');
    const collapseBtn = document.getElementById('collapse');
    const expandBtn = document.getElementById('expand');
    let currentLevel = 6;

    function setLevel(delta) {
        currentLevel = Math.min(9, Math.max(1, currentLevel + delta));
        if (iframe?.contentWindow?.collapseLevel) {
            iframe.contentWindow.collapseLevel(currentLevel);
        }
        const span = document.getElementById('map-level');
        if (span) span.textContent = currentLevel;
    } 
    if (collapseBtn) collapseBtn.onclick = () => setLevel(-1);
    if (expandBtn) expandBtn.onclick = () => setLevel(+1);
})(); 
// Кнопка Fit
(function() {
    const iframe = document.getElementById('mapFrame');
    const fitBtn = document.getElementById('fit-btn');
    if (fitBtn) {
        fitBtn.onclick = () => {
            if (iframe?.contentWindow?.currentMap) {
                iframe.contentWindow.currentMap.fit();
   }     };  } })(); 
// Кнопка Fullscreen (развернуть правую панель)
(function() {
    const iframe = document.getElementById('mapFrame');
    const fullscreenBtn = document.getElementById('fullscreen-map');
    if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
            const panel = document.getElementById('viewer-panel');
            panel.classList.toggle('fullscreen');
            setTimeout(() => {
                if (iframe?.contentWindow?.currentMap) {
                    iframe.contentWindow.currentMap.fit();
                }
            }, 100);
        };
    }
})();
   // Сохранение PNG из карты
const savePngBtn = document.getElementById('save-png');
if (savePngBtn) {
    savePngBtn.addEventListener('click', () => {
        const iframe = document.getElementById('mapFrame');
        if (iframe && iframe.contentWindow && iframe.contentWindow.saveAsPNG) {
            iframe.contentWindow.saveAsPNG();
        } else {
            console.warn('Функция saveAsPNG не найдена в карте');
        }
    });
}