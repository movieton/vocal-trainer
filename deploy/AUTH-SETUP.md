# Вход через Google и Яндекс: что сделать один раз

Ключи никому не пересылай и не вставляй в чат. Они кладутся только в файл на сервере (шаг 3).

## 1. Google (≈10 минут)

1. Открой https://console.cloud.google.com и создай проект «fasol» (меню сверху → New project).
2. **APIs & Services → OAuth consent screen** (в новой консоли — **Google Auth Platform → Branding**):
   - тип пользователей **External**;
   - название **fasol.app**, почта поддержки — твоя;
   - домен приложения: `https://fasol.app`, политика конфиденциальности: `https://fasol.app/#/privacy`;
   - разрешения (scopes): `openid`, `email`, `profile` — больше ничего;
   - затем **Publish app** (Audience → In production), иначе войти смогут только тестовые адреса.
3. **Credentials → Create credentials → OAuth client ID** (в новой консоли — **Clients → Create client**):
   - тип **Web application**, имя «fasol web»;
   - Authorized redirect URI: `https://fasol.app/api/auth/google/callback`.
4. Скопируй **Client ID** и **Client secret**.

## 2. Яндекс ID (≈5 минут)

1. Открой https://oauth.yandex.ru/client/new (войди своим Яндекс-аккаунтом).
2. Название сервиса «fasol.app», платформа **Веб-сервисы**.
3. Redirect URI: `https://fasol.app/api/auth/yandex/callback`, Suggest Hostname: `https://fasol.app`.
4. Доступы: **Доступ к логину, имени и фамилии, полу**, **Доступ к адресу электронной почты**, **Доступ к портрету пользователя**.
5. Создай и скопируй **ClientID** и **Client secret**.

## 3. Положить ключи на сервер

В терминале:

```bash
ssh -i ~/.ssh/id_rsa_169.58.16.244 root@169.58.16.244
```

```bash
nano /opt/fasol-api/.env
```

Вставь четыре строки со своими значениями, сохрани (Ctrl+O, Enter, Ctrl+X):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
```

Напиши Claude «ключи положил» — он пересоздаст контейнер (`deploy/deploy-api.sh`), чтобы сервер подхватил ключи. Простой `docker restart` их не перечитывает.

Проверка: https://fasol.app/api/providers должен показать `{"providers":["google","yandex"]}`. Кнопки входа появятся в разделе «Аккаунт» сами.

## 4. Письма для восстановления пароля (Resend, ≈10 минут)

1. Зарегистрируйся на https://resend.com (бесплатно до 3000 писем в месяц).
2. **Domains → Add domain** → `fasol.app`. Resend покажет 3–4 DNS-записи (TXT и MX) — добавь их у регистратора домена fasol.app и нажми **Verify**.
3. **API Keys → Create API key** (права: Sending access).
4. На сервере в `/opt/fasol-api/.env` добавь две строки:

```
RESEND_API_KEY=...
MAIL_FROM=fasol.app <noreply@fasol.app>
```

5. Напиши Claude «ключ почты положил» — он пересоздаст контейнер. На странице входа появится «Забыли пароль?».
