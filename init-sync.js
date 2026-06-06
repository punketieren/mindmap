(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }

        // ── 1. ytext → PM (правки от других пиров) ───────────────────
        B.ytext.observe((event, txn) => {
            if (txn.origin === 'pm') return; // не обновляем PM его же правками

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

        // ── 2. ytext → markmap ────────────────────────────────────────
        B.ytext.observe(() => {
            B.sendToMapFrame(B.ytext.toString());
        });

        // ── 3. Загрузка файла по умолчанию ───────────────────────────
        // Стратегия: ждём синхронизацию от пиров.
        // Если через 3с ytext всё ещё пустой И нет пиров — грузим файл.
        // Если пиры есть — ждём ещё 2с (они должны прислать данные).
        async function loadDefault() {
            // Есть ли уже данные?
            if (B.ytext.toString().length > 0) {
                console.log('📡 ytext уже заполнен, файл не грузим');
                return;
            }

            const peers = B.provider.webrtcConns?.size ?? 0;
            if (peers > 0) {
                // Есть пиры — ждём ещё 2с чтобы они прислали данные
                console.log(`⏳ Есть ${peers} пиров, ждём их данные...`);
                await new Promise(r => setTimeout(r, 2000));
                if (B.ytext.toString().length > 0) {
                    console.log('📡 Данные от пира получены');
                    return;
                }
            }

            // Грузим файл по умолчанию
            try {
                const res = await fetch('/mindmap/to-do.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                if (text.trim().startsWith('<')) throw new Error('Сервер вернул HTML');
                // Последняя проверка — вдруг пир прислал пока мы грузили
                if (B.ytext.toString().length > 0) return;
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
        }

        setTimeout(loadDefault, 3000);

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
