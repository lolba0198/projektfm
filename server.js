const express = require("express")
const app = express()
const PORT = 3000;
const path = require("path");
const { create } = require('express-handlebars');
const formidable = require('formidable');
const fs = require("fs");
const AdmZip = require("adm-zip"); // Biblioteka do ZIP

const baseDir = path.join(__dirname, "files")
if (fs.existsSync(baseDir) == false) {
    fs.mkdirSync(baseDir);
}

app.use(express.static('static'))
app.engine('.hbs', create({ defaultLayout: 'main.hbs', extname: '.hbs' }).engine);
app.set('view engine', '.hbs');

// --- STRONA GŁÓWNA (Pkt 4 i 5) ---
app.get("/", function (req, res) {
    let currentPath = req.query.path || "";
    currentPath = currentPath.replace(/\\/g, "/");
    let fullPath = path.join(baseDir, currentPath);

    // Budowanie paska nawigacji (Pkt 5)
    let navButtons = [];
    navButtons.push({ name: "HOME", url: "" });
    let parts = currentPath.split("/").filter(function (p) { return p !== "" });
    let tempPath = "";
    parts.forEach(function (p) {
        if (tempPath === "") { tempPath = p; }
        else { tempPath = tempPath + "/" + p; }
        navButtons.push({ name: p.toUpperCase(), url: tempPath });
    });

    fs.readdir(fullPath, function (err, files) {
        let foldersArray = [];
        let filesArray = [];
        if (files) {
            files.forEach(function (name) {
                let stats = fs.lstatSync(path.join(fullPath, name))
                if (stats.isDirectory()) {
                    let target = "";
                    if (currentPath === "") { target = name; }
                    else { target = currentPath + "/" + name; }
                    foldersArray.push({ name: name, currentRoot: currentPath, targetPath: target })
                } else {
                    let ext = path.extname(name).replace(".", "").toUpperCase();
                    if (ext === "") { ext = "FILE"; }
                    filesArray.push({ name: name, ext: ext, currentRoot: currentPath })
                }
            })
        }
        res.render('filemanager.hbs', {
            folders: foldersArray, files: filesArray,
            currentPath: currentPath, navButtons: navButtons
        });
    });
})

// --- TWORZENIE (Pkt 2 i 3) ---
app.get("/handleForm", function (req, res) {
    let root = req.query.root || "";
    let name = req.query.foldername || req.query.filename;
    if (!name) { return res.redirect("/?path=" + root); }
    let p = path.join(baseDir, root, name);
    if (req.query.foldername) {
        if (fs.existsSync(p) == false) { fs.mkdirSync(p); }
    } else {
        if (fs.existsSync(p) == false) { fs.writeFileSync(p, ""); }
    }
    res.redirect("/?path=" + root);
})

// --- ZMIANA NAZWY (Pkt 6) ---
app.get("/rename", function (req, res) {
    let root = req.query.root || "";
    let oldName = req.query.oldName;
    let newName = req.query.newName;
    let oldPath = path.join(baseDir, root, oldName);
    let newPath = path.join(baseDir, root, newName);

    if (fs.existsSync(newPath) == false) {
        fs.renameSync(oldPath, newPath);
    }
    res.redirect("/?path=" + root);
})

// --- USUWANIE REKURENCYJNE (Pkt 8) ---
app.get("/remove", function (req, res) {
    let root = req.query.root || "";
    let name = req.query.name;
    let p = path.join(baseDir, root, name);
    fs.rmSync(p, { recursive: true, force: true });
    res.redirect("/?path=" + root);
})

// --- DOWNLOAD PLIKU (Pkt 9) ---
app.get("/download", function (req, res) {
    let root = req.query.root || "";
    let name = req.query.name;
    res.download(path.join(baseDir, root, name));
})

// --- ZIP KATALOGU (Pkt 10) ---
app.get("/zip", function (req, res) {
    let root = req.query.root || "";
    let name = req.query.name;
    let folderPath = path.join(baseDir, root, name);

    const zip = new AdmZip();
    zip.addLocalFolder(folderPath);
    const zipName = name + ".zip";
    const buffer = zip.toBuffer();

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename=${zipName}`);
    res.send(buffer);
})

// --- UPLOAD (Pkt 7) ---
app.post("/handleUpload", function (req, res) {
    const form = new formidable.IncomingForm();
    form.multiples = true;
    form.uploadDir = baseDir;
    form.parse(req, function (err, fields, files) {
        let root = fields.root || "";
        let uploadFolder = path.join(baseDir, root);
        let lista = Array.isArray(files.upload) ? files.upload : [files.upload];
        lista.forEach(function (f) {
            if (f && f.originalFilename) {
                let cel = path.join(uploadFolder, f.originalFilename);
                fs.renameSync(f.filepath, cel);
            }
        });
        res.redirect("/?path=" + root);
    });
})

// --- GLOBALNA OBSŁUGA BŁĘDÓW (Pkt 11) ---
app.get("*path", function (req, res) {
    res.send("404 - Nie znaleziono adresu: " + req.params.path);
});

app.listen(PORT, function () { console.log("Start: http://localhost:3000"); });
