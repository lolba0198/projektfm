const express = require("express")
const app = express()
const PORT = 3000;
const path = require("path");
const { create } = require('express-handlebars');
const formidable = require('formidable');
const fs = require("fs");
const AdmZip = require("adm-zip");

const baseDir = path.join(__dirname, "files")
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'))
app.engine('.hbs', create({ defaultLayout: 'main.hbs', extname: '.hbs' }).engine);
app.set('view engine', '.hbs');

// --- STRONA GŁÓWNA ---
app.get("/", function (req, res) {
    let currentPath = "";
    if (req.query.path) {
        currentPath = req.query.path.replace(/\\/g, "/");
    }

    let fullPath = path.join(baseDir, currentPath);
    if (!fs.existsSync(fullPath)) {
        res.render("error.hbs", { path: currentPath });
        return;
    }

    let navButtons = [{ name: "HOME", url: "" }];
    let parts = currentPath.split("/").filter(p => p !== "");
    let tempPath = "";
    parts.forEach(p => {
        if (tempPath === "") { tempPath = p; }
        else { tempPath = tempPath + "/" + p; }
        navButtons.push({ name: p.toUpperCase(), url: tempPath });
    });

    fs.readdir(fullPath, (err, files) => {
        let foldersArray = [];
        let filesArray = [];
        if (files) {
            files.forEach(name => {
                let stats = fs.lstatSync(path.join(fullPath, name))
                if (stats.isDirectory()) {
                    let target = "";
                    if (currentPath === "") { target = name; }
                    else { target = currentPath + "/" + name; }
                    foldersArray.push({ name: name, currentRoot: currentPath, targetPath: target })
                } else {
                    let extRaw = path.extname(name).toLowerCase().replace(".", "");
                    let ext = extRaw.toUpperCase();
                    if (ext === "") { ext = "FILE"; }

                    // Sprawdzanie czy plik jest edytowalny
                    let editableExts = ["txt", "html", "css", "js", "json"];
                    let isEditable = false;
                    if (editableExts.includes(extRaw)) {
                        isEditable = true;
                    }

                    filesArray.push({
                        name: name,
                        ext: ext,
                        currentRoot: currentPath,
                        isEditable: isEditable
                    });
                }
            })
        }
        res.render('filemanager.hbs', {
            folders: foldersArray,
            files: filesArray,
            currentPath: currentPath,
            navButtons: navButtons
        });
    });
})

// --- EDYTOR (Widok z blokadą) ---
app.get("/editor", (req, res) => {
    let root = "";
    if (req.query.root) { root = req.query.root; }
    let name = req.query.name;
    let p = path.join(baseDir, root, name);

    if (fs.existsSync(p)) {
        let ext = path.extname(name).toLowerCase().replace(".", "");
        let editableExts = ["txt", "html", "css", "js", "json"];

        if (editableExts.includes(ext)) {
            let displayPath = (root + "/" + name).replace(/\/+/g, "/");
            res.render("editor.hbs", {
                name: name,
                root: root,
                content: fs.readFileSync(p, "utf-8"),
                displayPath: displayPath
            });
        } else {
            res.redirect("/?path=" + root);
        }
    } else {
        res.redirect("/");
    }
});

// --- ZAPIS WSZYSTKIEGO + RENAME ---
app.post("/saveEverything", (req, res) => {
    const root = req.body.root;
    const oldName = req.body.oldName;
    const newName = req.body.newName;
    const content = req.body.content;
    const config = req.body.config;

    try {
        let nameToSaveAs = oldName;
        const oldPath = path.join(baseDir, root, oldName);
        const newPath = path.join(baseDir, root, newName);

        // Jeśli użytkownik zmienił nazwę przez przycisk Rename
        if (oldName !== newName) {
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                nameToSaveAs = newName;
            }
        }

        // Zapis treści pliku
        const finalPath = path.join(baseDir, root, nameToSaveAs);
        fs.writeFileSync(finalPath, content);

        // Zapis konfiguracji wyglądu
        const configPath = path.join(__dirname, "config.json");
        fs.writeFileSync(configPath, JSON.stringify(config));

        // Jeśli była zmiana nazwy, musimy odświeżyć URL edytora
        if (oldName !== newName) {
            res.json({ redirect: "/editor?root=" + root + "&name=" + nameToSaveAs });
        } else {
            res.json({ status: "ok" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Błąd serwera" });
    }
});

// --- UPLOAD ---
app.post("/handleUpload", (req, res) => {
    const form = new formidable.IncomingForm({ multiples: true, uploadDir: baseDir, keepExtensions: true });
    form.parse(req, (err, fields, files) => {
        let root = fields.root;
        if (Array.isArray(root)) { root = root[0]; }
        if (!root) { root = ""; }

        let lista = [];
        if (files.upload) {
            if (Array.isArray(files.upload)) { lista = files.upload; }
            else { lista = [files.upload]; }
        }

        lista.forEach(f => {
            let sourcePath = f.filepath || f.path;
            let targetName = f.originalFilename || f.name;
            if (sourcePath) {
                if (targetName) {
                    let cel = path.join(baseDir, root, targetName);
                    if (fs.existsSync(sourcePath)) { fs.renameSync(sourcePath, cel); }
                }
            }
        });
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') { res.send("OK"); }
        else { res.redirect("/?path=" + root); }
    });
});

// --- POZOSTAŁE ---
app.get("/getConfig", (req, res) => {
    const configPath = path.join(__dirname, "config.json");
    if (fs.existsSync(configPath)) { res.json(JSON.parse(fs.readFileSync(configPath, "utf-8"))); }
    else { res.json({ bgColor: "#ffffff", fontSize: "14px" }); }
});

app.get("/handleForm", (req, res) => {
    let root = req.query.root || "";
    let name = req.query.foldername || req.query.filename;
    let ext = req.query.ext || "";
    if (!name) return res.redirect("/?path=" + root);
    let fullName = name + (ext !== "" ? "." + ext : "");
    let p = path.join(baseDir, root, fullName);
    if (req.query.foldername) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
    else { if (!fs.existsSync(p)) fs.writeFileSync(p, ""); }
    res.redirect("/?path=" + root);
});

app.get("/remove", (req, res) => {
    fs.rmSync(path.join(baseDir, req.query.root, req.query.name), { recursive: true, force: true });
    res.redirect("/?path=" + req.query.root);
});

app.get("/download", (req, res) => res.download(path.join(baseDir, req.query.root, req.query.name)));

app.get("/zip", (req, res) => {
    const zip = new AdmZip();
    zip.addLocalFolder(path.join(baseDir, req.query.root, req.query.name));
    res.set('Content-Type', 'application/zip');
    res.send(zip.toBuffer());
});

app.get("/rename", (req, res) => {
    fs.renameSync(path.join(baseDir, req.query.root, req.query.oldName), path.join(baseDir, req.query.root, req.query.newName));
    res.redirect("/?path=" + req.query.root);
});

app.listen(PORT, () => console.log("http://localhost:3000"));
