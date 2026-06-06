// =============================================================
// init-editor.js — ТОЛЬКО редактор и кнопки
// Не знает про yjs, сеть, карту, переключение режимов
// Зависит от: prosemirror.bundle.js (схема, команды)
// =============================================================
(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }

        const container = document.getElementById('editor');

        // PM создаём сразу, CM — лениво при первом переключении
        B.createProseMirror(container);

        // ── Обновление индикатора уровня заголовка ────────────────────
        function updateHeadingLevel() {
            const { $from } = window.editorView.state.selection;
            const node  = $from.node($from.depth);
            const level = node?.type.name === 'heading' ? node.attrs.level : 0;
            const span  = document.getElementById('heading-level');
            if (span) span.textContent = level === 0 ? '-' : `H${level}`;
        }
        window.editorView.dom.addEventListener('click', updateHeadingLevel);
        window.editorView.dom.addEventListener('keyup',  updateHeadingLevel);

        // ── Хелперы кнопок ───────────────────────────────────────────
        // фокус возвращаем в активный редактор, не всегда в PM
        function focusActive() {
            const cmVisible = window.cmView && window.cmView.dom.style.display !== 'none';
            cmVisible ? window.cmView.focus() : window.editorView.focus();
        }
        function btn(id, fn) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { fn(); focusActive(); });
        }

        function toggleBlock(typeName) {
            const { state, dispatch } = window.editorView;
            const { $from } = state.selection;
            let depth = $from.depth, found = false;
            while (depth >= 0) {
                if ($from.node(depth).type.name === typeName) { found = true; break; }
                depth--;
            }
            found
                ? B.lift(state, dispatch)
                : B.wrapIn(state.schema.nodes[typeName])(state, dispatch);
        }

        function isInBlock(typeName) {
            const { $from } = window.editorView.state.selection;
            let depth = $from.depth;
            while (depth >= 0) {
                if ($from.node(depth).type.name === typeName) return true;
                depth--;
            }
            return false;
        }

        // ── Марки ────────────────────────────────────────────────────
        // toggleMark сам включает/выключает — работает как тогл
        btn('bold',        () => B.toggleMark(B.mySchema.marks.strong)(window.editorView.state, window.editorView.dispatch));
        btn('italic',      () => B.toggleMark(B.mySchema.marks.em)(window.editorView.state, window.editorView.dispatch));
        btn('strike',      () => B.toggleMark(B.mySchema.marks.strike)(window.editorView.state, window.editorView.dispatch));
        btn('code-inline', () => B.toggleMark(B.mySchema.marks.code)(window.editorView.state, window.editorView.dispatch));
        btn('highlight',   () => B.toggleMark(B.mySchema.marks.mark)(window.editorView.state, window.editorView.dispatch));

        // ── Блоки ────────────────────────────────────────────────────
        btn('ul',    () => toggleBlock('bullet_list'));
        btn('ol',    () => toggleBlock('ordered_list'));
        btn('quote', () => toggleBlock('blockquote'));

        btn('code-block', () => {
            const { state, dispatch } = window.editorView;
            isInBlock('code_block')
                ? B.setBlockType(state.schema.nodes.paragraph)(state, dispatch)
                : B.setBlockType(state.schema.nodes.code_block)(state, dispatch);
        });

        // ── Заголовки ────────────────────────────────────────────────
        btn('heading-up', () => {
            const { state, dispatch } = window.editorView;
            const { $from } = state.selection;
            const node = $from.node($from.depth);
            if (node.type.name === 'heading') {
                B.setBlockType(state.schema.nodes.heading, { level: Math.min(6, node.attrs.level + 1) })(state, dispatch);
            } else {
                B.setBlockType(state.schema.nodes.heading, { level: 1 })(state, dispatch);
            }
            updateHeadingLevel();
        });

        btn('heading-down', () => {
            const { state, dispatch } = window.editorView;
            const { $from } = state.selection;
            const node = $from.node($from.depth);
            if (node.type.name === 'heading') {
                const lv = Math.max(1, node.attrs.level - 1);
                lv === 1
                    ? B.setBlockType(state.schema.nodes.paragraph)(state, dispatch)
                    : B.setBlockType(state.schema.nodes.heading, { level: lv })(state, dispatch);
            }
            updateHeadingLevel();
        });

        // ── Undo / Redo — работают в обоих режимах ───────────────────
        btn('undo', () => {
            const cmVisible = window.cmView && window.cmView.dom.style.display !== 'none';
            if (cmVisible) {
                B.cmUndo(window.cmView);
            } else {
                B.undo(window.editorView.state, window.editorView.dispatch);
            }
        });
        btn('redo', () => {
            const cmVisible = window.cmView && window.cmView.dom.style.display !== 'none';
            if (cmVisible) {
                B.cmRedo(window.cmView);
            } else {
                B.redo(window.editorView.state, window.editorView.dispatch);
            }
        });
        btn('redo', () => {
            const cmVisible = window.cmView && window.cmView.dom.style.display !== 'none';
            if (cmVisible) {
                window.cmView.dom.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true })
                );
            } else {
                B.redo(window.editorView.state, window.editorView.dispatch);
            }
        });

        // ── Ссылка ────────────────────────────────────────────────────
        btn('link', () => {
            const { state, dispatch } = window.editorView;
            const { from, to } = state.selection;
            if (from === to) { alert('Выделите текст'); return; }
            let url = prompt('Введите URL:', 'https://');
            if (!url) return;
            if (!url.startsWith('http')) url = 'https://' + url;
            dispatch(state.tr.addMark(from, to, state.schema.marks.link.create({ href: url })));
        });

        // ── Горизонтальная линия ──────────────────────────────────────
        btn('hr', () => {
            const { state, dispatch } = window.editorView;
            dispatch(state.tr.replaceSelectionWith(state.schema.nodes.horizontal_rule.create()));
        });

        // ── Сохранение файла ─────────────────────────────────────────
        // Сохраняем полный ytext (с yaml) — не PM-документ
        btn('save-btn', () => {
            const md   = B.ytext.toString();
            const blob = new Blob([md], { type: 'text/markdown' });
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'), { href: url, download: 'document.md' });
            a.click();
            URL.revokeObjectURL(url);
        });

        // ── Загрузка файла ────────────────────────────────────────────
        // Пишем в ytext → ySyncPlugin и yCollab сами обновят PM и CM
        btn('load-btn', () => {
            const input = Object.assign(document.createElement('input'), { type:'file', accept:'.md,.txt' });
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const text = await file.text();
                // Записываем в ytext — синхронизируется на все пиры
                B.ydoc.transact(() => {
                    B.ytext.delete(0, B.ytext.length);
                    B.ytext.insert(0, text);
                }, 'load-file');
                console.log('✅ Файл загружен в ytext:', file.name);
            };
            input.click();
        });

        // ── Bubble menu ───────────────────────────────────────────────
        const bubbleMenu = document.getElementById('bubble-menu');
        if (bubbleMenu) {
            document.addEventListener('selectionchange', () => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed || !sel.toString().trim()) {
                    bubbleMenu.classList.remove('visible');
                    return;
                }
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                bubbleMenu.style.left = (rect.left + window.scrollX) + 'px';
                bubbleMenu.style.top  = (rect.top  + window.scrollY - 50) + 'px';
                bubbleMenu.classList.add('visible');
            });
            window.addEventListener('scroll', () => bubbleMenu.classList.remove('visible'));
            document.addEventListener('mousedown', (e) => {
                if (!bubbleMenu.contains(e.target)) bubbleMenu.classList.remove('visible');
            });
        }

        // ── Выпадающие меню ───────────────────────────────────────────
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dd => {
            const toggle  = dd.querySelector(':scope > button');
            const content = dd.querySelector('.dropdown-content');
            if (!toggle || !content) return;
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdowns.forEach(d => d.querySelector('.dropdown-content')?.classList.remove('show'));
                content.classList.toggle('show');
            });
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown'))
                document.querySelectorAll('.dropdown-content.show').forEach(c => c.classList.remove('show'));
        });

        console.log('✅ init-editor.js: PM и CM созданы, кнопки привязаны');
    }
})();
