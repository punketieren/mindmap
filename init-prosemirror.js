// Инициализация ProseMirror и связь с картой
(function() { 
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {      init();
    } 
    function init() {
        // Проверяем, что бандл загрузился
        if (!window.ProseMirrorBundle) {
            console.error('prosemirror.bundle.js не загружен');
            return;
        } 
        const { EditorState, EditorView, mySchema, keymap, baseKeymap, history } = window.ProseMirrorBundle; 
        // Начальный документ
        const initialDoc = mySchema.node('doc', null, [
            mySchema.node('paragraph', null, mySchema.text('Начните писать...'))
        ]); 
        // Создаём редактор
        const view = new EditorView(document.getElementById('editor'), {
            state: EditorState.create({
                schema: mySchema,
                doc: initialDoc,
				plugins: [
				history(),
				keymap(baseKeymap),
            window.ProseMirrorBundle.buttonStatePlugin 
				]
    })   }); 
        // Сохраняем глобально (для доступа из других скриптов)
        window.editorView = view; 
		
		async function loadDefaultFile() {
    // Ждём, пока редактор и парсер будут готовы
    if (!window.editorView || !window.ProseMirrorBundle?.markdownToProseMirror) {
        console.log('Редактор или парсер ещё не готовы, повтор через 100ms');
        setTimeout(loadDefaultFile, 100);
        return;
    }
    
    try {
        const response = await fetch('/mindmap/to-do.md');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const markdown = await response.text();
        
        // Проверка, что вернулся не HTML (например, страница 404)
        if (markdown.trim().startsWith('<!DOCTYPE') || markdown.trim().startsWith('<html')) {
            throw new Error('Сервер вернул HTML вместо .md файла');
        }
        
        const doc = await window.ProseMirrorBundle.markdownToProseMirror(markdown);
        const tr = window.editorView.state.tr.replaceWith(0, window.editorView.state.doc.content.size, doc);
        window.editorView.dispatch(tr);
        console.log('✅ Загружен /to-do.md');
    } catch (error) {
        console.warn('❌ Не удалось загрузить /to-do.md:', error.message);
        // Оставляем initialDoc
    }
}

// ВЫЗВАТЬ ПОСЛЕ СОЗДАНИЯ EDITORVIEW:
window.editorView = view; // после этой строки
loadDefaultFile();        // добавить эту строку




	//	const { ydoc, yXmlFragment, provider, ySyncPlugin, yCursorPlugin } = window.ProseMirrorBundle;


		// Привязка кнопок форматирования
const formatBtn = (id, cmd, markName = null) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        if (cmd === 'toggleMark' && markName) {
            const mark = state.schema.marks[markName];
            if (mark) window.ProseMirrorBundle.toggleMark(mark)(state, dispatch);
        } else if (cmd === 'wrapIn') {
            const nodeType = state.schema.nodes[markName];
            if (nodeType) window.ProseMirrorBundle.wrapIn(nodeType)(state, dispatch);
        } else if (cmd === 'setBlockType') {
            const nodeType = state.schema.nodes[markName];
            if (nodeType) window.ProseMirrorBundle.setBlockType(nodeType)(state, dispatch);
        }
        window.editorView.focus();
    });
};
// Обновление отображения уровня заголовка
function updateHeadingLevel() {
    const { state } = window.editorView;
    const { $from } = state.selection;
    const node = $from.node($from.depth);
    const level = (node && node.type.name === 'heading') ? node.attrs.level : 0;
    const span = document.getElementById('heading-level');
    if (span) span.textContent = level === 0 ? '-' : `H${level}`;
}
// Вызываем при каждом изменении выделения
window.editorView.dom.addEventListener('click', updateHeadingLevel);
window.editorView.dom.addEventListener('keyup', updateHeadingLevel);
updateHeadingLevel();
// Жирный Курсив Зачёркнутый Код Подсветка
formatBtn('bold', 'toggleMark', 'strong'); 
formatBtn('italic', 'toggleMark', 'em'); 
formatBtn('strike', 'toggleMark', 'strike'); 
formatBtn('code-inline', 'toggleMark', 'code'); 
formatBtn('highlight', 'toggleMark', 'mark'); 
// Маркированный список (переключение)
const ulBtn = document.getElementById('ul');
if (ulBtn) {
    ulBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { $from } = state.selection;
        
        // Проверяем, находимся ли мы внутри bullet_list
        let depth = $from.depth;
        let isInBulletList = false;
        while (depth >= 0) {
            if ($from.node(depth).type.name === 'bullet_list') {
                isInBulletList = true;
                break;
            }
            depth--;
        }
        
        if (isInBulletList) {
            // Отмена списка
            window.ProseMirrorBundle.lift(state, dispatch);
        } else {
            // Применяем список
            window.ProseMirrorBundle.wrapIn(state.schema.nodes.bullet_list)(state, dispatch);
        }
    });
}

