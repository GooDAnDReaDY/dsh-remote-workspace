# task_plan.md — dsh-remote-workspace (v0.3.1)

## Цель
Реализовать 5 ключевых возможностей в рамках релиза v0.3.1:
1. Smart Tarball Sync (пакетное ускорение передачи каталогов).
2. remote_diagnose (комплексный агентский инструмент диагностики сервера).
3. Import from ~/.ssh/config (парсинг хостов в .env vault).
4. remote_env & Remote Environment Manager (безопасный редактор .env).
5. AlertService (фоновый мониторинг аномалий и события Cordis).

## Статус фаз
- [ ] **Фаза 1**: Backend-сервисы (lib/tar-sync-service.js, lib/diagnose-service.js, lib/ssh-config-parser.js, lib/env-service.js, lib/alert-service.js)
- [ ] **Фаза 2**: Интеграция в инструменты модели (remote_diagnose, remote_env, smart sync) и API маршруты
- [ ] **Фаза 3**: Обновление клиентского интерфейса (кнопка импорта SSH, вкладка/модалка .env, индикатор алертов)
- [ ] **Фаза 4**: Модульные и интеграционные тесты (test/phase4.test.mjs)
- [ ] **Фаза 5**: Документация (README EN/RU/ZH, DESIGN.md) и проверка лимитов размера (<250 KiB)
- [ ] **Фаза 6**: Тестовый гейт на MiniPC (dsh-test-plugin) и боевая верификация на MiniAI

## Next Step
Создание backend-сервисов в lib/.
EOF
