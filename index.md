# dsh-remote-workspace

- Назначение: плагин DeepSeek Harness для SSH-профилей, SFTP, зеркальной синхронизации и проброса портов.
- Пакет: `@goodandready/dsh-remote-workspace`
- Версия: `0.3.9` (кандидат, 2026-09-24)
- DEV: `/mnt/external/Project/DEV/dhsplugins/dsh-remote-workspace`
- OPT-каталога нет. Плагин ставится в профиль DSH пакетом.
- Хост: `lib/index.js`. Клиент: `src/client/*` → `lib/client.js`.
- Карточка: слот `settings.plugin.item`, ключ `dsh-remote-workspace`.
- Проверка: `npm test` (сборка клиента и `node --test`).
- Дизайн: `docs/design/DESIGN.md` (только Gitea, не npm и не GitHub).
- Публикация: `scripts/publish-github.sh`. `AGENTS.md`, `index.md` и `docs/**` в публичное дерево не входят.
- `deploy.sh` нет и не нужен: доставка идёт пакетом, не копированием в `/opt`.