// Нумерованный список
const olBtn = document.getElementById('ol');
if (olBtn) {
    olBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { $from } = state.selection;
        
        // Проверяем, находимся ли мы внутри ordered_list
        let depth = $from.depth;
        let isInOrderedList = false;
        while (depth >= 0) {
            if ($from.node(depth).type.name === 'ordered_list') {
                isInOrderedList = true;
                break;
            }
            depth--;
        }
        
        if (isInOrderedList) {
            // Отмена списка
            window.ProseMirrorBundle.lift(state, dispatch);
        } else {
            // Применяем список
            window.ProseMirrorBundle.wrapIn(state.schema.nodes.ordered_list)(state, dispatch);
        }
    });
}

// Цитата
const quoteBtn = document.getElementById('quote');
if (quoteBtn) {
    quoteBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { $from } = state.selection;
        
        // Проверяем, находимся ли мы внутри blockquote
        let depth = $from.depth;
        let isInBlockquote = false;
        while (depth >= 0) {
            if ($from.node(depth).type.name === 'blockquote') {
                isInBlockquote = true;
                break;
            }
            depth--;
        }
        
        if (isInBlockquote) {
            // Отмена цитаты
            window.ProseMirrorBundle.lift(state, dispatch);
        } else {
            // Применяем цитату
            window.ProseMirrorBundle.wrapIn(state.schema.nodes.blockquote)(state, dispatch);
        }
    });
}

// Блок кода
const codeBlockBtn = document.getElementById('code-block');
if (codeBlockBtn) {
    codeBlockBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { $from } = state.selection;
        
        // Проверяем, находимся ли мы внутри code_block
        let depth = $from.depth;
        let isInCodeBlock = false;
        while (depth >= 0) {
            if ($from.node(depth).type.name === 'code_block') {
                isInCodeBlock = true;
                break;
            }
            depth--;
        }
        
        if (isInCodeBlock) {
            // Отмена блока кода — превращаем в параграф
            window.ProseMirrorBundle.setBlockType(state.schema.nodes.paragraph)(state, dispatch);
        } else {
            // Применяем блок кода
            window.ProseMirrorBundle.setBlockType(state.schema.nodes.code_block)(state, dispatch);
        }
    });
}
// Параграф
formatBtn('paragraph', 'setBlockType', 'paragraph'); 
// Кнопки изменения уровня заголовка (отдельно, потому что нужно передать атрибут level)
const headingUpBtn = document.getElementById('heading-up');
const headingDownBtn = document.getElementById('heading-down'); 
if (headingUpBtn) {
    headingUpBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { $from } = state.selection;
        const node = $from.node($from.depth);
        if (node.type.name === 'heading') {
            const newLevel = Math.min(6, node.attrs.level + 1);
            window.ProseMirrorBundle.setBlockType(state.schema.nodes.heading, { level: newLevel })(state, dispatch);
        } else if (node.type.name === 'paragraph') {
            window.ProseMirrorBundle.setBlockType(state.schema.nodes.heading, { level: 1 })(state, dispatch);
        }
        window.editorView.focus();
        updateHeadingLevel(); // ← ДОБАВИТЬ
    }); 
} 
if (headingDownBtn) {
    headingDownBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { $from } = state.selection;
        const node = $from.node($from.depth);
        if (node.type.name === 'heading') {
            const newLevel = Math.max(1, node.attrs.level - 1);
            if (newLevel === 1) {
                window.ProseMirrorBundle.setBlockType(state.schema.nodes.paragraph)(state, dispatch);
            } else {
                window.ProseMirrorBundle.setBlockType(state.schema.nodes.heading, { level: newLevel })(state, dispatch);
            }
        }
        window.editorView.focus();
        updateHeadingLevel(); // ← ДОБАВИТЬ
    });
};
		// Undo / Redo (если кнопки существуют)
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');

if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        if (window.ProseMirrorBundle.undo) window.ProseMirrorBundle.undo(window.editorView.state, window.editorView.dispatch);
    });
}
if (redoBtn) {
    redoBtn.addEventListener('click', () => {
        if (window.ProseMirrorBundle.redo) window.ProseMirrorBundle.redo(window.editorView.state, window.editorView.dispatch);
    });
};
// Всплывающее меню для марок (bubble menu)
const bubbleMenu = document.getElementById('bubble-menu');

