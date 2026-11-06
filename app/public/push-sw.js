// Напоминания fasol.app: показываем уведомление с сервера и открываем приложение по нажатию
self.addEventListener('push', e => {
  let d = { title: 'fasol.app', body: 'Пора распеться', url: '/' }
  try { d = { ...d, ...e.data.json() } } catch { /* пустое уведомление */ }
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, icon: '/pwa-192.png', badge: '/pwa-192.png', data: { url: d.url }, tag: 'fasol-reminder' }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  // открываем только страницы самого fasol.app
  let url = '/'
  try { const u = new URL(e.notification.data?.url ?? '/', self.location.origin); if (u.origin === self.location.origin) url = u.href } catch { /* по умолчанию — главная */ }
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => new URL(c.url).origin === self.location.origin)
    return open ? open.focus() : clients.openWindow(url)
  }))
})
