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
		
		btn('export-btn', () => {
    const view = window.editorView;
    if (!view) return;

    const contentHtml = view.dom.innerHTML;

    const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Экспорт документа</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prosemirror-view@1.31.0/style/prosemirror.css">
    <style>
@media print, screen {
    /* 1. Жестко регистрируем установленный в системе шрифт под коротким именем */
    @font-face {
        font-family: 'MyLocalNunito';
        /* Перебираем все возможные варианты системных имен для экстра-жирного Нунито */
        src: local('Nunito ExtraBold'), 
             local('Nunito-ExtraBold'), 
             local('Nunito Black'), 
             local('Nunito-Black'), 
             local('Nunito');
        font-weight: normal; /* Обманываем браузер, чтобы он не утолщал его поверх */
        font-style: normal;
    }
	
	
@media print, screen {
  /* Настройка размеров страницы А4 и полей */
  @page {
    size: A4;
    margin: 10mm 10mm 10mm 15mm; /* Левое поле чуть больше под подшивку */
    margin: 10mm 10mm 10mm 15mm; /* Левое поле чуть больше под подшивку */
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
 
    line-height: 1.2;
    color: #1a1a1a;
    background: #fff;
    margin: 6pt;
    padding: 10pt;
  }

  /* Заголовки */
  h1, h2, h3, h4, h5, h6 {
    color: #111111;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 12pt;
    page-break-after: avoid; /* Запрещает разрыв страницы СРАЗУ ПОСЛЕ заголовка */
    break-after: avoid;
  }

  h1 { font-size: 42pt; font-family: 'Malgun Gothic',  sans-serif !important; border-bottom: 1px solid #eee; padding-bottom: 6pt; }
  h2 { 
    counter-increment: heading-counter;
    /* Возвращаем стандартное отображение, текст больше не сдвинется ни на миллиметр */
    display: block !important; 
font-size: 28pt;
    padding-right: 0;
    margin-top: 24pt; }
  h3 { font-size: 22pt; font-family: 'Courier New',  sans-serif !important; 
    margin-top: 24pt;
    text-align: center; }

  p {
    margin-top: 0; 
    margin-bottom: 0;
    padding-left: 10pt;
    padding-right: 50pt;
    text-align: justify; /* Выравнивание по ширине для книжного вида */
  }

  /* Списки */
  ul, ol {
    margin-top: 0; 
    margin-bottom: 0;
    padding-left: 25pt;
  }

  li {
    margin-bottom: 0;
	
    line-height: 1.3;
    padding-left: 0;
    padding-right: 0; 
  }
  
html body li p {
    font-size: 10pt !important;       /* Размер шрифта в списке */
	font-family: Georgia,  serif !important; 
    letter-spacing: 0.44em !important; 
    line-height: 1.2 !important;      /* Межстрочный интервал внутри пункта */
    margin-top: 0 !important;         /* Убираем лишние отступы */
    margin-bottom: 3pt !important;      /* Расстояние МЕЖДУ пунктами списка */
    padding-left: 0;
    padding-right: 0;
}
  
html body li em { 
	font-family: Georgia,  serif !important; 
    letter-spacing: -0.04em !important; 
    line-height: 1.2 !important;      /* Межстрочный интервал внутри пункта */
    margin-top: 0 !important;         /* Убираем лишние отступы */
    margin-bottom: 3pt !important;      /* Расстояние МЕЖДУ пунктами списка */
    padding-left: 0;
    padding-right: 0;
}

html body li strong {
    font-weight: bold !important; /* Гарантируем, что он останется жирным */
    
    font-family: 'MyLocalNunito', sans-serif !important; 
    letter-spacing: -0.07em !important; /* Чуть сближаем буквы для красоты */
    
    /* Пример кастомных стилей (измените под себя или удалите лишнее): */
    color: #000000 !important;    /* Цвет текста (можно сделать, например, темно-синим #003366) */
    background-color: transparent !important; /* Убираем фон, если он наследовался */
    
    /* Сюда можно добавить, например, курсив или подчеркивание, если нужно: */
    /* font-style: italic !important; */
}

  /* Цитаты */
  blockquote {
    margin: 0 0 12pt 0;
    padding-left: 12pt;
    border-left: 4px solid #ddd;
    color: #555;
    font-style: italic;
  }

  /* Код */
  pre, code {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; 
    background-color: #f6f8fa;
    border-radius: 3px;
  }

  code {
    padding: 2pt 4pt;
  }

  pre {
    padding: 12pt;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
    border: 1px solid #eaecef;
  }

  /* Таблицы */
  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 18pt;
    page-break-inside: avoid; /* Таблица по возможности не разрывается на куски */
    break-inside: avoid;
  }

  th, td {
    border: 1px solid #dfe2e5;
    padding: 6pt 10pt;
    text-align: left;
  }

  th {
    background-color: #f6f8fa;
    font-weight: bold;
  }

  /* Изображения */
  img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12pt auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Ссылки (скрываем синий цвет при печати) */
  a {
    color: #1a1a1a;
    text-decoration: underline;
  }

  /* Разрывы страниц для крупных блоков */
  .page-break {
    page-break-before: always;
    break-before: always;
  }
}
/* 1. Инициализируем счетчик для всего тела документа */
body {
    counter-reset: heading-counter; 
}

/* 2. Каждый раз, когда встречается H2, увеличиваем счетчик на 1 */
h2 {
    counter-increment: heading-counter;
}

/* 3. Автоматически подставляем цифру ПЕРЕД текстом заголовка */
h2::before { 
    display: inline-block !important;
    z-index: -1;
    /* Хак: делаем цифру независимой, чтобы её движение не пинало соседние буквы */
    position: relative !important; 
    
    /* Регулируйте эту цифру в пикселях (px), чтобы опустить номер еще ниже */
    top: 80px !important; 
    
    margin-right: -20px !important;
    content: counter(heading-counter) " "; /* Будет выводить: "1 ", "2. " */
    color: #cccccc; /* Можно сделать цифры блеклыми, чтобы не мешали */
    font-weight: bold;
    font-size: 100pt;
}
html body a, 
html body a *,
a {
    text-decoration: none !important; /* Полностью убирает подчеркивание */
    
    /* Дополнительно: если нужно, чтобы ссылки при печати не выделялись синим цветом */
    color: inherit !important;       /* Ссылка примет цвет родительского текста (черный) */
}
@media print {
    /* Создаем класс, который принудительно разрывает страницу */
    .page-break {
        display: block !important;
        page-break-before: always !important; /* Для старых браузеров */
        break-before: page !important;        /* Современный стандарт */
        height: 0 !important;                  /* Элемент не занимает места на экране */
        margin: 0 !important;
        padding: 0 !important;
    }
}

</style>
</head>
<body>
<div class="ProseMirror">
${contentHtml}
</div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
        href: url,
        download: 'document.html'
    }).click();
    URL.revokeObjectURL(url);
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
