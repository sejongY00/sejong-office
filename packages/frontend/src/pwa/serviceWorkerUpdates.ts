import { ref } from 'vue';

/** True when a newer release is installed and waits for the user to reload into it. */
export const updateReady = ref(false);

let apply: () => void = () => {};

/** "새로고침": switch to the waiting release, then reload once it has taken over. */
export function applyUpdate(): void {
  apply();
}

type Container = Pick<ServiceWorkerContainer, 'controller' | 'register' | 'addEventListener'>;

/**
 * Registers /sw.js and watches for the next release. The new worker waits (it doesn't take over
 * on its own), so a page with unsaved edits is never reloaded behind the user's back; the reload
 * itself still goes through the editors' unsaved-changes prompt.
 */
export async function registerServiceWorker(
  container: Container,
  reload: () => void = () => window.location.reload(),
): Promise<ServiceWorkerRegistration> {
  // No controller yet = first visit: the worker claiming this page isn't an update.
  let hadController = Boolean(container.controller);
  let requested = false;
  let waiting: ServiceWorker | null = null;

  container.addEventListener('controllerchange', () => {
    if (requested) {
      reload();
      return;
    }
    if (!hadController) {
      hadController = true;
      return;
    }
    // Another tab switched to the new release; this one still runs the old code.
    waiting = null;
    updateReady.value = true;
  });

  apply = () => {
    if (waiting) {
      requested = true;
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      reload();
    }
  };

  function offer(worker: ServiceWorker) {
    if (!container.controller) return;
    waiting = worker;
    updateReady.value = true;
  }

  const registration = await container.register('/sw.js');
  if (registration.waiting) offer(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') offer(worker);
    });
  });

  // The browser only re-checks sw.js on full page loads; this app rarely has those, so also check
  // when the user comes back to the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration.update().catch(() => {});
  });

  return registration;
}
