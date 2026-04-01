const fs = require('fs');
const filePath = 'pages/galeria.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add albumInfo div
content = content.replace(
  '<div class="gallery-grid" id="galleryGrid"></div>',
  `<div id="albumInfo" style="display:none; margin-bottom: 24px; background: #fff; border-left: 6px solid #ffd700; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
            <div id="albumTitle" style="font-size: 20px; color: #003399; font-weight: 800; margin-bottom: 8px;"></div>
            <ul id="albumPoints" style="padding-left: 20px; color: #33405f; line-height: 1.6; margin: 0;"></ul>
        </div>
        <div class="gallery-grid" id="galleryGrid"></div>`
);

// 2. Replace FOLDER_LABELS with FOLDER_TEXT_CONFIG and sort logic
const folderLabelsRegex = /const FOLDER_LABELS = {[\s\S]*?};\s*/;
const newConfig = `const FOLDER_TEXT_CONFIG = {
            'HISTORIA': { year: 'Historické', title: 'Historické fotky klubu', points: ['Archívne zábery klubu.'] },
            '2005': { year: '2005', title: 'Fotografie z roku 2005', points: [] },
            '2006-2007': { year: '2006 – 2007', title: 'Začiatok výstavby budovy OŠK', points: ['Spustenie výstavby klubovej budovy.', 'Prvé stavebné práce a príprava základov.'] },
            '2008': { year: '2008', title: 'Stavba stien a hrubej stavby', points: ['Rozšírenie stavebných častí objektu.'] },
            '2009': { year: '2009', title: 'Stavba strechy', points: ['Príprava objektu na vnútorné práce.'] },
            '2010': { year: '2010', title: 'Dokončovanie budovy OŠK Kamenná Poruba', points: ['Dokončovanie budovy a posledných detailov.', 'Vznik stabilného klubového zázemia.'] },
            '2011': { year: '2011', title: 'Fotografie z roku 2011', points: [] },
            '2012': { year: '2012', title: 'Fotografie z roku 2012', points: [] },
            '2013': { year: '2013', title: 'Fotografie z roku 2013', points: [] },
            '2014': { year: '2014', title: 'Fotografie z roku 2014', points: [] },
            '2015': { year: '2015', title: 'Fotografie z roku 2015', points: [] },
            '2016': { year: '2016', title: 'Fotografie z roku 2016', points: [] },
            '2017': { year: '2017', title: 'Fotografie z roku 2017', points: [] },
            '2018': { year: '2018', title: 'Fotografie z roku 2018', points: [] },
            '2023': { year: '2023', title: 'Fotografie z roku 2023', points: [] },
            '2023 pristresok': { year: '2023', title: 'Prístrešok a sedenie pre fanúšikov', points: ['V roku 2023 sme vybudovali sedenie pre fanúšikov pri prístrešku a pri šatniach.'] },
            '2023 Sieť': { year: '2023', title: 'Ochranná sieť za bránou', points: ['V roku 2023 sme vybudovali ochrannú sieť za bránou.'] },
            '2023 Siet': { year: '2023', title: 'Ochranná sieť za bránou', points: ['V roku 2023 sme vybudovali ochrannú sieť za bránou.'] },
            '24 striedačky': { year: '2023/2024', title: 'Striedačky', points: ['Nové striedačky pre tímy.'] },
            '2024 tribuny': { year: '2024', title: 'Rekonštrukcia tribún', points: ['Úpravy a obnova tribún v športovom areáli.'] }
        };
`;
content = content.replace(folderLabelsRegex, newConfig);

// 3. Update loadCloudinaryAlbums
content = content.replace(
    /const label = FOLDER_LABELS\[folder\.folder\] \|\| folder\.folder;/,
    "const conf = FOLDER_TEXT_CONFIG[folder.folder] || {}; const label = conf.year || folder.folder;"
);
content = content.replace(
    /cloudinaryAlbumMeta\.push\(\{ key, label \}\);/g,
    "cloudinaryAlbumMeta.push({ key, label, folderRaw: folder.folder, conf });"
);

// Add sorting to loadCloudinaryAlbums at the end
content = content.replace(
    /CLOUDINARY_ALBUMS\[key\] = items;\s*cloudinaryAlbumMeta\.push\(\{ key, label, folderRaw: folder\.folder, conf \}\);\s*\}/g,
    `CLOUDINARY_ALBUMS[key] = items;
                        cloudinaryAlbumMeta.push({ key, label, folderRaw: folder.folder, conf });
                    }
                });

                const yearOrder = { 'Historické': -1 };
                cloudinaryAlbumMeta.sort((a, b) => {
                    const aYear = parseInt(a.label) || yearOrder[a.label] || 9999;
                    const bYear = parseInt(b.label) || yearOrder[b.label] || 9999;
                    return aYear - bYear;
                });`
);

// 4. Update buildAlbumTabs
content = content.replace(
    /var staticTabs = '<button class="album-tab active" data-album="all">Všetky<\/button>' \+\s*'<button class="album-tab" data-album="instagram">Instagram<\/button>';/,
    `var staticTabs = '<button class="album-tab active" data-album="instagram"><i class="fab fa-instagram"></i> Instagram</button>';`
);
content = content.replace(
    /<div class="album-tabs" id="albumTabs">[\s\S]*?<\/div>/,
    `<div class="album-tabs" id="albumTabs">\n            <button class="album-tab active" data-album="instagram"><i class="fab fa-instagram"></i> Instagram</button>\n        </div>`
);


// 5. Change default album
content = content.replace(/let currentAlbum = 'all';/, "let currentAlbum = 'instagram';");

// 6. Update renderGallery to show/hide albumInfo
const renderGalleryRegex = /function renderGallery\(\) \{[\s\S]*?renderNextBatch\(\);\s*\}/;
const oldRenderGallery = content.match(renderGalleryRegex)[0];
let newRenderGallery = oldRenderGallery.replace(
    /if \(currentAlbum === 'all'\) \{[\s\S]*?\} else if \(currentAlbum === 'instagram'\)/,
    "if (currentAlbum === 'instagram')"
);
newRenderGallery = newRenderGallery.replace(
    /grid\.innerHTML = '';/,
    `grid.innerHTML = '';
            var infoEl = document.getElementById('albumInfo');
            var titleEl = document.getElementById('albumTitle');
            var pointsEl = document.getElementById('albumPoints');
            infoEl.style.display = 'none';
            titleEl.innerHTML = '';
            pointsEl.innerHTML = '';`
);
// Inside the else block where currentAlbum is Cloudinary folders
newRenderGallery = newRenderGallery.replace(
    /\} else \{\s*itemsToShow = \(CLOUDINARY_ALBUMS\[currentAlbum\] \|\| \[\]\)\.map\(function \(item\) \{\s*return makeCloudinaryItem\(item, currentAlbum\);\s*\}\);/,
    `} else {
                itemsToShow = (CLOUDINARY_ALBUMS[currentAlbum] || []).map(function (item) {
                    return makeCloudinaryItem(item, currentAlbum);
                });
                
                var meta = cloudinaryAlbumMeta.find(m => m.key === currentAlbum);
                if (meta && meta.conf && (meta.conf.title || meta.conf.points.length)) {
                    infoEl.style.display = 'block';
                    titleEl.textContent = meta.conf.title || meta.label;
                    pointsEl.innerHTML = (meta.conf.points || []).map(p => '<li>' + p + '</li>').join('');
                }`
);
content = content.replace(renderGalleryRegex, newRenderGallery);

fs.writeFileSync(filePath, content);
console.log('Galeria updated successfully.');
