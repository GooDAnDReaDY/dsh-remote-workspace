# task_plan.md — dsh-remote-workspace

## Цель
Создать высоконадежный корпоративный плагин удаленной разработки dsh-remote-workspace для DeepSeek Harness с современным UI, сервисной архитектурой Cordis, 3-way mirror sync, SSH port forwarding и компактным набором инструментов LLM.

## Фазы реализации
- [x] **Фаза 1**: Анализ dsh-remote, формирование архитектуры, инициализация репозитория Gitea и worktree.
- [x] **Фаза 2**: Конфигурация сборки и репозитория (package.json, .gitignore, cordis.patch.yml).
- [x] **Фаза 3**: Ядро backend сервисов (SshService, RemoteFsService, MirrorSyncService, TunnelService).
- [x] **Фаза 4**: Инструменты модели (
emote_exec, 
emote_fs, 
emote_sync, 
emote_tunnel) и API маршруты.
- [x] **Фаза 5**: Клиентская часть (i18n RU/EN/ZH, UI слоты).
- [x] **Фаза 6**: Комплексное тестирование базовых модулей (12/12 pass).
- [x] **Фаза 7**: Дополнительные ручные сценарии и документация (Docs standard EN/RU/ZH).
- [/] **Фаза 8**: Стабильность, аудит багов, расширение тестов и дизайн в едином стиле dsh-clinebot:
  - [ ] 8.1. Исправление стабильности: безопасный доступ к Cordis сервисам (ctx.get), сброс соединений при смене реквизитов профиля, нормализация полей в 	estConnection (latencyMs / remoteOs).
  - [ ] 8.2. Безопасность и отказоустойчивость: фильтрация isTrustedSettingsRequest на API маршрутах, обработка ошибок стримов в TunnelService, автосоздание папок в MirrorSyncService.
  - [ ] 8.3. Редизайн UI в едином стиле dsh-clinebot: модульные карточки, статусные бейджи в шапке, добавление поля localMirrorPath, секция управления туннелями в интерфейсе.
  - [ ] 8.4. Расширение набора тестов (тесты API routes, tools, store/apply, client registration).
  - [ ] 8.5. Тестирование на изолированном MiniPC сервере (dsh-test-plugin).
