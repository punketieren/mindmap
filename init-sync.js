// init-sync.js — ТОЛЬКО связи между частями системы
// Отвечает за: ytext↔PM, ytext↔markmap, загрузка файла, переключение режимов, уровень карты
(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }

        // ── 1. yXmlFragment → ytext (для CM и markmap) 
        // Когда PM меняет yXmlFragment через ySyncPlugin,сериализуем в markdown и пишем в ytext
        // НО: только body, yaml берём из текущего ytext
        B.yXmlFragment.observeDeep(() => {
            // Пропускаем если изменение пришло из самого ytext (избегаем петли)
            try {
                const body = B.proseMirrorToMarkdown(window.editorView.state.doc);
                const yaml = B.extractYaml(B.ytext.toString());
                const full = yaml + body;
                if (full !== B.ytext.toString()) {
                    B.ydoc.transact(() => {
                        B.ytext.delete(0, B.ytext.length);
                        B.ytext.insert(0, full);
                    }, 'xml-to-text');
                }
            } catch(e) { /* PM ещё не готов */ }
        });
        //  2. ytext → markmap (при любом изменении текста) 
        B.ytext.observe(() => {
            B.sendToMapFrame(B.ytext.toString());
        });
        // ── 3. Загрузка файла по умолчанию 
        // Ждём 2с — вдруг пир уже передаст данные
        // Загружаем только если ytext всё ещё пустой
        setTimeout(async () => {
            if (B.ytext.toString().length > 0) {
                console.log('📡 Данные получены от пира, файл не загружаем');
                return;
            }
            try {
                const res = await fetch('/mindmap/to-do.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                if (text.trim().startsWith('<!') || text.trim().startsWith('<html'))
                    throw new Error('Сервер вернул HTML');
                // Пишем в ytext — ySyncPlugin обновит PM, yCollab обновит CM
                B.ydoc.transact(() => {
                    B.ytext.delete(0, B.ytext.length);
                    B.ytext.insert(0, text);
                }, 'load-default');
                console.log('✅ Загружен to-do.md');
            } catch (e) {
                console.warn('❌ Не удалось загрузить to-do.md:', e.message);
                if (!B.ytext.toString()) {
                    B.ytext.insert(0, '# Начните писать...\n');
                }
            }
        }, 2000);

        // ── 4. Мост с markmap iframe 
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'mapReady') {
                B.sendToMapFrame(B.ytext.toString());
            }
            if (e.data?.type === 'levelChanged') {
                const span = document.getElementById('map-level');
                if (span) span.textContent = e.data.level;
            }
        });
        // Страховочный пуш
        setTimeout(() => B.sendToMapFrame(B.ytext.toString()), 1000);

        //  5. Переключение режимов WYSIWYG ↔ Markdown 
        const wysiwygRadio  = document.querySelector('input[value="wysiwyg"]');
        const markdownRadio = document.querySelector('input[value="markdown"]');

        if (wysiwygRadio && markdownRadio) {
            wysiwygRadio.addEventListener('change', () => {
                if (wysiwygRadio.checked) B.switchToProseMirror();
            });
            markdownRadio.addEventListener('change', () => {
                if (markdownRadio.checked) B.switchToCodeMirror();
            });
        }
        // ── 6. Кнопка уровня карты 
        const mapLevelSpan = document.getElementById('map-level');
        if (mapLevelSpan) {
            mapLevelSpan.addEventListener('click', () => {
                const level = parseInt(mapLevelSpan.textContent, 10);
                if (!isNaN(level))
                    document.getElementById('mapFrame')?.contentWindow?.collapseLevel?.(level);
            });
        }

        console.log('✅ init-sync.js: все связи настроены');
    }
})();
