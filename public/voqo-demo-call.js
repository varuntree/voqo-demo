/* eslint-disable no-var */
/* global window, document, navigator, fetch */

(function () {
  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function getVoiceAgentSettings() {
    try {
      var raw = window.localStorage.getItem('voqo:voiceAgentSettings');
      return raw ? safeJsonParse(raw) : null;
    } catch {
      return null;
    }
  }

  function getSlugFromPath() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    var demoIndex = parts.indexOf('demo');
    if (demoIndex === -1 || demoIndex + 1 >= parts.length) return null;
    var slug = parts[demoIndex + 1];
    return slug.endsWith('.html') ? slug.slice(0, -5) : slug;
  }

  function getConfig() {
    var slug = getSlugFromPath();
    var agency = window.__VOQO_AGENCY__ || null;
    var demoPhone = window.__VOQO_DEMO_PHONE__ || null;
    return { slug: slug, agency: agency, demoPhone: demoPhone };
  }

  function ensureStyles() {
    if (document.getElementById('voqo-call-style')) return;
    var style = document.createElement('style');
    style.id = 'voqo-call-style';
    style.textContent = [
      '.voqo-callbar{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483647;background:rgba(2,6,23,.78);backdrop-filter:blur(12px);border:1px solid rgba(148,163,184,.25);border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.45);padding:14px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}',
      '.voqo-callbar *{box-sizing:border-box}',
      '.voqo-callmeta{min-width:0}',
      '.voqo-calltitle{font-size:13px;letter-spacing:.02em;color:rgba(226,232,240,.9);font-weight:650;margin:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.voqo-callsub{font-size:12px;color:rgba(148,163,184,.9);margin:2px 0 0;line-height:1.2}',
      '.voqo-callactions{display:flex;gap:10px;align-items:center;flex-shrink:0}',
      '.voqo-callbtn{appearance:none;border:1px solid rgba(99,102,241,.45);background:linear-gradient(135deg, rgba(59,130,246,.9), rgba(99,102,241,.85));color:white;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:650;cursor:pointer;line-height:1;box-shadow:0 10px 20px rgba(37,99,235,.25)}',
      '.voqo-callbtn:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}',
      '.voqo-copybtn{appearance:none;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.4);color:rgba(226,232,240,.92);border-radius:12px;padding:10px 12px;font-size:13px;font-weight:650;cursor:pointer;line-height:1}',
      '.voqo-pill{display:inline-flex;align-items:center;gap:8px;font-size:11px;color:rgba(148,163,184,.95);padding:4px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.2);background:rgba(2,6,23,.35);margin-top:8px}',
      '.voqo-dot{width:6px;height:6px;border-radius:999px;background:rgba(96,165,250,.9);box-shadow:0 0 0 4px rgba(96,165,250,.15)}',
      '@media (max-width:480px){.voqo-callbar{left:10px;right:10px;bottom:10px;padding:12px}.voqo-callactions{gap:8px}.voqo-copybtn{display:none}}',
    ].join('');
    document.head.appendChild(style);
  }

  function buildCallBar(config) {
    ensureStyles();
    if (document.getElementById('voqo-callbar')) return;

    var bar = document.createElement('div');
    bar.id = 'voqo-callbar';
    bar.className = 'voqo-callbar';

    var meta = document.createElement('div');
    meta.className = 'voqo-callmeta';

    var title = document.createElement('p');
    title.className = 'voqo-calltitle';
    title.textContent = config.agency?.name ? ('Call ' + config.agency.name) : 'Call the demo agent';

    var sub = document.createElement('p');
    sub.className = 'voqo-callsub';

    var displayNumber = config.demoPhone?.display || config.demoPhone?.tel || '04832945767';
    sub.textContent = 'Demo number: ' + displayNumber;

    var pill = document.createElement('div');
    pill.className = 'voqo-pill';
    var dot = document.createElement('span');
    dot.className = 'voqo-dot';
    var pillText = document.createElement('span');
    pillText.textContent = 'Context activates on tap';
    pill.appendChild(dot);
    pill.appendChild(pillText);

    meta.appendChild(title);
    meta.appendChild(sub);
    meta.appendChild(pill);

    var actions = document.createElement('div');
    actions.className = 'voqo-callactions';

    var callBtn = document.createElement('button');
    callBtn.className = 'voqo-callbtn';
    callBtn.type = 'button';
    callBtn.textContent = 'Call now';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'voqo-copybtn';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy number';

    actions.appendChild(copyBtn);
    actions.appendChild(callBtn);

    bar.appendChild(meta);
    bar.appendChild(actions);

    function normalizeTelNumber(n) {
      var raw = (n || '').toString().trim();
      if (!raw) return 'tel:+614832945767';
      // Strip spaces and parentheses/dashes; keep leading +
      var cleaned = raw.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('tel:')) return cleaned;
      return 'tel:' + cleaned;
    }

    function registerCallContext(payload) {
      var body = JSON.stringify(payload);
      var url = '/api/register-call';

      // Prefer sendBeacon to survive immediate navigation to tel:
      if (navigator.sendBeacon) {
        try {
          var blob = new Blob([body], { type: 'application/json' });
          var ok = navigator.sendBeacon(url, blob);
          if (ok) return Promise.resolve({ via: 'beacon' });
        } catch {
          // fallthrough
        }
      }

      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      })
        .then(function (res) { return res.text(); })
        .then(function (text) { return safeJsonParse(text) || { via: 'fetch' }; })
        .catch(function () { return { via: 'fetch_error' }; });
    }

    copyBtn.addEventListener('click', function () {
      var num = (config.demoPhone?.display || config.demoPhone?.tel || '04832945767').toString();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(num).catch(function () {});
      }
      copyBtn.textContent = 'Copied';
      setTimeout(function () { copyBtn.textContent = 'Copy number'; }, 1200);
    });

    callBtn.addEventListener('click', function () {
      if (callBtn.disabled) return;
      callBtn.disabled = true;
      callBtn.textContent = 'Activating...';

      var slug = config.slug;
      var agency = config.agency || {};

      var payload = {
        timestamp: Date.now(),
        agencyData: {
          id: agency.id || slug || 'unknown',
          name: agency.name || document.title || (slug || 'Agency'),
          location: agency.location || agency.address || undefined,
          address: agency.address || undefined,
          phone: agency.phone || undefined,
          website: agency.website || window.location.origin + window.location.pathname,
          demoUrl: window.location.origin + window.location.pathname,
        },
      };

      // Include voice agent settings if available
      var settings = getVoiceAgentSettings();
      if (settings) {
        payload.settings = settings;
      }

      registerCallContext(payload)
        .then(function (res) {
          var telNumber = res && res.phoneNumber ? res.phoneNumber : (config.demoPhone?.tel || config.demoPhone?.display || '+614832945767');
          callBtn.textContent = 'Calling...';
          window.location.href = normalizeTelNumber(telNumber);
        })
        .finally(function () {
          // If navigation doesn't happen (desktop), re-enable quickly.
          setTimeout(function () {
            callBtn.disabled = false;
            callBtn.textContent = 'Call now';
          }, 2000);
        });
    });

    function triggerDialFromLegacyCTA() {
      // Mirror the same behavior as the call bar button.
      callBtn.click();
    }

    // Patch in-page CTAs: any tel: links should register context before dialing.
    function attachTelInterceptors() {
      var anchors = Array.prototype.slice.call(document.querySelectorAll('a[href^=\"tel:\"]'));
      if (!anchors.length) return;

      anchors.forEach(function (a) {
        try {
          a.setAttribute('href', normalizeTelNumber(config.demoPhone?.tel || '+614832945767'));
        } catch {
          // ignore
        }

        a.addEventListener('click', function () {
          var slug = config.slug;
          var agency = config.agency || {};
          var payload = {
            timestamp: Date.now(),
            agencyData: {
              id: agency.id || agency.agencyId || slug || 'unknown',
              name: agency.name || document.title || (slug || 'Agency'),
              location: agency.location || agency.suburb || undefined,
              address: agency.address || undefined,
              phone: agency.phone || undefined,
              website: agency.website || window.location.origin + window.location.pathname,
              demoUrl: window.location.origin + window.location.pathname,
            },
          };
          // Include voice agent settings if available
          var settings = getVoiceAgentSettings();
          if (settings) {
            payload.settings = settings;
          }
          void registerCallContext(payload);
        }, { passive: true });
      });
    }

    function patchKnownDemoNumberText() {
      var display = (config.demoPhone?.display || '04832945767').toString();
      var telDisplay = display;
      var needles = [
        '1300 867 624',
        '1300867624',
        '1300 VOQO AI',
        '1300 VOQOAI',
        '1300VOQOAI',
      ];

      function replaceIfExact(el) {
        var t = (el.textContent || '').trim();
        if (!t) return;
        for (var i = 0; i < needles.length; i++) {
          if (t.includes(needles[i])) {
            el.textContent = t.replaceAll(needles[i], telDisplay);
            return;
          }
        }
      }

      // Patch common candidates without walking the entire DOM tree.
      var candidates = Array.prototype.slice
        .call(document.querySelectorAll('h1,h2,h3,p,span,div'))
        .slice(0, 250);
      candidates.forEach(replaceIfExact);
    }

    // Patch legacy in-page handlers (older generated pages).
    function attachLegacyHandlers() {
      function getAgencyId() {
        var slug = config.slug;
        var agency = config.agency || {};
        return agency.id || agency.agencyId || slug || 'unknown';
      }

      function pollStatus(agencyId, maxMs) {
        var started = Date.now();

        return new Promise(function (resolve) {
          function tick() {
            fetch('/api/call-status?agency=' + encodeURIComponent(agencyId), { cache: 'no-store' })
              .then(function (r) { return r.text(); })
              .then(function (t) { return safeJsonParse(t); })
              .then(function (data) {
                if (data && data.hasRecentCall && data.status === 'completed' && data.pageUrl) {
                  resolve({ ok: true, pageUrl: data.pageUrl, callId: data.callId });
                  return;
                }
                if (Date.now() - started > maxMs) {
                  resolve({ ok: false });
                  return;
                }
                setTimeout(tick, 1500);
              })
              .catch(function () {
                if (Date.now() - started > maxMs) {
                  resolve({ ok: false });
                  return;
                }
                setTimeout(tick, 1500);
              });
          }
          tick();
        });
      }

      // Override global function if present in generated HTML.
      window.registerDemoCall = function () {
        var agencyId = getAgencyId();
        pollStatus(agencyId, 60000).then(function (res) {
          if (res.ok && res.pageUrl) {
            window.location.href = res.pageUrl;
            return;
          }
          alert('No recent call results yet. Make a demo call, then try again.');
        });
      };

      // Some older pages use `registerForCall()` as the primary CTA. Redirect it to dialing.
      window.registerForCall = function () {
        triggerDialFromLegacyCTA();
      };

      // Also attach to buttons that look like results CTAs.
      var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
      buttons.forEach(function (btn) {
        var label = (btn.textContent || '').toLowerCase();
        var onclick = (btn.getAttribute('onclick') || '').toLowerCase();
        var isResults = onclick.includes('registerdemocall') || label.includes('show me my results') || label.includes('show results');
        var isCall =
          onclick.includes('registerforcall') ||
          label.includes('book your demo call') ||
          label.includes('book a demo call') ||
          label === 'call now';

        if (isCall) {
          btn.removeAttribute('onclick');
          btn.addEventListener('click', function () {
            triggerDialFromLegacyCTA();
          });
          return;
        }

        if (isResults) {
          btn.removeAttribute('onclick');
          btn.addEventListener('click', function () {
            if (btn.disabled) return;
            btn.disabled = true;
            var original = btn.textContent;
            btn.textContent = 'Checking...';
            window.registerDemoCall();
            setTimeout(function () {
              btn.disabled = false;
              btn.textContent = original || 'Show results';
            }, 4000);
          });
        }
      });
    }

    attachTelInterceptors();
    patchKnownDemoNumberText();
    attachLegacyHandlers();

    document.body.appendChild(bar);
  }

  function boot() {
    var config = getConfig();
    buildCallBar(config);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