function showBubbleMenu(x, y) {
    bubbleMenu.style.display = 'flex';
    bubbleMenu.style.left = x + 'px';
    bubbleMenu.style.top = y + 'px';
}

function hideBubbleMenu() {
    bubbleMenu.style.display = 'none';
}

// Обработчик выделения текста
function onSelectionChange() {
    const selection = window.getSelection();
    if (selection.isCollapsed || selection.toString().trim() === '') {
        hideBubbleMenu();
        return;
    }
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    showBubbleMenu(rect.left + window.scrollX, rect.top + window.scrollY - 50);
}

// Подписка на события
document.addEventListener('selectionchange', onSelectionChange);

// Применение марок к выделенному тексту (по id кнопок)
const markButtons = {
    'bold': 'strong',
    'italic': 'em',
    'code-inline': 'code',
    'highlight': 'mark'
};

for (const [btnId, markName] of Object.entries(markButtons)) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.addEventListener('click', () => {
            const { state, dispatch } = window.editorView;
            const { from, to } = state.selection;
            const mark = state.schema.marks[markName];
            
            if (mark && from !== to) {
                const tr = state.tr.addMark(from, to, mark.create());
                dispatch(tr);
                window.editorView.focus();
                hideBubbleMenu();
            }
        });
    }
}

// Скрываем меню при прокрутке или клике вне редактора
window.addEventListener('scroll', hideBubbleMenu);
document.addEventListener('mousedown', (e) => {
    if (!bubbleMenu.contains(e.target)) hideBubbleMenu();
});
// Сохранение в файл .md
const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
        const markdown = await window.ProseMirrorBundle.proseMirrorToMarkdown(window.editorView.state.doc);
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'document.md';
        a.click();
        URL.revokeObjectURL(url);
    });
}

// Загрузка из файла .md
const loadBtn = document.getElementById('load-btn');
if (loadBtn) {
    loadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.txt';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            const { mySchema } = window.ProseMirrorBundle;
            
            // Парсим напрямую — теперь парсер работает с твоей схемой
            let doc = await window.ProseMirrorBundle.markdownToProseMirror(text);
            
            // Если документ всё же пустой (например, файл пуст) — вставляем заглушку
            if (!doc || doc.content.size === 0) {
                doc = mySchema.node('doc', null, [
                    mySchema.node('paragraph', null, mySchema.text('Файл пуст или не удалось разобрать Markdown'))
                ]);
            }
            
            const tr = window.editorView.state.tr.replaceWith(0, window.editorView.state.doc.content.size, doc);
            window.editorView.dispatch(tr);
        };
        input.click();
    });
};

//Кнопка ссылки
const linkBtn = document.getElementById('link');
if (linkBtn) {
    linkBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { from, to } = state.selection;
        
        // Если ничего не выделено — не делаем ничего (или можно вставить placeholder)
        if (from === to) {
            alert('Выделите текст, который нужно превратить в ссылку');
            return;
        }
        
        let url = prompt('Введите URL:', 'https://');
        if (!url) return;
        
        // Если не введён протокол, добавляем https://
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        // Создаём марку ссылки
        const mark = state.schema.marks.link.create({ href: url });
        
        // Применяем марку к выделенному тексту
        const tr = state.tr.addMark(from, to, mark);
        dispatch(tr);
        window.editorView.focus();
    });
};
//horisontal rule
const hrBtn = document.getElementById('hr');
if (hrBtn) {
    hrBtn.addEventListener('click', () => {
        const { state, dispatch } = window.editorView;
        const { schema } = state;
        const hrNode = schema.nodes.horizontal_rule.create();
        const tr = state.tr.replaceSelectionWith(hrNode);
        dispatch(tr);
        window.editorView.focus();
    });
};
// ---- ОТПРАВКА MARKDOWN В КАРТУ ПРИ ИЗМЕНЕНИЯХ ----
if (window.editorView) {
    const originalDispatch = window.editorView.dispatch;
    window.editorView.dispatch = async (tr) => {
        originalDispatch(tr);
        const markdown = await window.ProseMirrorBundle.proseMirrorToMarkdown(window.editorView.state.doc);
        const iframe = document.getElementById('mapFrame');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'updateMap', markdown }, '*');
        }
    };
}

