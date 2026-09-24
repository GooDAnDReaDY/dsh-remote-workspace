# DESIGN.md — dsh-remote-workspace

## Product / Purpose
- **Назначение**: Полнофункциональный корпоративный плагин удалённой разработки для DeepSeek Harness (DSH). Обеспечивает подключение к удалённым серверам по SSH (ключ / пароль), SFTP-навигацию, 3-way синхронизацию локального зеркала, SSH-туннелирование (port forwarding) и компактный набор инструментов для LLM агента (
emote_exec, 
emote_fs, 
emote_sync, 
emote_tunnel).
- **Аудитория**: Разработчики и инженеры, использующие DSH для работы с проектами на VPS, удаленных серверах, облачных инстансах и MiniPC.
- **Статус**: Стабильный релиз v0.3.3 (One-Click Updater, Cross-Plugin API, Clean Tokens, Modular Routes).

## User Surfaces
- **Web/UI**: Нативная карточка настроек профилей хостов (settings.plugin.item), удаленный SFTP браузер каталогов, чип статуса подключения в шапке сессии (conversation.session.header.utilities).
- **DSH UI / settings / slots**:
  - Карточка плагина: settings.plugin.item для @goodandready/dsh-remote-workspace.
  - Статусный чип сессии: conversation.session.header.utilities (order: 30).
  - Запрещённые слоты: settings.section (запрещён стандартом authoring, все настройки только внутри settings.plugin.item).
- **API маршруты**:
  - GET /dsh-remote-workspace/state: получение профилей, активного хоста и туннелей.
  - POST /dsh-remote-workspace/profiles/save: сохранение профиля (с валидацией и сбросом старых соединений).
  - POST /dsh-remote-workspace/profiles/delete: удаление профиля.
  - POST /dsh-remote-workspace/profiles/active: переключение активного профиля.
  - POST /dsh-remote-workspace/test: live-проверка связи (Ping, OS, Latency).
  - POST /dsh-remote-workspace/browse: чтение содержимого удалённой папки (SFTP).
  - POST /dsh-remote-workspace/sync: запуск двусторонней 3-way синхронизации зеркала (pull/push).
  - POST /dsh-remote-workspace/tunnels/start: создание локального SSH-туннеля.
  - POST /dsh-remote-workspace/tunnels/stop: остановка активного SSH-туннеля.
- **CLI / Model Tools**:
  - 
emote_exec: выполнение команд на сервере.
  - 
emote_fs: чтение, атомарная запись, stat, mkdir, remove.
  - 
emote_sync: запуск 3-way синхронизации с контролем конфликтов.
  - 
emote_tunnel: создание/остановка/листинг туннелей.

## Visual Direction (Единый стиль dsh-clinebot)
- **Атмосфера**: Премиальный инженерный интерфейс уровня VS Code Remote / Linear. Строгая типографика, плотные функциональные карточки, чистые переходы и отсутствие лишних теней.
- **Токены ядра DSH**:
  - Фоны: ar(--dsw-alias-bg-layer-3) (карточки), ar(--dsw-alias-bg-layer-2) (поля ввода, вложенные блоки, таблицы), ar(--dsw-alias-bg-layer-1) (сегменты, подложка).
  - Границы: ar(--dsw-alias-border-l2).
  - Текст: ar(--dsw-alias-label-primary), ar(--dsw-alias-label-secondary), ar(--dsw-alias-label-dimmed).
  - Статусы: ar(--dsw-alias-state-success-primary), ar(--dsw-alias-state-warning-primary), ar(--dsw-alias-state-error-primary), ar(--dsw-alias-state-brand-primary).
- **Шапка карточки**:
  - Название плагина, подзаголовок, статусный аккордеонный шеврон.
  - Статусные пилюли (Badges): Host online / Offline, Active Profile, Active Tunnels count.

