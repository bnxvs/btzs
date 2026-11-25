#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Развёртывание Plotter (веб-версия) на VPS через Docker Compose.
#
#   ./scripts/deploy.sh            # сборка образа и запуск/обновление
#   ./scripts/deploy.sh --npm      # + подключение к docker-сети Nginx Proxy Manager
#
# Переменные окружения (или файл .env):
#   PLOTTER_BIND   адрес публикации на хосте (по умолчанию 127.0.0.1)
#   PLOTTER_PORT   порт на хосте (по умолчанию 8080)
#   NPM_NETWORK    имя внешней сети NPM (по умолчанию npm_default), для --npm
#
# Скрипт идемпотентен: повторный запуск пересобирает образ и перезапускает
# контейнер; состояния у приложения нет, потерь данных не бывает.
# ---------------------------------------------------------------------------
set -eu

cd "$(dirname "$0")/.."

COMPOSE_FILES="-f docker-compose.yml"

if [ "${1:-}" = "--npm" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.npm.yml"
  NPM_NETWORK="${NPM_NETWORK:-npm_default}"
  if ! docker network inspect "$NPM_NETWORK" >/dev/null 2>&1; then
    echo "Ошибка: docker-сеть «$NPM_NETWORK» не найдена. Укажите NPM_NETWORK или проверьте 'docker network ls'." >&2
    exit 1
  fi
fi

if [ ! -f .env ]; then
  echo "Файл .env не найден — создаю из .env.example."
  cp .env.example .env
fi

echo "==> Сборка и запуск контейнеров"
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d --build --remove-orphans

echo "==> Состояние"
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES ps

echo "==> Готово. Логи: docker compose logs -f web"
