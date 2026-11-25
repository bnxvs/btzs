# program-options Specification

## Purpose
Окно опций программы: значения по умолчанию для анализа, отображения, широты линий, печати и Matcher, восстановление значений по умолчанию и область действия настроек.

## Requirements

### Requirement: Options dialog content

Меню View SHALL предоставлять диалог «Options», содержащий настройки анализа, отображения, печати и Matcher, а также кнопку «Restore Defaults».

#### Scenario: Группа «Analysis defaults»
- **WHEN** открыт диалог Options
- **THEN** доступны Paper ES (по умолчанию 1.0), Flare Density (по умолчанию 0), Zone Spread (по умолчанию 4), выбор метода анализа (Approximate CI по умолчанию либо «0.1 over FB+F») и значение Personal Speed Point (по умолчанию 2.4)

#### Scenario: Группа «Display defaults»
- **WHEN** открыт диалог Options
- **THEN** доступны переключатели «Display Information» (включён), «Smooth Curves» (выключен), «Color Curves» (включён) и «Display Grid on family graph» (включён)

#### Scenario: Группа «Display and printing options»
- **WHEN** открыт диалог Options
- **THEN** доступны «Display Grid Line Width», «Print Grid Line Width» и переключатель «Print all charts on the same page» (включён)

#### Scenario: Группа «Matcher defaults»
- **WHEN** открыт диалог Options
- **THEN** доступен выбор эталонной кривой по умолчанию

### Requirement: Restore defaults

Кнопка «Restore Defaults» SHALL восстанавливать все параметры программы к значениям по умолчанию.

#### Scenario: Восстановление значений
- **WHEN** пользователь нажимает «Restore Defaults»
- **THEN** все опции анализа, отображения, печати и Matcher возвращаются к значениям по умолчанию

### Requirement: Options persistence and scope

Изменения в окне Options SHALL сохраняться как персональные значения по умолчанию и действовать до следующего изменения, тогда как локальные изменения в окнах документа действуют только на текущий документ.

#### Scenario: Сохранение персональных значений по умолчанию
- **WHEN** пользователь изменяет значения в окне Options
- **THEN** изменённые значения сохраняются как персональные значения по умолчанию и используются при создании новых документов

#### Scenario: Область действия локальных изменений
- **WHEN** пользователь изменяет параметр (например, ES) внутри окна документа
- **THEN** это изменение применяется только к текущему документу и не изменяет значения по умолчанию для новых файлов
