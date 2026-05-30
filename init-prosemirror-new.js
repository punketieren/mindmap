(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    function init() {
        const B = window.ProseMirrorBundle;
        if (!B) { console.error('prosemirror.bundle.js не загружен'); return; }
        const {
            EditorState, EditorView, mySchema,
            keymap, baseKeymap, history, undo, redo,
            toggleMark, wrapIn, setBlockType, lift,
            buttonStatePlugin,
            ydoc, ytext, yXmlFragment, provider,
            markdownToProseMirror, proseMirrorToMarkdown,
            stripYaml, extractYaml, sendToMapFrame
        } = B;
        //  1. СОЗДАЁМ PROSEMIRROR (один раз, с yjs-плагинами) 
        const { ySyncPlugin, yCursorPlugin, yUndoPlugin } = B;

        const view = new EditorView(document.getElementById('editor'), {
            state: EditorState.create({
                schema: mySchema,
                plugins: [
                    ySyncPlugin(yXmlFragment),
                    yCursorPlugin(provider.awareness),
                    yUndoPlugin(),
                    history(),
                    keymap(baseKeymap),
                    buttonStatePlugin
                ]
            }),
            dispatchTransaction(tr) {
                const newState = view.state.apply(tr);
                view.updateState(newState);
                // PM → ytext (сохраняем yaml из ytext)
                if (tr.docChanged) {
                    const body = proseMirrorToMarkdown(newState.doc);
                    const yaml = extractYaml(ytext.toString());
                    const full = yaml + body;
                    if (full !== ytext.toString()) {
                        ydoc.transact(() => {
                            ytext.delete(0, ytext.length);
                            ytext.insert(0, full);
                        }, 'pm-local');
                    }
                }
                // Обновляем карту
                sendToMapFrame(ytext.toString());
            }
        });
        window.editorView = view;
        //  2. ЗАГРУЗКА ФАЙЛА ПО УМОЛЧАНИЮ 
        async function loadDefaultFile() {
            try {
                const res = await fetch('/printery/mindmap/to-do.md');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const markdown = await res.text();
                if (markdown.trim().startsWith('<!') || markdown.trim().startsWith('<html')) {
                    throw new Error('Сервер вернул HTML');
                }
                // Грузим только body в PM, yaml сохраняем в ytext
                const body = stripYaml(markdown);
                const doc  = await markdownToProseMirror(body);
                // Пишем полный текст в ytext
                if (!ytext.toString()) {
                    ydoc.transact(() => {
                        ytext.delete(0, ytext.length);
                        ytext.insert(0, markdown);
                    }, 'init');
                }
                const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
                view.dispatch(tr);
                console.log('✅ Загружен to-do.md');
            } catch (e) {
                console.warn('❌ Не удалось загрузить to-do.md:', e.message);
                if (!ytext.toString()) {
                    ytext.insert(0, '# Начните писать...\n');
                }
            }
        }
        loadDefaultFile();
        //  3. ОТПРАВКА В КАРТУ ПРИ СТАРТЕ───
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'mapReady') sendToMapFrame(ytext.toString());
            if (e.data?.type === 'levelChanged') {
                const span = document.getElementById('map-level');
                if (span) span.textContent = e.data.level;
            }
        });
        setTimeout(() => sendToMapFrame(ytext.toString()), 500);
        //  4. ОБНОВЛЕНИЕ УРОВНЯ ЗАГОЛОВКА ─
        function updateHeadingLevel() {
            const { $from } = view.state.selection;
            const node  = $from.node($from.depth);
            const level = node?.type.name === 'heading' ? node.attrs.level : 0;
            const span  = document.getElementById('heading-level');
            if (span) span.textContent = level === 0 ? '-' : `H${level}`;
        }
        view.dom.addEventListener('click', updateHeadingLevel);
        view.dom.addEventListener('keyup',  updateHeadingLevel);
        updateHeadingLevel();
        //  5. КНОПКИ ФОРМАТИРОВАНИЯ─
        const btn = (id, fn) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => { fn(); view.focus(); });
        };

        const cmd = (id, command, arg) => btn(id, () => {
            const { state, dispatch } = view;
            if (command === 'toggleMark') {
                const mark = state.schema.marks[arg];
                if (mark) toggleMark(mark)(state, dispatch);
            } else if (command === 'wrapIn') {
                const node = state.schema.nodes[arg];
                if (node) wrapIn(node)(state, dispatch);
            } else if (command === 'setBlockType') {
                const node = state.schema.nodes[arg];
                if (node) setBlockType(node)(state, dispatch);
            }
        });
        cmd('bold',        'toggleMark',  'strong');
        cmd('italic',      'toggleMark',  'em');
        cmd('strike',      'toggleMark',  'strike');
        cmd('code-inline', 'toggleMark',  'code');
        cmd('highlight',   'toggleMark',  'mark');
        cmd('paragraph',   'setBlockType','paragraph');

        // Списки (с переключением)
        function toggleBlock(listType) {
            const { state, dispatch } = view;
            const { $from } = state.selection;
            let depth = $from.depth, found = false;
            while (depth >= 0) {
                if ($from.node(depth).type.name === listType) { found = true; break; }
                depth--;
            }
            found ? lift(state, dispatch) : wrapIn(state.schema.nodes[listType])(state, dispatch);
        }
        btn('ul',    () => toggleBlock('bullet_list'));
        btn('ol',    () => toggleBlock('ordered_list'));
        btn('quote', () => toggleBlock('blockquote'));

        btn('code-block', () => {
            const { state, dispatch } = view;
            const { $from } = state.selection;
            let depth = $from.depth, inCode = false;
            while (depth >= 0) {
                if ($from.node(depth).type.name === 'code_block') { inCode = true; break; }
                depth--;
            }
            inCode
                ? setBlockType(state.schema.nodes.paragraph)(state, dispatch)
                : setBlockType(state.schema.nodes.code_block)(state, dispatch);
        });
        // Заголовки вверх/вниз
        btn('heading-up', () => {
            const { state, dispatch } = view;
            const { $from } = state.selection;
            const node = $from.node($from.depth);
            if (node.type.name === 'heading') {
                setBlockType(state.schema.nodes.heading, { level: Math.min(6, node.attrs.level + 1) })(state, dispatch);
            } else if (node.type.name === 'paragraph') {
                setBlockType(state.schema.nodes.heading, { level: 1 })(state, dispatch);
            }
            updateHeadingLevel();
        });
        btn('heading-down', () => {
            const { state, dispatch } = view;
            const { $from } = state.selection;
            const node = $from.node($from.depth);
            if (node.type.name === 'heading') {
                const lv = Math.max(1, node.attrs.level - 1);
                lv === 1
                    ? setBlockType(state.schema.nodes.paragraph)(state, dispatch)
                    : setBlockType(state.schema.nodes.heading, { level: lv })(state, dispatch);
            }
            updateHeadingLevel();
        });
        // Undo / Redo
        btn('undo', () => undo(view.state, view.dispatch));
        btn('redo', () => redo(view.state, view.dispatch));
        // Ссылка
        btn('link', () => {
            const { state, dispatch } = view;
            const { from, to } = state.selection;
            if (from === to) { alert('Выделите текст'); return; }
            let url = prompt('Введите URL:', 'https://');
            if (!url) return;
            if (!url.startsWith('http')) url = 'https://' + url;
            dispatch(state.tr.addMark(from, to, state.schema.marks.link.create({ href: url })));
        });
        // Горизонтальная линия
        btn('hr', () => {
            const { state, dispatch } = view;
            dispatch(state.tr.replaceSelectionWith(state.schema.nodes.horizontal_rule.create()));
        });
        // ── 6. СОХРАНЕНИЕ / ЗАГРУЗКА ФАЙЛА ─
        btn('save-btn', async () => {
            // Сохраняем полный текст из ytext (с yaml)
            const markdown = ytext.toString();
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'), { href: url, download: 'document.md' });
            a.click();
            URL.revokeObjectURL(url);
        });

        btn('load-btn', () => {
            const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.md,.txt' });
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const text = await file.text();
                // Пишем полный текст в ytext
                ydoc.transact(() => {
                    ytext.delete(0, ytext.length);
                    ytext.insert(0, text);
                }, 'load');
                // Показываем body в PM
                const body = stripYaml(text);
                const doc  = await markdownToProseMirror(body) ?? mySchema.node('doc', null, [
                    mySchema.node('paragraph', null, mySchema.text('Файл пуст'))
                ]);
                view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content));
            };
            input.click();
        });
        // ── 7. BUBBLE MENU─
        const bubbleMenu = document.getElementById('bubble-menu');

        function showBubble(x, y) { bubbleMenu.style.left = x + 'px'; bubbleMenu.style.top = y + 'px'; }
        function hideBubble() { /* управляется через CSS класс */ bubbleMenu.classList.remove('visible'); }

        document.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) { hideBubble(); return; }
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            showBubble(rect.left + window.scrollX, rect.top + window.scrollY - 50);
            bubbleMenu.classList.add('visible');
        });
        window.addEventListener('scroll', hideBubble);
        document.addEventListener('mousedown', (e) => { if (!bubbleMenu.contains(e.target)) hideBubble(); });
        // ── 8. WYSIWYG ↔ CODEMIRROR 
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
        // 9. ВЫПАДАЮЩИЕ МЕНЮ 
        (function () {
            const dropdowns = document.querySelectorAll('.dropdown');
            dropdowns.forEach(dd => {
                const toggle  = dd.querySelector('button');
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
        })();
        // 10. КНОПКА УРОВНЯ КАРТЫ 
        const mapLevelSpan = document.getElementById('map-level');
        if (mapLevelSpan) {
            mapLevelSpan.addEventListener('click', () => {
                const level = parseInt(mapLevelSpan.textContent, 10);
                if (isNaN(level)) return;
                document.getElementById('mapFrame')?.contentWindow?.collapseLevel?.(level);
});    } } // end init()
})();