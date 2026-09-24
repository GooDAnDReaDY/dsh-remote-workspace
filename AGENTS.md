# AGENTS.md

Этот файл дополняет корневой `/mnt/external/Project/DEV/AGENTS.md` и содержит только факты этого плагина.

## Product / Purpose

- Проект: `dsh-remote-workspace`
- Пакет: `@goodandready/dsh-remote-workspace`
- DEV: `/mnt/external/Project/DEV/dhsplugins/dsh-remote-workspace`
- Назначение: SSH-профили, SFTP, зеркальная синхронизация, проброс портов и карточка настроек DeepSeek Harness.
- Пользователи: установленный профиль DSH.
- Точка входа хоста: `lib/index.js`, `export const name` совпадает с именем пакета.
- Клиент: `src/client/*` собирается в `lib/client.js` командой `node scripts/build-client.mjs`. Идентификатор загрузчика — `@goodandready/dsh-remote-workspace`.
- Слот настроек: `settings.plugin.item`, namespace `dsh-remote-workspace`.
- Маршруты: `/dsh-remote-workspace/*`.
- Локали продукта: `en` и `zh`. Русские строки интерфейса живут только в `dsh-russian-lang`.
- Текущая версия в `package.json`: `0.3.7`
- Статус проверен: 2026-09-24, `origin/main` `971da85`, `npm test` на ветке batch 2 — 75 pass, 0 fail.

## Commands

- Тесты: `npm test`. Команда сначала пересобирает `lib/client.js`, затем запускает `node --test test/*.test.mjs test/*.test.js`.
- Сборка клиента отдельно: `npm run build:client`.
- `prepack` тоже пересобирает клиент.

## Publication

- Публичный канал уже выбран: GitHub `GooDAnDReaDY/dsh-remote-workspace` и npm `@goodandready/dsh-remote-workspace`.
- В npm `files` входят только `lib/`, `cordis.patch.yml`, README на трёх языках и `LICENSE`.
- `AGENTS.md`, `index.md` и `docs/**` запрещены к публикации. `scripts/publish-github.sh` отбрасывает их до копирования.
- Файл `deploy.sh` отсутствует: поставка — пакет DSH, отдельного OPT-каталога плагина нет. Не создавать пустой `deploy.sh`.

## Constraints

- Разработка только в Git worktree внутри `.worktrees/`.
- Git только через `/home/vadim/.ssh/bin/git-cursor`.
- Не публиковать служебные файлы и не поднимать вторую цифру версии без прямой просьбы владельца.
