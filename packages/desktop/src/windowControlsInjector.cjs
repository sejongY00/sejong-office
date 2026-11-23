/**
 * Script injected into embedded office iframes (OnlyOffice & RHWP Studio) when running inside
 * the frameless Electron desktop app.
 * 1. Replaces their top-right close button with native-matching icon buttons: [홈] [최소화] [최대화] [닫기]
 * 2. Enables smooth window dragging when dragging empty areas of the top header bar.
 */
function buildIframeWindowControlsScript() {
  return `(() => {
    if (window.__sejongDesktopControlsInstalled) return;
    window.__sejongDesktopControlsInstalled = true;

    const CONTROL_MSG_TYPE = 'sejong-desktop:window-control';
    function sendControl(action, extra) {
      try {
        window.top?.postMessage({ type: CONTROL_MSG_TYPE, action, ...extra }, '*');
      } catch {}
    }

    const ICONS = {
      home: '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.8L8 2.2l5.5 4.6v6.2a1 1 0 0 1-1 1h-3v-4h-3v4h-3a1 1 0 0 1-1-1V6.8z"/></svg>',
      minimize: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3.5 8h9"/></svg>',
      maximize: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3.5" y="3.5" width="9" height="9" rx="1"/></svg>',
      close: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    };

    function createControlsBar(theme) {
      const wrap = document.createElement('div');
      wrap.className = 'sejong-win-controls ' + (theme || '');
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', '창 제어');

      const buttons = [
        { action: 'home', label: '홈', title: '홈으로 이동', icon: ICONS.home, cls: 'sejong-win-btn--home' },
        { action: 'minimize', label: '최소화', title: '최소화', icon: ICONS.minimize, cls: 'sejong-win-btn--min' },
        { action: 'toggle-maximize', label: '최대화', title: '최대화 / 복원', icon: ICONS.maximize, cls: 'sejong-win-btn--max' },
        { action: 'close-app', label: '닫기', title: '앱 종료', icon: ICONS.close, cls: 'sejong-win-btn--close' },
      ];

      for (const item of buttons) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sejong-win-btn ' + item.cls;
        btn.title = item.title;
        btn.setAttribute('aria-label', item.label);
        btn.innerHTML = item.icon;
        btn.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          sendControl(item.action);
        });
        wrap.appendChild(btn);
      }
      return wrap;
    }

    function isInteractiveTarget(target) {
      if (!target || typeof target.closest !== 'function') return false;
      return Boolean(
        target.closest(
          'button, a, select, textarea, .menu-item, .md-item, .menu-dropdown, .btn, .btn-slot:not(#id-box-doc-name), .sejong-win-controls, .sejong-win-btn',
        ),
      );
    }

    function installHeaderDrag(headerEl) {
      if (!headerEl || headerEl.__sejongDragInstalled) return;
      headerEl.__sejongDragInstalled = true;

      let dragging = false;

      headerEl.addEventListener(
        'mousedown',
        (e) => {
          if (e.button !== 0) return;
          if (isInteractiveTarget(e.target)) return;
          // In OnlyOffice, #title-doc-name is a readonly-looking title input spanning the middle bar.
          // Blur it on single-click drag so dragging the title bar moves the window smoothly.
          if (e.target && e.target.id === 'title-doc-name') {
            e.preventDefault();
          }
          dragging = true;
          sendControl('drag-start', { screenX: e.screenX, screenY: e.screenY });
        },
        true,
      );

      const docWin = headerEl.ownerDocument?.defaultView || window;
      const stopDrag = () => {
        if (!dragging) return;
        dragging = false;
        sendControl('drag-end');
      };

      docWin.addEventListener(
        'mousemove',
        (e) => {
          if (!dragging) return;
          if ((e.buttons & 1) === 0) {
            stopDrag();
          }
        },
        true,
      );

      docWin.addEventListener('mouseup', stopDrag, true);
      docWin.addEventListener('blur', stopDrag);

      headerEl.addEventListener(
        'dblclick',
        (e) => {
          if (isInteractiveTarget(e.target)) return;
          e.preventDefault();
          e.stopPropagation();
          sendControl('toggle-maximize');
        },
        true,
      );
    }

    function ensureStyles(doc) {
      if (doc.getElementById('sejong-win-controls-style')) return;
      const style = doc.createElement('style');
      style.id = 'sejong-win-controls-style';
      style.textContent = [
        '#rhwp-embed-close-btn, #slot-btn-close { display: none !important; }',
        '/* Allow dragging the frameless window directly from the document title area */',
        '#box-document-title #title-doc-name:disabled,',
        '#id-box-doc-name #title-doc-name:disabled,',
        '#oo-embed-save-status,',
        '#rhwp-embed-doc-title {',
        '  pointer-events: none !important;',
        '  user-select: none !important;',
        '}',
        '#id-box-doc-name {',
        '  cursor: default;',
        '}',
        '.sejong-win-controls {',
        '  display: inline-flex;',
        '  align-items: stretch;',
        '  margin-left: auto;',
        '  flex: 0 0 auto;',
        '  z-index: 1005;',
        '  user-select: none;',
        '}',
        '/* Place RHWP toolbar collapse/expand chevron right next to the left of Home */',
        '#menu-bar > #toolbox-basic-toggle {',
        '  margin-left: auto !important;',
        '  margin-right: 2px;',
        '}',
        '#menu-bar > #toolbox-basic-toggle + .sejong-win-controls--rhwp {',
        '  margin-left: 0 !important;',
        '  padding-left: 2px;',
        '}',
        '.sejong-win-btn {',
        '  display: inline-flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  border: 0;',
        '  background: transparent;',
        '  padding: 0;',
        '  margin: 0;',
        '  cursor: pointer;',
        '  color: inherit;',
        '  transition: background-color 0.12s ease, color 0.12s ease;',
        '}',
        '.sejong-win-btn svg {',
        '  display: block;',
        '  pointer-events: none;',
        '}',
        '/* RHWP Studio menu-bar integration */',
        '.sejong-win-controls--rhwp {',
        '  align-items: center;',
        '  gap: 2px;',
        '  padding-left: 6px;',
        '}',
        '.sejong-win-controls--rhwp .sejong-win-btn {',
        '  width: 28px;',
        '  height: 24px;',
        '  border-radius: var(--radius-sm, 3px);',
        '  color: var(--color-text, #222);',
        '  opacity: 0.82;',
        '}',
        '.sejong-win-controls--rhwp .sejong-win-btn:hover {',
        '  opacity: 1;',
        '  background-color: var(--ui-accent-bg, rgba(0, 0, 0, 0.07));',
        '}',
        '/* OnlyOffice header integration (matches native .btn.btn-header) */',
        '.sejong-win-controls--oo {',
        '  height: 100%;',
        '  align-items: stretch;',
        '}',
        '.sejong-win-controls--oo .sejong-win-btn {',
        '  width: 36px;',
        '  height: 100%;',
        '  min-height: 28px;',
        '  color: var(--icon-toolbar-header, var(--text-toolbar-header, #fff));',
        '  opacity: 0.9;',
        '}',
        '.sejong-win-controls--oo .sejong-win-btn:hover {',
        '  opacity: 1;',
        '  background-color: var(--highlight-header-button-hover, rgba(0, 0, 0, 0.15));',
        '}',
        '.sejong-win-btn--close:hover {',
        '  background-color: #e81123 !important;',
        '  color: #ffffff !important;',
        '  opacity: 1 !important;',
        '}',
      ].join('\\n');
      (doc.head || doc.documentElement)?.appendChild(style);
    }

    function ensureKoreanFontAliasesCss(doc) {
      if (doc.getElementById('sejong-kr-font-aliases-style')) return;
      const style = doc.createElement('style');
      style.id = 'sejong-kr-font-aliases-style';
      const base = location.pathname.startsWith('/rhwp') ? '/rhwp/fonts' : '/fonts';
      const groups = [
        {
          reg: base + '/NanumGothic-Regular.ttf',
          bold: base + '/NanumGothic-Bold.ttf',
          names: ['나눔고딕', 'NanumGothic', 'Nanum Gothic', '맑은 고딕', 'Malgun Gothic', '굴림', '굴림체', 'Gulim', 'GulimChe', '새굴림'],
        },
        {
          reg: base + '/NanumBarunGothic-Regular.ttf',
          bold: base + '/NanumBarunGothic-Bold.ttf',
          names: ['나눔바른고딕', 'NanumBarunGothic', 'Nanum Barun Gothic', '돋움', '돋움체', 'Dotum', 'DotumChe', '함초롬돋움', 'HCR Dotum', '한컴돋움'],
        },
        {
          reg: base + '/NanumSquare-Regular.ttf',
          bold: base + '/NanumSquare-Bold.ttf',
          names: ['나눔스퀘어', 'NanumSquare', 'Nanum Square', 'NanumSquare Bold', '나눔스퀘어 Bold'],
        },
        {
          reg: base + '/NanumMyeongjo-Regular.ttf',
          bold: base + '/NanumMyeongjo-Regular.ttf',
          names: ['나눔명조', 'NanumMyeongjo', 'Nanum Myeongjo', '바탕', '바탕체', 'Batang', 'BatangChe', '함초롬바탕', 'HCR Batang', '한컴바탕', '신명조', '휴먼명조', 'HY신명조', '궁서', '궁서체', 'Gungsuh', 'GungsuhChe'],
        },
      ];
      const rules = [];
      for (const g of groups) {
        for (const n of g.names) {
          rules.push(
            '@font-face { font-family: "' + n + '"; src: local("' + n + '"), url("' + g.reg + '") format("truetype"); font-weight: 400; font-style: normal; font-display: swap; }',
            '@font-face { font-family: "' + n + '"; src: local("' + n + ' Bold"), local("' + n + '"), url("' + g.bold + '") format("truetype"); font-weight: 700; font-style: normal; font-display: swap; }',
          );
        }
      }
      style.textContent = rules.join('\\n');
      (doc.head || doc.documentElement)?.appendChild(style);
    }

    function tryMount(doc) {
      if (!doc || !doc.body) return;
      ensureStyles(doc);
      ensureKoreanFontAliasesCss(doc);

      // 1. RHWP Studio (#menu-bar)
      const rhwpMenuBar = doc.getElementById('menu-bar');
      if (rhwpMenuBar) {
        installHeaderDrag(rhwpMenuBar);
        let bar = doc.getElementById('sejong-rhwp-win-controls');
        if (!bar) {
          bar = createControlsBar('sejong-win-controls--rhwp');
          bar.id = 'sejong-rhwp-win-controls';
          rhwpMenuBar.appendChild(bar);
        }
        const toggleBtn = doc.getElementById('toolbox-basic-toggle');
        if (toggleBtn && toggleBtn.parentElement === rhwpMenuBar && toggleBtn.nextElementSibling !== bar) {
          rhwpMenuBar.insertBefore(toggleBtn, bar);
        }
      }

      // 2. OnlyOffice header (#box-document-title)
      const ooTitleBar = doc.getElementById('box-document-title');
      if (ooTitleBar) {
        installHeaderDrag(ooTitleBar);
      }
      const ooCloseSlot = doc.getElementById('slot-btn-close');
      const ooHeaderRight = ooCloseSlot?.parentElement || doc.querySelector('#box-document-title .hedset');
      if (ooHeaderRight && !doc.getElementById('sejong-oo-win-controls')) {
        const bar = createControlsBar('sejong-win-controls--oo');
        bar.id = 'sejong-oo-win-controls';
        ooHeaderRight.appendChild(bar);
      }
    }

    function scanAllDocuments() {
      tryMount(document);
      for (let i = 0; i < window.frames.length; i += 1) {
        try {
          const subDoc = window.frames[i].document;
          if (subDoc) tryMount(subDoc);
        } catch {}
      }
    }

    scanAllDocuments();
    const timer = setInterval(scanAllDocuments, 300);
    setTimeout(() => clearInterval(timer), 60000);
    const obs = new MutationObserver(scanAllDocuments);
    if (document.documentElement) {
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  })();`;
}

module.exports = {
  buildIframeWindowControlsScript,
};
