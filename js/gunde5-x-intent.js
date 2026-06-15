/* gunde5 — X (Twitter) paylaşım: web intent + mobil yedekler */
(function (global) {
    'use strict';

    function intentUrl(opts) {
        opts = opts || {};
        var parcalar = [];
        if (opts.text) parcalar.push('text=' + encodeURIComponent(String(opts.text)));
        if (opts.url) parcalar.push('url=' + encodeURIComponent(String(opts.url)));
        return 'https://x.com/intent/post' + (parcalar.length ? '?' + parcalar.join('&') : '');
    }

    function mobilMi() {
        return /Android|iPhone|iPad|iPod/i.test(global.navigator && global.navigator.userAgent ? global.navigator.userAgent : '');
    }

    function intentAc(opts) {
        var u = intentUrl(opts);
        if (mobilMi()) {
            global.location.href = u;
        } else {
            global.open(u, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * @param {{ text?: string, url?: string, fullText?: string }} opts
     * @param {(msg: string) => void} [toast]
     */
    function ac(opts, toast) {
        opts = opts || {};
        var fullText = opts.fullText || opts.text || '';
        var paylas = global.navigator && global.navigator.share;

        if (mobilMi() && paylas) {
            return paylas({
                text: fullText,
                url: opts.url || undefined
            }).catch(function (err) {
                if (err && err.name === 'AbortError') return;
                return panoVeIntent(opts, fullText, toast);
            });
        }

        if (mobilMi()) {
            return panoVeIntent(opts, fullText, toast);
        }

        intentAc(opts);
        return Promise.resolve();
    }

    function panoVeIntent(opts, fullText, toast) {
        var clip = global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText;
        if (!clip || !fullText) {
            intentAc(opts);
            return Promise.resolve();
        }
        return clip(fullText)
            .then(function () {
                if (toast) toast('Metin kopyalandı — X açılıyor');
                intentAc(opts);
            })
            .catch(function () {
                intentAc(opts);
            });
    }

    global.Gunde5XIntent = {
        intentUrl: intentUrl,
        ac: ac
    };
})(window);
