(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }

        const container = document.getElementById('editor');
        B.createProseMirror(container);

        function updateHeadingLevel() {
            const { $from } = window.editorView.state.selection;
            const node  = $from.node($from.depth);
            const level = node?.type.name === 'heading' ? node.attrs.level : 0;
            const span  = document.getElementById('heading-level');
            if (span) span.textContent = level === 0 ? '-' : `H${level}`;
        }
        window.editorView.dom.addEventListener('click', updateHeadingLevel);
        window.editorView.dom.addEventListener('keyup', updateHeadingLevel);

        function pmActive() {
            const cmw = document.getElementById('cm-wrapper');
            return !cmw || cmw.style.display === 'none';
        }
        function btn(id, fn) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => {
                fn();
                if (pmActive()) window.editorView.focus();
                else window.cmView?.focus();
            });
        }
        function pm() { return window.editorView; }

        function toggleMarkSafe(markName) {
            const mark = B.mySchema.marks[markName];
            if (!mark) { console.warn('Марк не найден:', markName, '| Доступны:', Object.keys(B.mySchema.marks)); return; }
            B.toggleMark(mark)(pm().state, pm().dispatch);
        }

        btn('bold',        () => toggleMarkSafe('strong'));
        btn('italic',      () => toggleMarkSafe('em'));
        btn('strike',      () => toggleMarkSafe('strikethrough')); // исправлено
        btn('code-inline', () => toggleMarkSafe('code'));
        btn('highlight',   () => toggleMarkSafe('mark'));          // нет в GFM — warn в консоли

        function toggleBlock(typeName) {
            const { state, dispatch } = pm();
            const { $from } = state.selection;
            let depth = $from.depth, found = false;
            while (depth >= 0) {
                if ($from.node(depth).type.name === typeName) { found = true; break; }
                depth--;
            }
            found ? B.lift(state, dispatch)
                  : B.wrapIn(state.schema.nodes[typeName])(state, dispatch);
        }

        btn('ul',    () => toggleBlock('bullet_list'));
        btn('ol',    () => toggleBlock('ordered_list'));
        btn('quote', () => toggleBlock('blockquote'));

        btn('code-block', () => {
            const { state, dispatch } = pm();
            const { $from } = state.selection;
            let depth = $from.depth, inCode = false;
            while (depth >= 0) {
                if ($from.node(depth).type.name === 'code_block') { inCode = true; break; }
                depth--;
            }
            inCode ? B.setBlockType(state.schema.nodes.paragraph)(state, dispatch)
                   : B.setBlockType(state.schema.nodes.code_block)(state, dispatch);
        });

        btn('heading-up', () => {
            const { state, dispatch } = pm();
            const node = state.selection.$from.node(state.selection.$from.depth);
            if (node.type.name === 'heading') {
                B.setBlockType(state.schema.nodes.heading, { level: Math.min(6, node.attrs.level + 1) })(state, dispatch);
            } else {
                B.setBlockType(state.schema.nodes.heading, { level: 1 })(state, dispatch);
            }
            updateHeadingLevel();
        });

        btn('heading-down', () => {
            const { state, dispatch } = pm();
            const node = state.selection.$from.node(state.selection.$from.depth);
            if (node.type.name === 'heading') {
                const lv = Math.max(1, node.attrs.level - 1);
                lv === 1 ? B.setBlockType(state.schema.nodes.paragraph)(state, dispatch)
                         : B.setBlockType(state.schema.nodes.heading, { level: lv })(state, dispatch);
            }
            updateHeadingLevel();
        });

        btn('undo', () => {
            if (pmActive()) B.undo(pm().state, pm().dispatch);
            else B.cmUndo(window.cmView);
        });
        btn('redo', () => {
            if (pmActive()) B.redo(pm().state, pm().dispatch);
            else B.cmRedo(window.cmView);
        });

        btn('link', () => {
            const { state, dispatch } = pm();
            const { from, to } = state.selection;
            if (from === to) { alert('Выделите текст'); return; }
            let url = prompt('Введите URL:', 'https://');
            if (!url) return;
            if (!url.startsWith('http')) url = 'https://' + url;
            dispatch(state.tr.addMark(from, to, state.schema.marks.link.create({ href: url })));
        });

        btn('hr', () => {
            const { state, dispatch } = pm();
            dispatch(state.tr.replaceSelectionWith(state.schema.nodes.horizontal_rule.create()));
        });

        btn('save-btn', () => {
            const md   = B.ytext.toString();
            const blob = new Blob([md], { type: 'text/markdown' });
            const url  = URL.createObjectURL(blob);
            Object.assign(document.createElement('a'), { href: url, download: 'document.md' }).click();
            URL.revokeObjectURL(url);
        });

        btn('load-btn', () => {
            const input = Object.assign(document.createElement('input'), { type:'file', accept:'.md,.txt' });
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const text = await file.text();
                B.ydoc.transact(() => {
                    B.ytext.delete(0, B.ytext.length);
                    B.ytext.insert(0, text);
                }, 'load-file');
            };
            input.click();
        });

        // Bubble menu — позиционируется относительно viewport
        // сам элемент #bubble-menu в тулбаре, перемещаем его в body
        const bubbleMenu = document.getElementById('bubble-menu');
        if (bubbleMenu) {
            // Переносим bubble menu в body чтобы позиционирование было глобальным
            document.body.appendChild(bubbleMenu);
            bubbleMenu.style.position = 'fixed';

            window.editorView.dom.addEventListener('mouseup', () => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed || !sel.toString().trim()) {
                    bubbleMenu.classList.remove('visible');
                    return;
                }
                if (!window.editorView.dom.contains(sel.anchorNode)) return;
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                bubbleMenu.style.left = rect.left + 'px';
                bubbleMenu.style.top  = (rect.top - 48) + 'px';
                bubbleMenu.classList.add('visible');
            });
            document.addEventListener('mousedown', (e) => {
                if (!bubbleMenu.contains(e.target)) bubbleMenu.classList.remove('visible');
            });
        }

        document.querySelectorAll('.dropdown').forEach(dd => {
            const toggle  = dd.querySelector(':scope > button');
            const content = dd.querySelector('.dropdown-content');
            if (!toggle || !content) return;
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-content').forEach(c => c.classList.remove('show'));
                content.classList.toggle('show');
            });
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown'))
                document.querySelectorAll('.dropdown-content.show').forEach(c => c.classList.remove('show'));
        });

        console.log('✅ init-editor.js. Марки:', Object.keys(B.mySchema.marks));
    }
})();
