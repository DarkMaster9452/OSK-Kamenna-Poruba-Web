import os
import re

def fix_footer(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (not found)")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Strategy: Find the LAST occurrence of <!-- Footer --> or <footer>
    # and replace everything from there until the end of the file.
    # Also handle the scrollTopBtn if it's there.
    
    content = "".join(lines)
    
    # Common footer/end patterns
    patterns = [
        r'<!-- Footer -->.*',
        r'<footer.*',
        r'<!-- Scroll to top.*'
    ]
    
    found_idx = -1
    for i in range(len(lines) - 1, -1, -1):
        if "<!-- Footer -->" in lines[i] or "<footer" in lines[i] or "<!-- Scroll to top" in lines[i]:
            found_idx = i
            break
            
    if found_idx == -1:
        # If no footer comment/tag found, just append to body
        print(f"No footer marker found in {filepath}, appending before </body>")
        if "</body>" in content:
            new_content = content.replace("</body>", '<div id="site-footer-root"></div>\n    <script src="/assets/js/footer.js"></script>\n</body>')
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
        return

    # Keep everything before the footer marker
    header_part = "".join(lines[:found_idx])
    
    # Clean up the end of header_part (remove trailing whitespace/newlines)
    header_part = header_part.rstrip()
    
    new_footer = """
    <!-- Scroll to top (mobile) -->
    <button id="scrollTopBtn" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Späť hore"
        title="Späť hore"
        style="display:none;position:fixed;bottom:24px;right:20px;z-index:9999;width:48px;height:48px;border-radius:50%;background:#003399;color:#fff;border:2px solid #ffd700;box-shadow:0 4px 14px rgba(0,0,0,0.25);font-size:18px;cursor:pointer;align-items:center;justify-content:center;">
        <i class="fas fa-chevron-up"></i>
    </button>
    <script>
        (function () {
            var btn = document.getElementById('scrollTopBtn');
            window.addEventListener('scroll', function () {
                if (btn) {
                    btn.style.display = (window.innerWidth <= 768 && window.scrollY > 220) ? 'flex' : 'none';
                }
            }, { passive: true });
        })();
    </script>

    <div id="site-footer-root"></div>
    <script src="/assets/js/footer.js"></script>
</body>
</html>
"""
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(header_part + "\n" + new_footer)
    print(f"Fixed {filepath}")

# List of files to process
pages = [
    'index.html',
    'pages/akademia.html',
    'pages/atim.html',
    'pages/galeria.html',
    'pages/matches.html',
    'pages/skupiny.html',
    'pages/tabulka.html',
    'pages/vedenie.html',
    'pages/important_info.html',
    'pages/player_detail_coach.html',
    'pages/results.html' # check if exists
]

for p in pages:
    fullpath = os.path.join(os.getcwd(), p.replace('/', os.sep))
    fix_footer(fullpath)
