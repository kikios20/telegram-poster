import { Link } from 'react-router-dom'

export function Privacy() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link to="/dashboard" className="text-kikio-glow hover:underline">
          ← На главную
        </Link>
      </div>
      
      <div className="card p-8">
        <h1 className="text-3xl font-bold mb-6">Политика конфиденциальности</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
          <p className="text-sm text-gray-500">Последнее обновление: {new Date().toLocaleDateString('ru-RU')}</p>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Сбор данных</h2>
            <p>Мы собираем следующие данные:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Email и пароль для регистрации</li>
              <li>Telegram session для авторизации в API Telegram</li>
              <li>Данные о рассылках (кампании, логи отправок)</li>
              <li>IP-адрес и информацию о браузере</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Использование данных</h2>
            <p>Собранные данные используются для:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Оказания услуг по рассылке сообщений</li>
              <li>Улучшения качества сервиса</li>
              <li>Технической поддержки</li>
              <li>Предотвращения злоупотреблений</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Защита данных</h2>
            <p>
              Мы принимаем технические и организационные меры для защиты ваших данных:
            </p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Пароли хешируются с использованием bcrypt</li>
              <li>Telegram-сессии шифруются с помощью Fernet</li>
              <li>Данные хранятся на защищённых серверах</li>
              <li>Используется HTTPS-соединение</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Хранение данных</h2>
            <p>
              Ваши данные хранятся до момента удаления аккаунта. 
              Вы можете запросить удаление ваших данных, написав на support@telegram-poster.com.
              Логи рассылок хранятся в соответствии с вашим тарифным планом.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Передача третьим лицам</h2>
            <p>
              Мы не передаём ваши персональные данные третьим лицам, за исключением случаев, 
              предусмотренных законодательством.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Ваши права</h2>
            <p>Вы имеете право:</p>
            <ul className="list-disc list-inside space-y-2 mt-2">
              <li>Получить доступ к своим данным</li>
              <li>Исправить неточные данные</li>
              <li>Удалить свои данные</li>
              <li>Отозвать согласие на обработку данных</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies</h2>
            <p>
              Мы используем cookies для аутентификации и запоминания настроек. 
              Вы можете отключить cookies в настройках браузера, но это может повлиять 
              на функциональность сервиса.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Контактная информация</h2>
            <p>
              По вопросам конфиденциальности обращайтесь: support@telegram-poster.com
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