## Components And States
1. **Секция 1: Профили серверов (SSH Profiles)**:
   - Таблица настроенных машин с бейджами типа аутентификации (🔑 key / 🔒 pwd), меткой активного сервера, кнопками «Сделать активным», «Редактировать», «Удалить».
   - Пустое состояние: ясное сообщение и кнопка + Добавить хост.
2. **Секция 2: Интерактивный редактор профиля**:
   - Название, Хост/IP, Порт, Пользователь.
   - Сегментированный переключатель авторизации (SSH-ключ vs Пароль).
   - Поля авторизации: путь к приватному ключу, парольная фраза, либо пароль (маскированный).
   - Директории: Удалённый каталог проекта (с кнопкой вызова SFTP браузера) и **Локальная папка зеркала** (с подсказкой назначения).
   - Кнопки: «⚡ Проверить связь (Ping)», «Отмена», «Сохранить».
   - Результат пинга: отображение Latency: X ms | OS: Y или понятный текст ошибки.
- Ошибки сохранения, удаления, выбора активного профиля, загрузки списка и обзора каталога показываются текстом в шапке (`role=alert`), а не молчаливым отсутствием изменений.
- Бейдж шапки карточки отражает загрузку `/state`: checking, no active host, host ready или status unavailable. Постоянная подпись Ready не используется.
- Шеврон шапки берёт `IconChevronDownOutline14`, если пакет примитивов его отдал. Свой SVG 14×14 остаётся только когда иконка недоступна. `aria-expanded` на кнопке шапки сохраняется.
- Подпись пункта в списке плагинов берётся из словарей `en.title` / `zh.title`. Вызов сервиса локали из геттера `label` не используется: он роняет клиентский пакет во время отрисовки страницы.
- Строка версии в блоке обновления показывает `currentVersion` из ответа статуса. Пока версия не пришла, показывается нейтральная подпись, а не зашитый номер релиза.
3. **Секция 3: Диагностика активного подключения**:
   - Четырёхколоночная сетка метрик активного сервера (Хост, Удалённая папка, Метод авторизации, Статус ядра).
4. **Секция 4: Синхронизация зеркала (Mirror Sync)**:
   - Кнопки Pull (Remote -> Local) и Push (Local -> Remote) с индикацией процесса, результатом и предупреждением при конфликтах.
5. **Секция 5: SSH-туннели (Port Forwarding)**:
   - Таблица активных туннелей (ID, Локальный порт -> Удалённый порт) с кнопкой закрытия.
   - Форма создания нового туннеля (Local Port, Remote Port, кнопка «Открыть туннель»).

## Security & Reliability
- Защита всех мутирующих эндпоинтов проверкой isTrustedSettingsRequest(req) (защита от cross-site атак).
- POST обновления плагина принимает только loopback и same-origin. Адрес частной сети сам по себе установку не разрешает.
- Безопасное чтение Cordis сервисов через .get() с fallback.
- Изоляция жизненного цикла стримов в TunnelService (прослушивание сокетных и потоковых ошибок).

### v0.3.3 Client Architecture Modularization (Refs: #14)
- Client-side code decomposed into modular ES components under `src/client/`:
  - `src/client/styles.js` — CSS styling with DSH theme variables
  - `src/client/locales.js` — English and Chinese translation dictionaries
  - `src/client/env-editor.js` — Remote .env manager tab component
  - `src/client/docker.js` — Container inspector tab component
  - `src/client/terminal.js` — Web terminal tab component
  - `src/client/file-browser.js` — Remote file explorer tab component
  - `src/client/profiles-panel.js` — SSH profile form and host table
  - `src/client/sync-panel.js` — mirror sync actions
  - `src/client/tunnels-panel.js` — port-forwarding form and tunnel table
  - `src/client/settings-view.js` — profile state and the diagnostics card that composes the panels
  - `src/client/updater-section.js` — One-click updater section component
  - `src/client/plugin-card.js` — Plugin card and status chip components
  - `src/client/entry.js` — Cordis client plugin apply and slot registration
