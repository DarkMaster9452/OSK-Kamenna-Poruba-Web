(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  CSS                                                                 */
    /* ------------------------------------------------------------------ */
    var CSS = [
        '/* Standardized Compact Footer */',
        'footer#site-footer {',
        '    background: #003399;',
        '    color: white;',
        '    padding: 40px 20px 30px;',
        '    margin-top: 50px;',
        '    border-top: 5px solid #ffd700;',
        '    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;',
        '}',
        'footer#site-footer *, footer#site-footer *::before, footer#site-footer *::after { box-sizing: border-box; }',
        'footer#site-footer .footer-content {',
        '    max-width: 1200px;',
        '    margin: 0 auto;',
        '    display: flex;',
        '    justify-content: space-between;',
        '    align-items: flex-start;',
        '    flex-wrap: wrap;',
        '    gap: 30px;',
        '}',
        'footer#site-footer .footer-section {',
        '    flex: 1;',
        '    min-width: 250px;',
        '}',
        'footer#site-footer .footer-section h3 {',
        '    color: #ffd700;',
        '    margin-bottom: 20px;',
        '    font-size: 18px;',
        '    font-weight: 800;',
        '    text-transform: uppercase;',
        '    display: flex !important;',
        '    align-items: center;',
        '    gap: 10px;',
        '    border: none;',
        '    padding: 0;',
        '    background: transparent;',
        '}',
        'footer#site-footer .footer-section ul {',
        '    list-style: none;',
        '    padding: 0;',
        '    margin: 0;',
        '}',
        'footer#site-footer .footer-section ul li {',
        '    margin-bottom: 10px;',
        '    display: block;',
        '}',
        'footer#site-footer .footer-section ul li a {',
        '    color: rgba(255, 255, 255, 0.8);',
        '    text-decoration: none;',
        '    font-size: 14px;',
        '    transition: all 0.2s;',
        '    display: inline-block;',
        '}',
        'footer#site-footer .footer-section ul li a:hover {',
        '    color: #ffd700;',
        '    transform: translateX(5px);',
        '}',
        'footer#site-footer .social-icons {',
        '    display: flex;',
        '    gap: 12px;',
        '    margin-top: 15px;',
        '}',
        'footer#site-footer .social-icons a {',
        '    width: 38px;',
        '    height: 38px;',
        '    background: rgba(255, 255, 255, 0.1);',
        '    color: white;',
        '    border-radius: 50%;',
        '    display: flex;',
        '    align-items: center;',
        '    justify-content: center;',
        '    font-size: 18px;',
        '    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);',
        '    border: 1px solid rgba(255, 255, 255, 0.1);',
        '    text-decoration: none;',
        '}',
        'footer#site-footer .social-icons a:hover {',
        '    background: #ffd700;',
        '    color: #003399;',
        '    transform: translateY(-5px);',
        '    border-color: #ffd700;',
        '}',
        'footer#site-footer .footer-bottom {',
        '    max-width: 1200px;',
        '    margin: 40px auto 0;',
        '    padding-top: 20px;',
        '    border-top: 1px solid rgba(255, 255, 255, 0.1);',
        '    text-align: center;',
        '    font-size: 13px;',
        '    color: rgba(255, 255, 255, 0.5);',
        '}',
        '@media (max-width: 768px) {',
        '    footer#site-footer {',
        '        padding: 40px 15px 25px;',
        '    }',
        '    footer#site-footer .footer-content {',
        '        flex-direction: column;',
        '        align-items: center;',
        '        text-align: center;',
        '        gap: 40px;',
        '    }',
        '    footer#site-footer .footer-section {',
        '        width: 100%;',
        '    }',
        '    footer#site-footer .footer-section h3 {',
        '        justify-content: center;',
        '    }',
        '    footer#site-footer .social-icons {',
        '        justify-content: center;',
        '    }',
        '    footer#site-footer .footer-section ul li a:hover {',
        '        transform: none;',
        '    }',
        '}',
        '#scrollTopBtn {',
        '    display: none;',
        '    position: fixed;',
        '    bottom: 24px;',
        '    right: 20px;',
        '    z-index: 9999;',
        '    width: 48px;',
        '    height: 48px;',
        '    border-radius: 50%;',
        '    background: #003399;',
        '    color: #fff;',
        '    border: 2px solid #ffd700;',
        '    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);',
        '    font-size: 18px;',
        '    cursor: pointer;',
        '    align-items: center;',
        '    justify-content: center;',
        '    outline: none;',
        '    transition: all 0.3s ease;',
        '}',
        '#scrollTopBtn:hover {',
        '    background: #1a4db8;',
        '    transform: scale(1.1);',
        '}'
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /*  HTML                                                                */
    /* ------------------------------------------------------------------ */
    function buildFooter() {
        var currentYear = new Date().getFullYear();
        return [
            '<footer id="site-footer">',
            '    <div class="footer-content">',
            '        <div class="footer-section">',
            '            <h3><i class="fas fa-futbol"></i> OŠK Kamenná Poruba</h3>',
            '            <p style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.7); margin-top: 10px;">',
            '                Oficiálna stránka futbalového klubu OŠK Kamenná Poruba. Sledujte naše výsledky, zápasy a aktuálne novinky z klubu.',
            '            </p>',
            '            <div class="social-icons">',
            '                <a href="https://www.facebook.com/profile.php?id=100057416346765" target="_blank" title="Facebook"><i class="fab fa-facebook-f"></i></a>',
            '                <a href="https://www.instagram.com/oskkamennaporuba/" target="_blank" title="Instagram"><i class="fab fa-instagram"></i></a>',
            '                <a href="https://sportnet.sme.sk/futbalnet/k/osk-kamenna-poruba/" target="_blank" title="Futbalnet"><i class="fas fa-globe"></i></a>',
            '            </div>',
            '        </div>',
            '',
            '        <div class="footer-section">',
            '            <h3><i class="fas fa-link"></i> Rýchle odkazy</h3>',
            '            <ul>',
            '                <li><a href="/index.html"><i class="fas fa-chevron-right" style="font-size: 10px; margin-right: 8px;"></i> Domov</a></li>',
            '                <li><a href="/pages/matches.html"><i class="fas fa-chevron-right" style="font-size: 10px; margin-right: 8px;"></i> Zápasy</a></li>',
            '                <li><a href="/pages/tabulka.html"><i class="fas fa-chevron-right" style="font-size: 10px; margin-right: 8px;"></i> Tabuľka</a></li>',
            '                <li><a href="/pages/skupiny.html"><i class="fas fa-chevron-right" style="font-size: 10px; margin-right: 8px;"></i> Tímy</a></li>',
            '                <li><a href="/pages/galeria.html"><i class="fas fa-chevron-right" style="font-size: 10px; margin-right: 8px;"></i> Galéria</a></li>',
            '            </ul>',
            '        </div>',
            '',
            '        <div class="footer-section">',
            '            <h3><i class="fas fa-map-marker-alt"></i> Kontakt</h3>',
            '            <ul style="color: rgba(255,255,255,0.8); font-size: 14px;">',
            '                <li style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; justify-content: inherit;">',
            '                    <i class="fas fa-envelope" style="color: #ffd700;"></i>',
            '                    osk.kamenna.poruba@gmail.com',
            '                </li>',
            '                <li style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; justify-content: inherit;">',
            '                    <i class="fas fa-location-dot" style="color: #ffd700;"></i>',
            '                    Futbalový areál, Kamenná Poruba',
            '                </li>',
            '                <li style="display: flex; align-items: center; gap: 10px; justify-content: inherit;">',
            '                    <i class="fas fa-info-circle" style="color: #ffd700;"></i>',
            '                    IČO: 00647845',
            '                </li>',
            '            </ul>',
            '        </div>',
            '    </div>',
            '',
            '    <div class="footer-bottom">',
            '        &copy; ' + currentYear + ' OŠK Kamenná Poruba. Všetky práva vyhradené. Stránku vytvoril DarkMaster.',
            '    </div>',
            '</footer>',
            '<button id="scrollTopBtn" onclick="window.scrollTo({top:0,behavior:\'smooth\'})" aria-label="Späť hore" title="Späť hore">',
            '    <i class="fas fa-chevron-up"></i>',
            '</button>'
        ].join('\n');
    }

    /* ------------------------------------------------------------------ */
    /*  Injection                                                           */
    /* ------------------------------------------------------------------ */
    function injectCSS() {
        var style = document.createElement('style');
        style.id = 'osk-footer-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function injectFooter() {
        var root = document.getElementById('site-footer-root');
        if (!root) return;
        root.outerHTML = buildFooter();
    }

    /* ------------------------------------------------------------------ */
    /*  Init                                                                */
    /* ------------------------------------------------------------------ */
    injectCSS();

    function init() {
        injectFooter();
        // Initialize Scroll to Top button logic
        (function() {
            const btn = document.getElementById('scrollTopBtn');
            if (!btn) return;
            window.addEventListener('scroll', function() {
                // Show only on mobile/narrow viewports when scrolled down
                if (window.innerWidth <= 768 && window.scrollY > 220) {
                    btn.style.display = 'flex';
                } else {
                    btn.style.display = 'none';
                }
            }, { passive: true });
        })();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
