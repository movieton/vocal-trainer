---
name: fasol.app
description: Тренажёр голоса для одного певца — программа дня, нотная доска, микрофон и честная обратная связь по высоте.
colors:
  cobalt: "#3454F4"
  butter: "#F6E69C"
  chalk: "#F7F8FC"
  midnight: "#182044"
  surface: "#FFFFFF"
  line: "#E2E6F3"
  muted: "#5B6488"
  accent-soft: "#E8ECFE"
  good: "#1F9D57"
  near: "#C98A00"
  bad: "#D93F3F"
  roll-black: "#F3F5FB"
  roll-line: "#ECEFF7"
  roll-cline: "#C9D0E8"
  roll-listen: "#A9B3D9"
  roll-voice: "#8A93B8"
  dark-bg: "#0E1330"
  dark-surface: "#182044"
  dark-line: "#2A3466"
  dark-muted: "#A3ABCF"
  dark-accent: "#6F87FF"
  dark-accent-soft: "#23306A"
  dark-good: "#45C47D"
  dark-near: "#E8B53A"
  dark-bad: "#F06B6B"
  dark-roll-bg: "#121836"
  dark-roll-target: "#8EA0FF"
  dark-key-black: "#0A0E24"
typography:
  display:
    fontFamily: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "40px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 500
rounded:
  chip: "8px"
  small: "10px"
  control: "20px"
  card: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  page-mobile: "20px"
  xl: "24px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.midnight}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "48px"
  button-disabled:
    backgroundColor: "{colors.line}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
  hero-card:
    backgroundColor: "{colors.butter}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.card}"
    padding: "28px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.card}"
    padding: "24px"
  tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "16px"
  seg:
    backgroundColor: "{colors.accent-soft}"
    rounded: "{rounded.pill}"
    padding: "4px"
  seg-active:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  seg-modes:
    backgroundColor: "{colors.accent-soft}"
    rounded: "{rounded.control}"
    padding: "4px"
  nav-item-active:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
  answer:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.midnight}"
    rounded: "{rounded.control}"
    height: "52px"
  piano-key-white:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight}"
    height: "150px"
  piano-key-black:
    backgroundColor: "{colors.midnight}"
    width: "28px"
    height: "92px"
---

# Design System: fasol.app

## Overview

**Creative North Star: «Ритм фасолин»**

Айдентика fasol.app v1.0 (брендбук `fasol-brand-kit`): светлый chalk-фон, крупные кобальтовые заголовки, одна жёлтая карточка текущего дела, кнопки с полным скруглением и фасолина как главный графический элемент. Экран остаётся инструментом для одного человека с микрофоном: всё громкое — либо действие (кобальт), либо «сейчас» (butter), либо оценка голоса (светофор).

Светлая тема основная. Тёмная следует системе (`prefers-color-scheme`) и строится на midnight: фон #0E1330, карточки цвета midnight, акцент осветлён до #6F87FF. Все цвета — CSS-переменные в `src/index.css`; канва нотной доски читает те же переменные и шрифт Manrope.

**Key Characteristics:**
- Четыре брендовых цвета: cobalt, butter, chalk, midnight; плюс светофор точности.
- Плоско: тон поверхности и линия 1px, без теней на карточках.
- Крупные радиусы (24px карточки, 20px контролы), пилюли у кнопок и навигации.
- Фасолина — знак, «дыхательный шар» и звуковая волна; пропорции не меняются.
- Цифры табличные (`tabular-nums`), ощущение приложения: без выделения текста на кнопках и «резинки» скролла.

## Colors

Холодная светлая гамма бренда: один синий голос, один жёлтый акцент, тёмно-синий текст и тройка сигнальных цветов точности.