- Added native builder `scripts/build-client.mjs` hooked into `prepack` and `npm test`.

### v0.3.6 Model Tools JSON Schema Standardization (Refs: #33)
- Все 9 инструментов (`remote_exec`, `remote_fs`, `remote_sync`, `remote_tunnel`, `remote_docker`, `remote_service`, `remote_transfer`, `remote_diagnose`, `remote_env`) переведены на компиляцию через `defineTool()` из `@deepseek-ai/dsh-tools`.
- Параметры инструментов компилируются в строгий JSON Schema с корнем `{ type: 'object', properties: ..., required: [...] }`.
- Предотвращены ошибки валидации схем в OpenAI-совместимых провайдерах (`Invalid schema: schema must be a JSON Schema of 'type: "object"', got 'type: null'`).
- Схема вывода стандартизирована с явным `{ type: 'object', additionalProperties: true }`.

- 2026-09-24: профиль хранит необязательный `proxyCommand`. Непустая команда подменяет прямой TCP-сокет; `%h`, `%p`, `%r`, `%n` раскрываются перед запуском. Прыжок через `jumpHostId` используется только когда команда пуста.

- 2026-09-24: `jumpHosts` — массив профилей бастионов по порядку. Строка `jumpHostId` с запятыми читается так же. Закрытие целевой сессии закрывает только промежуточные клиенты цепочки; первый бастион остаётся в общем пуле.

- 2026-09-24: тип аутентификации `agent` не сохраняет приватный ключ. Путь сокета берётся из поля, иначе из `SSH_AUTH_SOCK`; значение `pageant` и пустой путь на Windows означают Pageant.

- 2026-09-24: `keyboard-interactive` показывает на карточке поля запроса и ждёт ответ 60 секунд. Пустой ответ по таймауту завершает попытку. Код не сохраняется в профиле.

- 2026-09-24: импорт SSH-конфига раскрывает `Include`, включая glob, и показывает, сколько хостов добавлено и какие блоки пропущены: шаблон, Match, дубликат, отсутствующий файл.

- 2026-09-24: инструмент `remote_hosts` отдаёт модели таблицу хостов. Пароли, ключи, путь агента и текст `proxyCommand` в эту таблицу не попадают; прыжок и прокси видны только как признаки.

- 2026-09-24: профиль хранит environment, tags, location и description. Список хостов группируется плоско, по окружению или по тегу. «Test group» проверяет хосты выбранной секции и показывает latency или ошибку.

- 2026-09-24: вкладка Cluster запускает одну команду на хостах, отобранных по окружению, тегам или именам. Параллельность по умолчанию 8. Результат каждого хоста можно раскрыть.

- 2026-09-24: простаивающее SSH-соединение закрывается через 30 минут. Соединение с туннелем или незавершённой командой не закрывается. Следующая команда открывает его снова.

- 2026-09-24: обрыв соединения до начала вывода повторяется до трёх раз. Если команда уже начала печатать вывод или вызвана с idempotent: false, повтор не делается. Таймаут самой команды тоже не повторяется.

- 2026-09-24: терминал открывает отдельное SSH-соединение и закрывает его вместе с сессией. Общий пул команд и SFTP от этого не зависит.

- 2026-09-24: шрифт терминала задаётся в настройках плагина полем terminalFontFamily. Пустое значение оставляет стандартный моноширинный набор. В значение допускаются только буквы, цифры, пробел, запятая, точка, кавычка, подчёркивание и дефис.

- 2026-09-24: опрос состояния раз в две секунды останавливается, пока вкладка скрыта, и не запускает второй запрос, пока первый не завершился. Когда вкладка снова видна, состояние обновляется сразу.

- 2026-09-24: загрузка и скачивание файла идут потоком, с процентом по переданным байтам и кнопкой отмены. Скачивание отдаёт сам файл и длину. Загрузка пишется во временный файл и переименовывается после успеха. Предел одного файла — 512 МБ.
