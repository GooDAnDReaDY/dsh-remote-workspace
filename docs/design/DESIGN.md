# DESIGN.md — dsh-remote-workspace

## Product / Purpose
- **Назначение**: Полнофункциональный корпоративный плагин удалённой разработки для DeepSeek Harness (DSH). Обеспечивает подключение к удалённым серверам по SSH (ключ / пароль), SFTP-навигацию, 3-way синхронизацию локального зеркала, SSH-туннелирование (port forwarding) и компактный набор инструментов для LLM агента (
emote_exec, 
emote_fs, 
emote_sync, 
emote_tunnel).
- **Аудитория**: Разработчики и инженеры, использующие DSH для работы с проектами на VPS, удаленных серверах, облачных инстансах и MiniPC.
- **Статус**: Стабильный релиз v0.3.2 (One-Click Updater, Cross-Plugin API, Clean Tokens, Modular Routes).

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
3. **Секция 3: Диагностика активного подключения**:
   - Четырёхколоночная сетка метрик активного сервера (Хост, Удалённая папка, Метод авторизации, Статус ядра).
4. **Секция 4: Синхронизация зеркала (Mirror Sync)**:
   - Кнопки Pull (Remote -> Local) и Push (Local -> Remote) с индикацией процесса, результатом и предупреждением при конфликтах.
5. **Секция 5: SSH-туннели (Port Forwarding)**:
   - Таблица активных туннелей (ID, Локальный порт -> Удалённый порт) с кнопкой закрытия.
   - Форма создания нового туннеля (Local Port, Remote Port, кнопка «Открыть туннель»).

## Security & Reliability
- Защита всех мутирующих эндпоинтов проверкой isTrustedSettingsRequest(req) (защита от cross-site атак).
- Безопасное чтение Cordis сервисов через .get() с fallback.
- Изоляция жизненного цикла стримов в TunnelService (прослушивание сокетных и потоковых ошибок).
