(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }

        // ── 1. ytext → PM (входящие правки от других пиров) ─────────
        // Когда ytext меняется извне (не из PM) — обновляем PM-документ
        B.ytext.observe((event, txn) => {
            // Пропускаем изменения которые сам PM только что записал
            if (txn.origin === 'pm') return;

            const view = window.editorView;
            if (!view) return;

            try {
                const body    = B.stripYaml(B.ytext.toString());
                const newDoc  = B.markdownToProseMirror(body);
                const tr      = view.state.tr.replaceWith(
                    0, view.state.doc.content.size, newDoc.content
                );
                tr.setMeta('yjs-remote', true); // чтобы PM не записал это обратно в ytext
                view.dispatch(tr);
            } catch(e) {
                console.warn('ytext→PM sync error:', e.message);
            }
        });

        // ── 2. ytext → markmap ────────────────────────────────────────
        B.ytext.observe(() => {
            B.sendToMapFrame(B.ytext.toString());
        });

        // ── 3. Загрузка файла по умолчанию ───────────────────────────
        // Ждём 2с — если пир уже прислал данные, не перезаписываем
        setTimeout(async () => {
            if (B.ytext.toString().length > 0) {
                console.log('📡 Данные от пира получены, файл не загружаем');
                return;
            }
            try {
                const res = await fetch('/mindmap/to-do.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                if (text.trim().startsWith('<!') || text.trim().startsWith('<html'))
                    throw new Error('Сервер вернул HTML');
                B.ydoc.transact(() => {
                    B.ytext.delete(0, B.ytext.length);
                    B.ytext.insert(0, text);
                }, 'load-default');
                console.log('✅ Загружен to-do.md');
            } catch (e) {
                console.warn('❌ Не удалось загрузить:', e.message);
                if (!B.ytext.toString())
                    B.ytext.insert(0, '# Начните писать...\n');
            }
        }, 2000);

        // ── 4. Мост с markmap iframe ──────────────────────────────────
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'mapReady')     B.sendToMapFrame(B.ytext.toString());
            if (e.data?.type === 'levelChanged') {
                const span = document.getElementById('map-level');
                if (span) span.textContent = e.data.level;
            }
        });
        setTimeout(() => B.sendToMapFrame(B.ytext.toString()), 1000);

        // ── 5. Переключение режимов ───────────────────────────────────
        const wysiwygRadio  = document.querySelector('input[value="wysiwyg"]');
        const markdownRadio = document.querySelector('input[value="markdown"]');
        if (wysiwygRadio && markdownRadio) {
            wysiwygRadio.addEventListener('change',  () => { if (wysiwygRadio.checked)  B.switchToProseMirror(); });
            markdownRadio.addEventListener('change', () => { if (markdownRadio.checked) B.switchToCodeMirror(); });
        }

        // ── 6. Кнопка уровня карты ────────────────────────────────────
        document.getElementById('map-level')?.addEventListener('click', () => {
            const level = parseInt(document.getElementById('map-level').textContent, 10);
            if (!isNaN(level))
                document.getElementById('mapFrame')?.contentWindow?.collapseLevel?.(level);
        });

        console.log('✅ init-sync.js готов');
    }
})();
