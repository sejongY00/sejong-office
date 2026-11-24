import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import LicensesView from './LicensesView.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/licenses', name: 'licenses', component: LicensesView },
    ],
  });
}

async function mountLicensesView() {
  const router = createTestRouter();
  await router.push('/licenses');
  await router.isReady();
  return mount(LicensesView, {
    global: {
      plugins: [router],
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  });
}

describe('LicensesView', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders root THIRD-PARTY-NOTICES.md with updated sejongY00/document link and no stale office-editor link', async () => {
    const wrapper = await mountLicensesView();
    const notices = wrapper.find('.notices-md');

    expect(notices.exists()).toBe(true);
    expect(notices.html()).toContain('https://github.com/sejongY00/document');
    expect(notices.html()).not.toContain('sejongY00/office-editor');
    expect(notices.html()).toContain('https://github.com/sejongY00/rhwp');
    expect(notices.html()).toContain(
      'https://github.com/sejongY00/sejong-office/blob/main/packages/desktop/src/koreanFontsPatch.cjs',
    );
  });

  it('maps ./LICENSE link to #gpl-license without target="_blank" and opens the GPL section on click', async () => {
    const wrapper = await mountLicensesView();
    const gplLink = wrapper.find('.notices-md a[href="#gpl-license"]');

    expect(gplLink.exists()).toBe(true);
    expect(gplLink.attributes('target')).toBeUndefined();

    const gplDetails = wrapper.find('#gpl-license');
    expect((gplDetails.element as HTMLDetailsElement).open).toBe(false);
    expect(gplDetails.text()).toContain('GNU GENERAL PUBLIC LICENSE');

    await gplLink.trigger('click');
    await flushPromises();

    expect((gplDetails.element as HTMLDetailsElement).open).toBe(true);
  });

  it('lazily fetches THIRD-PARTY-LICENSES.txt when opening the third-party full text section', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      text: async () => 'vue@3.5.40\nLicense: MIT\n',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = await mountLicensesView();
    const thirdPartyDetails = wrapper.find('#third-party-licenses');
    expect(fetchMock).not.toHaveBeenCalled();

    (thirdPartyDetails.element as HTMLDetailsElement).open = true;
    await thirdPartyDetails.trigger('toggle');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/THIRD-PARTY-LICENSES\.txt$/);
    expect(thirdPartyDetails.text()).toContain('vue@3.5.40');
    expect(thirdPartyDetails.text()).toContain('License: MIT');
  });
});
