# Kikio - Telegram Mass Messaging Platform

<p align="center">
  <img src="frontend/public/kikio.svg" alt="Kikio Logo" width="80" />
</p>

<p align="center">
  <strong>Kikio</strong> — платформа для массовой рассылки сообщений в Telegram
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-39ff14?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/python-3.11+-39ff14?style=for-the-badge" alt="Python" />
  <img src="https://img.shields.io/badge/react-18-39ff14?style=for-the-badge" alt="React" />
</p>

---

## 🚀 Быстрый старт

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for production)

### Backend

```bash
cd backend

# Создайте виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
.\venv\Scripts\activate  # Windows

# Установите зависимости
pip install -r requirements.txt

# Настройте переменные окружения
cp .env.example .env
# Отредактируйте .env файл

# Запустите сервер
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend

# Установите зависимости
npm install

# Запустите dev сервер
npm run dev
```

Откройте http://localhost:3000 в браузере.

---

## 📁 Структура проекта

```
telegram-poster/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── core/          # Config, security
│   │   ├── models/        # Database models
│   │   ├── services/      # Business logic
│   │   └── main.py        # FastAPI app
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # State management
│   │   └── styles/        # CSS styles
│   └── package.json
└── README.md
```

---

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход по email
- `POST /api/auth/login/api-key` - Вход по API ключу
- `GET /api/auth/me` - Информация о пользователе

### Telegram
- `POST /api/telegram/connect` - Начало подключения
- `POST /api/telegram/verify-code` - Подтверждение кода
- `POST /api/telegram/verify-2fa` - Подтверждение 2FA
- `GET /api/telegram/status` - Статус подключения
- `POST /api/telegram/validate-chat` - Валидация чата
- `POST /api/telegram/logout` - Отключение

### Campaigns
- `POST /api/campaigns/` - Создание рассылки
- `GET /api/campaigns/` - Список рассылок
- `GET /api/campaigns/{id}` - Статус рассылки
- `POST /api/campaigns/{id}/start` - Запуск
- `POST /api/campaigns/control` - Управление (pause/resume/stop)
- `DELETE /api/campaigns/{id}` - Удаление

---

## ⚙️ Конфигурация

### Environment Variables

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/kikio

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-super-secret-key-here
SESSION_ENCRYPTION_KEY=32-byte-encryption-key-here

# Telegram Limits
MIN_DELAY_SECONDS=7
MAX_DELAY_SECONDS=3600
```

---

## 🔐 Безопасность

1. **Шифрование сессий** - Сессии Telegram хранятся в зашифрованном виде
2. **Rate limiting** - Ограничения на скорость отправки
3. **Валидация чатов** - Проверка доступности чатов перед отправкой
4. **Логирование** - Все действия записываются в логи

---

## ⚠️ Disclaimer

Этот проект предназначен для образовательных целей. При использовании обязательно соблюдайте правила Telegram и не спамьте в чаты без разрешения администраторов.

---

## 📝 License

MIT License - see LICENSE file for details.