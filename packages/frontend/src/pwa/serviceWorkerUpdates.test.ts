import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyUpdate, registerServiceWorker, updateReady } from './serviceWorkerUpdates';

/** Fake worker / registration / container: just enough of the real event flow. */
class FakeWorker extends EventTarget {
  state: ServiceWorkerState = 'installing';
  postMessage = vi.fn();
  become(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

class FakeRegistration extends EventTarget {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  update = vi.fn(() => Promise.resolve());
  startInstall() {
    this.installing = new FakeWorker();
    this.dispatchEvent(new Event('updatefound'));
    return this.installing;
  }
}

class FakeContainer extends EventTarget {
  controller: object | null;
  registration = new FakeRegistration();
  register = vi.fn(() => Promise.resolve(this.registration));
  constructor(controlled: boolean) {
    super();
    this.controller = controlled ? {} : null;
  }
  takeOver() {
    this.controller = {};
    this.dispatchEvent(new Event('controllerchange'));
  }
}

async function setup(controlled: boolean) {
  const container = new FakeContainer(controlled);
  const reload = vi.fn();
  await registerServiceWorker(container as unknown as ServiceWorkerContainer, reload);
  return { container, reload, registration: container.registration };
}

describe('registerServiceWorker', () => {
  beforeEach(() => {
    updateReady.value = false;
  });

  it('registers /sw.js', async () => {
    const { container } = await setup(false);
    expect(container.register).toHaveBeenCalledWith('/sw.js');
  });

  it('does not offer an update on the very first install', async () => {
    const { container, registration, reload } = await setup(false);
    registration.startInstall().become('installed');
    container.takeOver();
    expect(updateReady.value).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers a newer release once it has installed', async () => {
    const { registration } = await setup(true);
    const worker = registration.startInstall();
    expect(updateReady.value).toBe(false);
    worker.become('installed');
    expect(updateReady.value).toBe(true);
  });

  it('offers a release that was already waiting when the page opened', async () => {
    const container = new FakeContainer(true);
    container.registration.waiting = new FakeWorker();
    await registerServiceWorker(container as unknown as ServiceWorkerContainer, vi.fn());
    expect(updateReady.value).toBe(true);
  });

  it('switches over and reloads only after the user asks', async () => {
    const { container, registration, reload } = await setup(true);
    const worker = registration.startInstall();
    worker.become('installed');
    expect(worker.postMessage).not.toHaveBeenCalled();

    applyUpdate();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();

    container.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('asks this tab to reload when another tab switched releases', async () => {
    const { container, reload } = await setup(true);
    container.takeOver();
    expect(reload).not.toHaveBeenCalled();
    expect(updateReady.value).toBe(true);

    applyUpdate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('checks for a new release when the tab becomes visible again', async () => {
    const { registration } = await setup(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(registration.update).toHaveBeenCalled();
  });
});