### Primary
- **Cobalt** (cobalt): главная кнопка, активный пункт навигации, выбранный сегмент, h1, серия дней, минуты в плане, цели «пой» на доске, фасолины волны, зажатая клавиша. Белый текст на кобальте (на тёмной теме — текст #0E1330 на #6F87FF).
- **Мягкий кобальт** (accent-soft): подложка сегментов, неактивный «шар» дыхания.

### Secondary
- **Butter** (butter): только «сейчас» — карточка текущего упражнения на главной и фаза «задержка» дыхания. Текст на нём — midnight. Жёлтым не пишут текст на белом.

### Tertiary — светофор точности
- **Попал** (good), **Рядом** (near), **Мимо** (bad): линия и точка голоса, оценка спетой цели, точки тапа в ритме, ответы викторины и клавиши-ответы, «завышаешь/занижаешь». Тёмная тема — свои осветлённые пары.

### Neutral
- **Chalk** (chalk) — фон страницы; **Surface** (#fff) — карточки, сайдбар, белые клавиши; **Line** — все рамки и разделители; **Midnight** — текст и чёрные клавиши; **Muted** — подписи, неактивные табы.
- **Палитра доски** (roll-*): полосы «чёрных» рядов, линии полутонов, линия «до» и курсор, контур «слушай», нейтральная линия голоса.

### Named Rules
**The One Blue Rule.** Кобальт означает «действуй», «выбрано» или «пой». Он не обозначает оценку.

**The Butter Is Now Rule.** Жёлтый — одна карточка или фаза «сейчас» на экране, не фон секций и не декор.

**The Traffic Light Is For Pitch Rule.** Зелёный, жёлтый и красный — только точность голоса и правильность ответа (исключение владельца, сохраняется в новой айдентике). Не для категорий, фаз или предупреждений; предупреждающая плашка `note-box` — единственное слабое (10%) использование near.

**The Foreign Note Rule.** В «Сочинении» нота вне лада красная — на клавишах, в клетках редактора (bad 10%) и на линии; звук аккорда — зелёный тон (попадание в гармонию); нота лада — базовый цвет клавиши. Жёлтый для ролей не используется. Решение владельца: «чужая» должна быть видна сразу.

**The Monochrome Evidence Rule.** Бейджи доказательности — одна монохромная шкала: залитый текстом → контур текстом → контур линией → пунктир. Без цвета.

## Typography

**Display / Body Font:** Manrope Variable 200–800 (локально `/brand/Manrope-Variable.woff2`), с system-ui.

**Character:** округлый геометрический гротеск бренда; иерархия — весом 800 против 500 и размером.

### Hierarchy
- **Display** (800, 56px / 1.05, −0.02em; 38px на телефоне, ширина ≤ 12ch): заголовок главной «Пой в своём ритме». Живая нота тюнера — 56px (44px на телефоне), таймеры дыхания 40–48px.
- **Headline** (800, 40px / 1.1, −0.02em, кобальт; 32px на телефоне; 20px в режиме фокуса): h1 страницы.
- **Title** (800, 20px, −0.01em): h2 карточек; название шага в hero-карточке — 22px.
- **Body** (500, 16px / 1.5): основной текст ≤ 70ch; статьи 68ch / 1.65, лид 18px.
- **Label** (500–600, 13px; 11–12px в легендах и бейджах): подписи, статистика, чипы. Без капса и разрядки.
- **Кнопки** — 800, 16px (hero — 18px).

### Named Rules
**The Steady Digits Rule.** Любое меняющееся число — ноты, центы, проценты, таймеры — `tabular-nums` и `min-width` в ch.

**The 800 Ceiling Rule.** Вес не выше 800 и без браузерного faux-bold (брендбук).

## Layout

- **Десктоп (> 760px):** сайдбар 220px (surface, правая линия, логотип 164px) + контент `max-width: 1120px`, поля 32px, низ 64px.
- **Телефон (≤ 760px):** сверху логотип 160px, снизу таб-бар из 5 пунктов (Сегодня, Распевки, Тюнер, Слух, Ещё) — surface 92% с blur 12px, учитывает safe-area. Поля страницы 20px, низ 88px + safe-area.
- **Режим фокуса:** во время пения `data-focus` на `<html>` прячет таб-бар, шапку, крошки, настройки, «Как делать» и режимы; доска растягивается до `100dvh − 210px`.
- **Ритм:** сетка 4px — 4 / 8 / 12 / 16 / 24 / 32; карточки разделяются 16px. Многоколоночные блоки на телефоне схлопываются; ряды сегментов и уровней прокручиваются без полосы.
- **Доска:** `clamp(260px, 42vh, 460px)`, высокая — `clamp(320px, 58vh, 640px)`, на телефоне `min(56vh, 460px)`.

### Named Rules
**The Home Is Today Rule.** Главная = программа дня: заголовок + серия, жёлтая hero-карточка со следующим шагом, список «Программа на 15 минут», чипы статистики. Сегментов «Распевки/Дыхание» из концепта на главной нет — осознанное решение; разделы живут в навигации.

## Elevation & Depth

Плоско: ступени тона chalk → surface → chalk для вложенных элементов (ответы, чипы, бары) плюс линия 1px `line`. Тень есть только у плавающих панелей поверх контента — баннер обновления и липкая панель «Сочинения» на телефоне (`0 8px 24px rgba(0,0,0,.35)`).

**The Line Not Shadow Rule.** Новая поверхность отделяется рамкой и тоном, не тенью.

## Shapes

Крупные мягкие формы бренда: карточки и hero 24px, контролы (плитки, ответы, доска, стат-плашки, поля) 20px, мелкие элементы (чипы, аккорды, степпер, инструменты редактора) 10px, ноты-чипы 8px, кнопки/навигация/сегменты/бейджи — пилюля 999px. Выбор показывается заливкой или рамкой кобальта, не формой.

**The Bean Proportion Rule.** Фасолина — пропорциональная «почка» с ямкой сверху (`BEAN_PATH`, viewBox `8 2 86 64`); масштабируется только целиком и вращается внутри волны, никогда не растягивается.

**The Tile Not Pill Rule.** Переключатель режимов упражнения (`seg.modes`) — плитки с радиусом 20px (кнопки 16px), а не пилюля: в столбик на телефоне полное скругление превращается в овал. Обычные однострочные сегменты остаются пилюлей.

## Components

### Buttons
- **Primary:** кобальт, белый 800/16px, высота 48px, поля 24px, пилюля; иконка lucide 16–18px.
- **Ghost / Stop:** прозрачный, текст midnight, рамка line. «Стоп» — ghost на месте старта.
- **Disabled:** фон line, текст muted.
- **Text button:** muted → text, 14px.

### Сегменты и поля
- **Seg:** подложка accent-soft, пилюля, отступ 4px; кнопки 14px/700, 34px; выбранная — кобальт, белый 800 (`aria-pressed`).
- **Modes:** см. Tile Not Pill Rule; три колонки на десктопе, столбик на телефоне; название 14px/700, подпись 12px/500 muted.
- **Select:** surface, рамка, радиус 20px, высота 40px, 16px. Чекбоксы и range — `accent-color`.

### Cards / Tiles
- **Card:** surface, рамка line, 24px радиус и поля. CTA — рамка кобальтом.
- **Hero-card:** butter, midnight, 24px, поля 28px (20px на телефоне); внутри волна фасолин, следующий шаг (22px/800 + текст 15px) и широкая кобальтовая кнопка 56px «Начать/Продолжить».
- **Tile:** surface, радиус 20px, поля 16px, рамка кобальтом при наведении.
- **Plan list:** строки с линией сверху; минуты кобальтом, выполненное — галочка good, текст 55%.

### Navigation
Пилюли 15px/600 muted; активный — кобальт с белым 700. Иконки lucide 20px, stroke 1.75. На телефоне активный таб — кобальтовый текст.

### Ответы викторины
Кнопки 52px, фон chalk, рамка line, радиус 20px. Верно — good 25% + рамка; неверно — bad 22% + рамка; остальные 45%.

### Bean wave (сигнатурный)
Двенадцать элементов: точки по краям, фасолины растут к центру под разными углами, две открытые дужки-полумесяца обрамляют центр. Цвет — кобальт; высота 120px десктоп / 54px телефон. Фасолины мягко «дышат» по очереди (scale 1→1.12, 2.8s, задержка 0.1s); `prefers-reduced-motion` отключает. С живыми данными (`levels`) высота отражает реальную громкость.

### Дыхательный шар
Та же фасолина: вдох/выдох — кобальт с белыми цифрами, задержка — butter с midnight, покой — accent-soft.

### Piano keys
Белые — #fff, подпись midnight 11px; чёрные — midnight (в тёмной теме #0A0E24), 28×92px (20×80 на телефоне). Состояния: зажата — кобальт; верно/неверно — good/bad 45%; аккорд — good 25%; вне лада — bad 40%; приглушена — смесь с muted.
- **Квиз ступеней:** клавиатура только в тональностях До, Соль, Фа — ступени читаются на белых клавишах. Режимы ответа — сегмент «Сразу» / «С подбором».

### Piano roll
Одна строка — полутон; «чёрные» ряды roll-black, линия «до» roll-cline. **«Слушай» — контур** roll-listen, **«пой» — заливка** кобальтом: различие формой. Спетая цель и линия голоса (3px) красятся светофором; атака (20%) нейтральна. Курсор — пунктир roll-cline, точка голоса цветом точности. Текст канвы — Manrope.

### Evidence badge
11px/600, пилюля 2px 8px, четыре ступени Monochrome Evidence Rule.

## Do's and Don'ts

### Do:
- **Do** брать цвета только из CSS-переменных — в CSS и в канве.
- **Do** ставить логотип cobalt на светлом и белый на тёмном; полный логотип не уже 160px.
- **Do** держать мелкий текст на кобальте белым (жёлтый/синий 4.49:1 — ниже AA).
- **Do** различать «слушай» и «пой» формой, оценку — цветом; состояние не только цветом.
- **Do** давать доске основную высоту и прятать хром через `data-focus`.
- **Do** держать цели касания ≥ 44px и иконки lucide-react.
- **Do** писать по-русски, на «ты», коротко; центы «ц» с минусом «−», диапазоны «Си2–Фа4», склонение через `plural`.

### Don't:
- **Don't** растягивать фасолину или логотип, добавлять им тени и обводки.
- **Don't** использовать светофор вне точности и правильности, а кобальт — для оценки.
- **Don't** писать жёлтым по белому.
- **Don't** превращать многострочный выбор режима в пилюлю.
- **Don't** возвращать на главную сегменты разделов.
- **Don't** ставить капс с разрядкой над заголовками и заменять иконки символами Юникода.
- **Don't** раскрашивать бейджи доказательности.
