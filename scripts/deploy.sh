#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Развёртывание Plotter (веб-версия) на VPS через Docker Compose.
#
#   ./scripts/deploy.sh            # сборка образа и запуск/обновление
#
# Переменные окружения (или файл .env):
#   PLOTTER_BIND   интерфейс публикации на хосте (по умолчанию 127.0.0.1)
#   PLOTTER_PORT   порт на хосте (по умолчанию 8080)
#
# После запуска укажите в Nginx Proxy Manager (внешний прокси) Host
# `127.0.0.1` и Port `$PLOTTER_PORT`.
#
# Скрипт идемпотентен: повторный запуск пересобирает образ и перезапускает
# контейнер; состояния у приложения нет, потерь данных не бывает.
# ---------------------------------------------------------------------------
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Файл .env не найден — создаю из .env.example."
  cp .env.example .env
fi

# Значения по умолчанию совпадают с docker-compose.yml и .env.example.
PORT="$(sed -n 's/^PLOTTER_PORT=//p' .env | tail -1)"
PORT="${PORT:-8080}"

echo "==> Сборка и запуск контейнеров"
docker compose up -d --build --remove-orphans

echo "==> Состояние"
docker compose ps

echo
echo "==> Готово."
echo "    Проверка:  curl -fsS http://127.0.0.1:${PORT}/healthz   # → ok"
echo "    Логи:      docker compose logs -f web"
echo "    Nginx Proxy Manager: Host 127.0.0.1, Port ${PORT}"
