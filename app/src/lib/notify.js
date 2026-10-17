// Browser notifications (US-1.4, US-7.1). Every call is guarded: the API may be
// missing, blocked, or throw in older browsers, and alerts must still work in-app.

export function notificationPermission() {
  try {
    return "Notification" in window ? Notification.permission : "unsupported";
  } catch {
    return "unsupported";
  }
}

export async function requestNotifications() {
  try {
    if (!("Notification" in window)) return "unsupported";
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showBrowserNotification(title, body) {
  if (notificationPermission() !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.svg" });
  } catch {
    // Some browsers (e.g. Android Chrome) only allow notifications from a service worker.
  }
}

// Quiet hours (US-7.4): "22:00"–"07:00" wraps past midnight.
export function inQuietHours(quiet, date = new Date()) {
  if (!quiet?.enabled) return false;
  const minutes = date.getHours() * 60 + date.getMinutes();
  const toMinutes = (text) => {
    const [h, m] = String(text).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}