// ---- ОТПРАВКА НАЧАЛЬНОГО MARKDOWN (ДЛЯ СТРАХОВКИ) ----
setTimeout(async () => {
    if (window.editorView) {
        const markdown = await window.ProseMirrorBundle.proseMirrorToMarkdown(window.editorView.state.doc);
        const iframe = document.getElementById('mapFrame');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'updateMap', markdown }, '*');
        }
    }
}, 500)
 
        ;  } })();
		
		//Подсветка кнопок
		function updateButtonState() {
    const { state } = window.editorView;
    const { from, to } = state.selection;
    
    // Марки (жирный, курсив, зачёркивание)
    const marks = ['strong', 'em', 'strike'];
    marks.forEach(markName => {
        const mark = state.schema.marks[markName];
        const isActive = mark && state.doc.rangeHasMark(from, to, mark);
        const btn = document.getElementById(markName);
        if (btn) btn.classList.toggle('active', isActive);
    });
    
    // Узлы (списки, цитаты)
    const { $from } = state.selection;
    const parent = $from.node($from.depth);
    
    const ulBtn = document.getElementById('ul');
    const olBtn = document.getElementById('ol');
    const quoteBtn = document.getElementById('quote');
    
    if (ulBtn) ulBtn.classList.toggle('active', parent.type.name === 'bullet_list');
    if (olBtn) olBtn.classList.toggle('active', parent.type.name === 'ordered_list');
    if (quoteBtn) quoteBtn.classList.toggle('active', parent.type.name === 'blockquote'); 
	updateHeadingLevel(); // ← ДОБАВИТЬ ЭТУ СТРОКУ
};

// Только изменение позиции курсора (не клики по кнопкам)
//window.editorView.dom.addEventListener('selectionchange', updateButtonState);
//window.editorView.dom.addEventListener('keyup', updateButtonState);
		
		
//		const savePngBtn = document.getElementById('save-png');
//if (savePngBtn) {
//    savePngBtn.addEventListener('click', () => {
 //       const iframe = document.getElementById('mapFrame');
 //       if (iframe && iframe.contentWindow && iframe.contentWindow.saveAsPNG) {
//            iframe.contentWindow.saveAsPNG();
//        }
//    });
//};
// Выпадающие меню по клику
(function() {
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('button');
        const content = dropdown.querySelector('.dropdown-content');
        if (!btn || !content) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdowns.forEach(d => {
                const c = d.querySelector('.dropdown-content');
                if (c && c !== content) c.classList.remove('show');
            });
            content.classList.toggle('show');
        });
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-content.show').forEach(c => c.classList.remove('show'));
  }  });
// Превращаем спан уровня карты в кнопку
const mapLevelSpan = document.getElementById('map-level');
if (mapLevelSpan) {
    // Делаем похожим на кнопку
    mapLevelSpan.style.cursor = 'pointer';
    mapLevelSpan.style.padding = '4px 8px';
    mapLevelSpan.style.borderRadius = '4px';
    mapLevelSpan.style.backgroundColor = '#f0f0f0';
    mapLevelSpan.style.border = '1px solid #ccc';
    
    mapLevelSpan.addEventListener('click', () => {
        const level = parseInt(mapLevelSpan.textContent, 10);
        if (isNaN(level)) return;
        
        const iframe = document.getElementById('mapFrame');
        if (iframe && iframe.contentWindow && iframe.contentWindow.collapseLevel) {
            iframe.contentWindow.collapseLevel(level);
        }
    });
}

// Слушаем изменения уровня из iframe
window.addEventListener('message', (e) => {
    if (e.data.type === 'levelChanged') {
        const mapLevelSpan = document.getElementById('map-level');
        if (mapLevelSpan) mapLevelSpan.textContent = e.data.level;
    }
});
  // ==== ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ WYSIWYG / MARKDOWN ====
const editorContainer = document.getElementById('editor');
const wysiwygRadio = document.querySelector('input[value="wysiwyg"]');
const markdownRadio = document.querySelector('input[value="markdown"]');
 

function switchToWysiwyg() {
    window.ProseMirrorBundle.switchToProseMirror();
}

function switchToMarkdown() {
    window.ProseMirrorBundle.switchToCodeMirror();
}

if (wysiwygRadio && markdownRadio) {
    wysiwygRadio.addEventListener('change', () => {
        if (wysiwygRadio.checked) switchToWysiwyg();
    });
    markdownRadio.addEventListener('change', () => {
        if (markdownRadio.checked) switchToMarkdown();
    });
}})();