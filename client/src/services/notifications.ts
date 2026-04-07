class NotificationService {
  hasPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  notify(
    title: string,
    body: string,
    options?: { icon?: string; tag?: string; onClick?: () => void },
  ): void {
    if (!this.hasPermission()) return;
    if (document.visibilityState === 'visible') return;

    const n = new Notification(title, {
      body,
      icon: options?.icon ?? '/logo.png',
      tag: options?.tag,
    });

    if (options?.onClick) {
      n.onclick = () => {
        window.focus();
        options.onClick!();
        n.close();
      };
    }
  }
}

export const notificationService = new NotificationService();
