/**
 * Русский каталог переводов — основной источник ключей локализации
 * (`MessageKey` выводится из него). Требования — `localization/spec.md`.
 *
 * Глоссарий предметных терминов (используются одинаково во всех окнах):
 *  - кривая (curve), семейство кривых (family of curves);
 *  - ступенчатый клин (step tablet), ступень (step);
 *  - плотность (density), экспозиция (exposure), логарифм экспозиции (logE);
 *  - проявитель (developer), разведение (dilution), агитация (agitation);
 *  - носок кривой (toe), вуаль (flare), зона (zone);
 *  - точка скорости (speed point), эффективная светочувствительность (EFS).
 */
export const ru = {
  // Общие команды.
  'common.ok': 'ОК',
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',
  'common.save': 'Сохранить',
  'common.open': 'Открыть',
  'common.delete': 'Удалить',
  'common.apply': 'Применить',
  'common.yes': 'Да',
  'common.no': 'Нет',
  'common.import': 'Импорт',
  'common.edit': 'Изменить',
  'common.add': 'Добавить',
  'common.moveUp': 'Вверх',
  'common.moveDown': 'Вниз',
  'common.reset': 'Сбросить',
  'common.error': 'Ошибка',
  'common.warning': 'Предупреждение',
  'common.confirm': 'Подтверждение',

  // Вкладки документа.
  'tab.family': 'Семейство',
  'tab.data': 'Данные',
  'tab.analyze': 'Анализ',
  'tab.charts': 'Графики',
  'tab.info': 'Информация',
  'tab.film': 'Плёнка',
  'tab.paper': 'Бумага',
  'tab.compare': 'Сравнение',

  // Вкладка данных.
  'data.step': 'Ступень',
  'data.tablet': 'Клин',
  'data.addCurve': 'Новая кривая…',
  'data.curve': 'Кривая',
  'data.autofillTopHint':
    'Старшие ступени заполняются первым введённым значением автоматически.',
  'data.autofillDownHint': 'F2, затем Ctrl+Enter — заполнить столбец вниз',
  'data.selectCurve': 'Выберите кривую',

  // Диалог Curve Details.
  'curveDetails.title': 'Свойства кривой',
  'curveDetails.devTime': 'Время проявления',
  'curveDetails.devTimeHint': 'Формат «минуты:секунды» (5:30) или десятичный (5.5)',
  'curveDetails.devTimeInvalid': 'Некорректный формат времени проявления',
  'curveDetails.curveInvalid': 'Кривая помечена как некорректная и не отображается на графиках «Dev»',
  'curveDetails.note': 'Примечание',
  'curveDetails.dontConnect': 'Не соединять на графике',
  'curveDetails.idOrName': 'ID или имя',

  // Семейство плёнки.
  'family.title': 'Семейство кривых',
  'family.date': 'Дата',
  'family.name': 'Название',
  'family.filmIso': 'ISO плёнки',
  'family.developer': 'Проявитель',
  'family.dilution': 'Разведение',
  'family.temperature': 'Температура',
  'family.volume': 'Рабочий объём',
  'family.agitation': 'Агитация',
  'family.notes': 'Примечания',
  'family.edit': 'Изменить параметры семейства…',

  // Семейство бумаги.
  'familyPaper.printMethod': 'Способ печати',
  'familyPaper.contact': 'Контактная',
  'familyPaper.projection': 'Проекционная',
  'familyPaper.developingTime': 'Время проявления',
  'familyPaper.toner': 'Тонер',
  'familyPaper.drying': 'Сушка',

  // Управление кривыми.
  'curves.arrange': 'Упорядочить кривые…',
  'curves.arrangeTitle': 'Упорядочивание кривых',
  'curves.deleteTitle': 'Удаление кривой',
  'curves.deleteConfirm': 'Удалить кривую «%s»?',
  'curves.importTitle': 'Импорт кривых',
  'curves.importWrongKind': 'Импорт кривой бумаги в семейство плёнки невозможен',
  'curves.importWrongKindFilm': 'Импорт кривой плёнки в семейство бумаги невозможен',
  'curves.imported': 'Импортировано кривых: %s',
  'curves.importFailed': 'Не удалось импортировать кривые: %s',
  'curves.noCurves': 'В документе нет кривых',

  // График семейства кривых.
  'familyChart.title': 'Семейство характеристических кривых',
  'familyChart.empty': 'Нет кривых для отображения',
  'familyChart.axis.logE': 'Относительный logE',
  'familyChart.axis.lux': 'Экспозиция, Lux/с',
  'familyChart.axis.density': 'Плотность',
  'familyChart.scale.label': 'Шкала оси X',
  'familyChart.scale.logE': 'logE',
  'familyChart.scale.lux': 'Lux/с',
  'familyChart.speedPoint': 'Точка скорости',
  'familyChart.speedLine': 'Плотность 0,6',

  // Вкладка графиков.
  'charts.list': 'Список графиков',
  'charts.devTimeSbr': 'Dev. Time/SBR',
  'charts.devTimeG': 'Dev. Time/G',
  'charts.devTimeN': 'Dev. Time/N',
  'charts.efsSbr': 'EFS/SBR',
  'charts.efsG': 'EFS/G',
  'charts.efsN': 'EFS/N',
  'charts.isoRange': 'ISO Range Chart',
  'charts.paperGrade': 'Paper Grade Chart',
  'charts.parameters': 'Параметры',
  'charts.paperEs': 'ES бумаги',
  'charts.flareDensity': 'Плотность вуали',
  'charts.expAdj': 'Корр. экспозиции',
  'charts.zoneSpread': 'Разброс зон',
  'charts.track': 'Трассировка',
  'charts.trackHint': 'Переместите курсор по кривой, чтобы увидеть время проявления.',
  'charts.status': 'Время проявления: %s мин',
  'charts.empty': 'Нет данных для отображения',
  'charts.axis.devTime': 'Время проявления, мин',
  'charts.axis.efs': 'EFS',
  'charts.axis.sbr': 'SBR, стопы',
  'charts.axis.g': 'G-bar',
  'charts.axis.n': 'N',
  'charts.axis.curve': 'Кривая',
  'charts.axis.grade': 'Класс',
  'charts.axis.es': 'ES',
  'charts.axis.isoRange': 'ISO Range',

  // Параметры анализа.
  'analysis.idminPercent': 'IDmax %',
  'analysis.es': 'ES',
  'analysis.method': 'Метод анализа',
  'analysis.approximateCi': 'Приблизительная CI',
  'analysis.overFbF': '0.1 над FB+F',

  // Вкладка Analyze.
  'analyze.displayInformation': 'Показывать сведения',
  'analyze.method': 'Метод точки скорости',
  'analyze.speedPoint': 'Точка скорости',
  'analyze.personalSpeedPoint': 'Персональная точка скорости',
  'analyze.efs': 'EFS',
  'analyze.gBar': 'G-bar',
  'analyze.sbr': 'SBR',
  'analyze.idMin': 'IDmin',
  'analyze.idMax': 'IDmax',
  'analyze.dr': 'DR',
  'analyze.isoRange': 'ISO-диапазон',
  'analyze.grade': 'Класс',
  'analyze.relativeSpeed': 'Светочувствительность',
  'analyze.noCurves': 'Нет кривых для анализа',
  'analyze.selectedCurve': 'Выбранная кривая',
  'analyze.lowGradient': 'Низкий градиент — кривая продлена пунктиром',
  'analyze.zoneHoverHint': 'Наведите курсор на столбец зон печати, чтобы увидеть границы и медиану',
  'analyze.nonStandard': 'Результаты более не соответствуют стандарту ANSI/ISO 6846:1992',

  // Легенда сокращений на вкладке Analyze.
  'analyze.legend.efs':
    'эффективная светочувствительность: какой экспозиции требует эта плёнка (ISO с поправкой на условия)',
  'analyze.legend.gBar':
    'средняя градиентность — контраст: насколько круто растёт плотность негатива',
  'analyze.legend.sbr':
    'диапазон яркостей сюжета (Subject Brightness Range): сколько ступеней яркости укладывается в контраст',
  'analyze.legend.es':
    'экспозиционная шкала (Exposure Scale): принятый для расчёта диапазон яркостей сюжета',
  'analyze.legend.dr':
    'диапазон плотности (Density Range): разница между минимальной и максимальной полезной плотностью',
  'analyze.legend.speedPoint':
    'экспозиция, принятая за начало отсчёта светочувствительности',
  'analyze.legend.expAdj':
    'коррекция экспозиции в стопах: положительная — переэкспонирование, отрицательная — недоэкспонирование (сдвигает кривую и меняет EFS)',
  'analyze.legend.flareDensity':
    'плотность смоделированной вуали (обычно 0.001…0.1): приподнимает тени кривой',
  'analyze.legend.idMin': 'минимальная полезная плотность отпечатка',
  'analyze.legend.idMax':
    'максимальная полезная плотность отпечатка (заданный процент от максимальной плотности)',
  'analyze.legend.isoRange':
    'номер ISO-диапазона: экспозиционная шкала, округлённая до десятых и умноженная на 100',
  'analyze.legend.grade': 'класс бумаги: условный номер контраста отпечатка',
  'analyze.legend.relativeSpeed':
    'измеряется по плотности 0.6 (ISO paper speed, например ISO P100)',

  // Ступенчатый клин.
  'stepTablet.title': 'Ступенчатый клин',
  'stepTablet.import': 'Импортировать клин из файла в текущий документ',
  'stepTablet.importPlotter': 'Импортировать клин из файла Plotter (.pfc/.ppc)',
  'stepTablet.useSaved': 'Использовать сохранённый клин #%s',
  'stepTablet.view': 'Просмотр клина %s',
  'stepTablet.saveAs': 'Сохранить текущий клин как клин #%s',
  'stepTablet.imported': 'Клин успешно импортирован',
  'stepTablet.importFailed': 'Не удалось импортировать клин: %s',
  'stepTablet.noTablet': 'Выбранный файл не содержит ступенчатого клина',
  'stepTablet.matcherHasNoTablet': 'Документ Matcher не содержит ступенчатого клина',
  'stepTablet.overwriteTitle': 'Перезапись клина',
  'stepTablet.overwriteConfirm': 'Перезаписать сохранённый клин #%s текущим клином?',
  'stepTablet.saved': 'Текущий клин сохранён как клин #%s',
  'stepTablet.legend.step': 'Ступень',
  'stepTablet.legend.density': 'Плотность',
  'stepTablet.importPrompt': 'Импортировать ступенчатый клин для использования с этим файлом?',

  // Документ Matcher.
  'matcher.title': 'Сопоставление',
  'matcher.selectFilm': 'Выберите файл плёнки Plotter…',
  'matcher.selectPaper': 'Выберите файл бумаги Plotter…',
  'matcher.createCancelled': 'Создание документа Matcher отменено',
  'matcher.wrongKindFilm': 'Выбранный файл не является документом плёнки',
  'matcher.wrongKindPaper': 'Выбранный файл не является документом бумаги',
  'matcher.missingFilm': 'Не удалось загрузить исходный файл плёнки: %s',
  'matcher.missingPaper': 'Не удалось загрузить исходный файл бумаги: %s',
  'matcher.updatedFilm': 'Исходный файл плёнки «%s» новее, чем при создании документа. Перезагрузить параметры анализа?',
  'matcher.updatedPaper': 'Исходный файл бумаги «%s» новее, чем при создании документа. Перезагрузить параметры анализа?',
  'matcher.searchFile': 'Найти…',

  // Вкладка Info.
  'matcher.info.filmFamily': 'Семейство плёнки',
  'matcher.info.paperFamily': 'Семейство бумаги',
  'matcher.info.overridden': 'Параметры анализа переопределены',
  'matcher.info.selectReference': 'Эталонная кривая',

  // Вкладки Film/Paper.
  'matcher.curves': 'Кривые',
  'matcher.film.chart': 'График семейства кривых плёнки',
  'matcher.paper.chart': 'График семейства кривых бумаги',
  'matcher.selectedFilm': 'Выбранная кривая плёнки',
  'matcher.selectedPaper': 'Выбранная кривая бумаги',
  'matcher.noCurves': 'Кривых нет',
  'matcher.parameters': 'Параметры анализа',
  'matcher.restoreDefaults': 'Восстановить значения файлов',
  'matcher.overrideHint': 'Изменение параметров переопределяет значения исходных файлов.',
  'matcher.lockDrToEs': 'Привязать DR плёнки к ES',
  'matcher.lockDrToEsHint':
    'Значение DR плёнки приравнивается ES выбранной кривой бумаги.',
  'matcher.zones.film': 'Зоны сюжета и плотности негатива',
  'matcher.zones.negative': 'Зоны плотности негатива',
  'matcher.zones.print': 'Зоны печати',
  'matcher.zones.reference': 'Зоны эталонной кривой',
  'matcher.zones.zone': 'Зона',
  'matcher.zones.density': 'Плотность',
  'matcher.zones.exposure': 'Экспозиция, logE',
  'matcher.zones.low': 'Нижняя',
  'matcher.zones.high': 'Верхняя',
  'matcher.zones.median': 'Медиана',

  // Приближённые кривые.
  'matcher.approx.manage': 'Приближённые кривые…',
  'matcher.approx.title': 'Управление приближёнными кривыми',
  'matcher.approx.by': 'Способ',
  'matcher.approx.bySbr': 'По SBR',
  'matcher.approx.byG': 'По средней G',
  'matcher.approx.value': 'Значение',
  'matcher.approx.add': 'Добавить кривую',
  'matcher.approx.remove': 'Удалить',
  'matcher.approx.list': 'Приближённые кривые',
  'matcher.approx.outOfRange': '(приближение вне диапазона)',
  'matcher.approx.notInRange': 'Значение вне диапазона семейства',
  'matcher.approx.needCurves': 'Для приближения нужно не менее двух кривых семейства',

  // Эталонные кривые.
  'matcher.reference.title': 'Эталонная кривая',
  'matcher.reference.default': 'Стандартная эталонная кривая',
  'matcher.reference.flared': 'Стандартная эталонная кривая (с вуалью)',
  'matcher.reference.loaded': 'Загруженная эталонная кривая',
  'matcher.reference.load': 'Загрузить эталонную кривую…',
  'matcher.reference.useLoaded': 'Использовать загруженную кривую',
  'matcher.reference.noMatch': 'Выбранный документ Matcher не содержит эталонной кривой',
  'matcher.reference.updated': 'Устаревшая эталонная кривая с вуалью заменена стандартной',

  // Сравнение сопоставлений.
  'matcher.compare.save': 'Сохранить текущее сопоставление для сравнения',
  'matcher.compare.load': 'Загрузить сопоставление для сравнения…',
  'matcher.compare.remove': 'Удалить',
  'matcher.compare.show': 'Показывать',
  'matcher.compare.empty': 'Нет сохранённых сопоставлений',
  'matcher.compare.limit': 'Достигнут предел в 15 сравнений',
  'matcher.compare.clipped': 'обрезан',
  'matcher.compare.chart': 'График сравнения сопоставлений',
  'matcher.compare.axis.zone': 'Зона',
  'matcher.compare.name': 'Сопоставление',
  'matcher.compare.film': 'Плёнка',
  'matcher.compare.paper': 'Бумага',
  'matcher.compare.noMatch': 'В документе нет кривой для сохранения сопоставления',
  'matcher.compare.loaded': 'Загруженное сопоставление добавлено для сравнения',

  // Печать.
  'print.title': 'Печать кривых',
  'print.scope': 'Область печати',
  'print.entireDocument': 'Весь документ',
  'print.currentPageOnly': 'Только текущая страница',
  'print.graphingOptions': 'Параметры графиков',
  'print.smoothCurves': 'Сглаживать кривые',
  'print.colorCurves': 'Цветные кривые',
  'print.displayInformation': 'Показывать сведения',
  'print.preview': 'Предпросмотр',
  'print.previewTitle': 'Предпросмотр печати',
  'print.page': 'Страница %s',
  'print.pageOf': 'Страница %s из %s',
  'print.zoomIn': 'Увеличить',
  'print.zoomOut': 'Уменьшить',
  'print.print': 'Печать',
  'print.setup': 'Настройка принтера',
  'print.allChartsSamePage': 'Все графики на одной странице',
  'print.gridLineWidth': 'Толщина линий сетки',
  'print.printGridLineWidth': 'Толщина линий сетки при печати',
  'print.failed': 'Не удалось напечатать: %s',

  // Окно опций.
  'options.title': 'Опции',
  'options.analysis': 'Значения анализа по умолчанию',
  'options.display': 'Значения отображения по умолчанию',
  'options.displayPrinting': 'Отображение и параметры печати',
  'options.matcher': 'Значения Matcher по умолчанию',
  'options.restoreDefaults': 'Восстановить умолчания',
  'options.displayGrid': 'Показывать сетку на графике семейства',

  // Единицы температуры.
  'unit.fahrenheit': 'Фаренгейт',
  'unit.celsius': 'Цельсий',

  // Оболочка: меню.
  'menu.file': 'Файл',
  'menu.edit': 'Правка',
  'menu.view': 'Вид',
  'menu.match': 'Сопоставление',
  'menu.help': 'Справка',
  'menu.newFilm': 'Новая плёнка',
  'menu.newPaper': 'Новая бумага',
  'menu.newMatcher': 'Новое сопоставление',
  'menu.new': 'Создать',
  'menu.open': 'Открыть…',
  'menu.close': 'Закрыть',
  'menu.save': 'Сохранить',
  'menu.saveAs': 'Сохранить как…',
  'menu.stepTablet': 'Ступенчатый клин…',
  'menu.print': 'Печать…',
  'menu.printPreview': 'Предпросмотр печати',
  'menu.printSetup': 'Настройка печати…',
  'menu.exit': 'Выход',
  'menu.recentFiles': 'Последние файлы',
  'menu.clearRecent': 'Очистить список',
  'menu.noRecent': 'Список пуст',
  'menu.smoothCurves': 'Сглаживать кривые',
  'menu.colorCurves': 'Цветные кривые',
  'menu.displayGrid': 'Показывать сетку',
  'menu.options': 'Опции…',
  'menu.helpTopics': 'Темы справки',
  'menu.btzsWebsite': 'Перейти на www.BTZS.org…',
  'menu.about': 'О программе «Plotter for Windows»…',
  'menu.restoreFileDefaults': 'Восстановить значения файлов',
  'menu.loadNewFilm': 'Загрузить новую плёнку…',
  'menu.loadNewPaper': 'Загрузить новую бумагу…',
  'menu.approximateCurves': 'Приблизить кривые…',
  'menu.saveMatchForComparison': 'Сохранить текущее сопоставление для сравнения',
  'menu.loadMatchForComparison': 'Загрузить сопоставление для сравнения…',
  'menu.loadReferenceCurve': 'Загрузить эталонную кривую…',
  'menu.useDefaultReferenceCurve': 'Стандартная эталонная кривая',
  'menu.useLoadedCurve': 'Использовать загруженную кривую',

  // Оболочка: панель команд, вкладки, строка состояния.
  'shell.untitled': 'Без имени',
  'file.choose': 'Выбрать файл…',
  'file.pickHint':
    'Браузер запросил подтверждение выбора файла: нажмите «Выбрать файл», чтобы открыть диалог.',
  'shell.commandBar': 'Панель команд',
  'shell.documentTabs': 'Открытые документы',
  'shell.dirty': 'Есть несохранённые изменения',
  'shell.closeTab': 'Закрыть документ',
  'shell.noDocuments':
    'Нет открытых документов. Создайте документ (Ctrl+F, Ctrl+N, Ctrl+M) или откройте файл (Ctrl+O).',
  'shell.closePrompt': 'Сохранить изменения в «%s»?',
  'shell.closeSaveFailed': 'Не удалось сохранить документ: %s',
  'shell.openFailed': 'Не удалось открыть документ: %s',
  'shell.commandFailed': 'Не удалось выполнить команду: %s',
  'shell.helpFailed': 'Не удалось запустить справку',
  'shell.document': 'Документ',
  'shell.noDocumentTitle': 'Plotter',
  'shell.copyChart': 'Копировать график',
  'shell.copied': 'График скопирован в буфер обмена',
  'shell.copyFailed': 'Не удалось скопировать график: %s',

  // Строка состояния: названия команд (подсказки).
  'status.newFilm': 'Создать новый документ плёнки',
  'status.newPaper': 'Создать новый документ бумаги',
  'status.newMatcher': 'Создать новый документ сопоставления',
  'status.open': 'Открыть документ',
  'status.close': 'Закрыть активный документ',
  'status.save': 'Сохранить активный документ',
  'status.saveAs': 'Сохранить активный документ под новым именем',
  'status.print': 'Печатать активный документ',
  'status.printPreview': 'Показать страницы целиком',
  'status.printSetup': 'Настроить принтер и параметры печати',
  'status.options': 'Изменить параметры программы',
  'status.smoothCurves': 'Режим сглаживания кривых',
  'status.colorCurves': 'Режим цветных кривых',
  'status.displayGrid': 'Показывать сетку на графике семейства',
  'status.stepTablet': 'Импорт, выбор или сохранение ступенчатого клина',
  'status.about': 'Сведения о программе',
  'status.help': 'Открыть справку',

  // Окно «О программе».
  'about.title': 'О программе',
  'about.productLine': 'Plotter for Windows',
  'about.versionLine': 'Версия %s',
  'about.copyright': 'Copyright (C) 1999-2003 Phil Davis',
  'about.company': 'The View Camera Store',
  'about.btzs': 'BTZS Software',
  'about.website': 'www.BTZS.org',
  'about.close': 'ОК',

  // Встроенная справка.
  'help.title': 'Справка Plotter',
  'help.overview': 'Обзор',
  'help.overviewBody':
    'Plotter for Windows — программа построения графиков и анализа для фотографов, работающих с зонной системой BTZS: семейства характеристических кривых, EFS, G-bar, SBR, эквивалентная светочувствительность и класс контраста бумаги.',
  'help.files': 'Файлы',
  'help.filesBody':
    'Документы сохраняются в форматах .pfc (плёнка), .ppc (бумага) и .pmf (сопоставление). Файлы полностью совместимы с Windows-версией: чтение и запись не теряют данные.',
  'help.tabs': 'Вкладки документа',
  'help.tabsBody':
    'Документ плёнки и бумаги содержит вкладки Семейство, Данные, Анализ и Графики. Данные вводятся по ступеням клина; анализ показывает светочувствительность и контраст.',
  'help.matcher': 'Сопоставление',
  'help.matcherBody':
    'Документ сопоставления объединяет кривую плёнки с кривой бумаги: вкладки Информация, Плёнка, Бумага и Сравнение, приближённые кривые и эталонные кривые.',
  'help.charts': 'Графики',
  'help.chartsBody':
    'Шесть графиков плёнки (Dev. Time и EFS по SBR, G и N) и два графика бумаги (ISO Range Chart и Paper Grade Chart). Инструмент «Трассировка» показывает время проявления по кривой.',
  'help.printing': 'Печать',
  'help.printingBody':
    'Диалог Print Curves настраивает область печати и вид графиков, предпросмотр позволяет листать страницы и менять масштаб.',
  'help.footer': 'Для справки нажмите F1',
} as const;

/** Ключи сообщений приложения. */
export type MessageKey = keyof typeof ru;
