(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }

        // ytext → PM (правки от других пиров)
        B.ytext.observe((event, txn) => {
            if (txn.origin === 'pm') return;
            const view = window.editorView;
            if (!view) return;
            try {
                const body   = B.stripYaml(B.ytext.toString());
                const newDoc = B.markdownToProseMirror(body);
                const tr     = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
                tr.setMeta('yjs-remote', true);
                view.dispatch(tr);
            } catch(e) {
                console.warn('ytext→PM:', e.message);
            }
        });

        // ytext → markmap
        B.ytext.observe(() => {
            B.sendToMapFrame(B.ytext.toString());
        });

        // Загрузка файла по умолчанию
        // Стратегия: слушаем пиров. Если через 5с никто не прислал данные — грузим сами.
        let defaultLoaded = false;

        async function tryLoadDefault() {
            if (defaultLoaded) return;
            if (B.ytext.toString().length > 0) { defaultLoaded = true; return; }
            defaultLoaded = true;
            try {
                const res = await fetch('/mindmap/to-do.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                if (text.trim().startsWith('<')) throw new Error('HTML ответ');
                if (B.ytext.toString().length > 0) return; // пир успел прислать
                B.ydoc.transact(() => {
                    B.ytext.delete(0, B.ytext.length);
                    B.ytext.insert(0, text);
                }, 'load-default');
                console.log('✅ Загружен to-do.md');
            } catch (e) {
                console.warn('❌ Не удалось загрузить:', e.message);
                if (!B.ytext.toString()) B.ytext.insert(0, '# Начните писать...\n');
            }
        }

        // Если пир подключился и прислал данные — отменяем загрузку файла
        B.ytext.observe((event, txn) => {
            if (txn.origin !== 'pm' && txn.origin !== 'load-default' && B.ytext.toString().length > 0) {
                defaultLoaded = true;
            }
        });

        // Страховочный таймаут — 5с
        setTimeout(tryLoadDefault, 5000);

        // Мост с markmap iframe
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'mapReady')     B.sendToMapFrame(B.ytext.toString());
            if (e.data?.type === 'levelChanged') {
                const span = document.getElementById('map-level');
                if (span) span.textContent = e.data.level;
            }
        });
        setTimeout(() => B.sendToMapFrame(B.ytext.toString()), 1000);

        // Переключение режимов
        const wysiwygRadio  = document.querySelector('input[value="wysiwyg"]');
        const markdownRadio = document.querySelector('input[value="markdown"]');
        if (wysiwygRadio && markdownRadio) {
            wysiwygRadio.addEventListener('change',  () => { if (wysiwygRadio.checked)  B.switchToProseMirror(); });
            markdownRadio.addEventListener('change', () => { if (markdownRadio.checked) B.switchToCodeMirror(); });
        }

        // Кнопка уровня карты
        document.getElementById('map-level')?.addEventListener('click', () => {
            const level = parseInt(document.getElementById('map-level').textContent, 10);
            if (!isNaN(level))
                document.getElementById('mapFrame')?.contentWindow?.collapseLevel?.(level);
        });

        console.log('✅ init-sync.js готов');
    }
})();
