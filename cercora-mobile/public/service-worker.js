/* eslint-disable no-undef */

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "Cercora";
  const options = {
    body: payload.body || "",
    tag: payload.tag,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const rawUrl = data.url || "/";
  const url = rawUrl.startsWith("/") ? self.location.origin + rawUrl : rawUrl;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url === url || client.url.startsWith(self.location.origin)) {
            client.navigate(url);
            return client.focus();
          }
        }
      }
      return clients.openWindow(url);
    })
  );
});

