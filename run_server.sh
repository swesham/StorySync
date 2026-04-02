cd "$(dirname "$0")"
export DJANGO_SETTINGS_MODULE=storysync.settings
./venv/bin/python -m daphne -b 127.0.0.1 -p 8000 storysync.asgi:application
