import { Link } from 'react-router-dom'

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/dashboard" className="text-kikio-glow hover:underline">
          ← На главную
        </Link>
      </div>
      
      <div className="card p-8">
        <h1 className="text-3xl font-bold mb-6">Условия использования</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
          <p className="text-sm text-gray-500">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Общие положения</h2>
            <p>
              Используя сервис TelegramPoster, вы соглашаетесь с настоящими условиями использования. 
              Сервис предоставляется "как есть" без каких-либо гарантий.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Описание сервиса</h2>
            <p>
              TelegramPoster — это инструмент для массовой рассылки сообщений через Telegram. 
              Сервис позволяет автоматизировать отправку сообщений в чаты и группы Telegram.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Правила использования</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Запрещено использовать сервис для рассылки спама</li>
              <li>Запрещено отправлять незаконный контент</li>
              <li>Запрещено нарушать правила Telegram</li>
              <li>Вы несете ответственность за содержание ваших рассылок</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Ограничение ответственности</h2>
            <p>
              Мы не несём ответственности за блокировку вашего аккаунта Telegram, 
              последствия использования сервиса или действия третьих лиц.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Тарифы и оплата</h2>
            <p>
              Сервис предоставляется по тарифам Free, Basic и VIP. 
              Оплата производится помесячно. Возможен возврат средств в течение 7 дней 
              с момента оплаты при технических проблемах.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Контактная информация</h2>
            <p>
              По вопросам использования сервиса обращайтесь: support@telegram-poster.com
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
