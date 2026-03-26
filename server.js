const express = require("express")
const app = express()
const PORT = 3000;
const path = require("path");
const { create } = require('express-handlebars');
const formidable = require('formidable');
const fs = require("fs");
const AdmZip = require("adm-zip");

const baseDir = path.join(__dirname, "files")
// stworz folder bazowy jesli nie istnieje
if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir);
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('static'))
app.engine('.hbs', create({ defaultLayout: 'main.hbs', extname: '.hbs' }).engine);
app.set('view engine', '.hbs');

// strona glowna
app.get("/", function (req, res) {
    let currentPath = "";
    if (req.query.path) {
        currentPath = req.query.path
    }

    // files z teraz ogladanym folderem
    let fullPath = path.join(baseDir, currentPath);

    // errory
    if (!fs.existsSync(fullPath)) {
        res.render("error.hbs", { path: currentPath });
        return;
    }

    let navButtons = [{ name: "HOME", url: "" }];
    let parts = currentPath.split("/").filter(p => p !== ""); // tablica czesci sciezka
    let tempPath = "";
    parts.forEach(p => {
        if (tempPath === "") {
            tempPath = p;
        } else {
            tempPath = tempPath + "/" + p;
        }
        // przyciski nawigacji folderow
        navButtons.push({ name: p.toUpperCase(), url: tempPath });
    });

    // zawartosc folderu read
    fs.readdir(fullPath, (err, files) => {
        let foldersArray = [];
        let filesArray = [];

        if (files) {
            files.forEach(name => {
                // plik czy folder
                let stats = fs.lstatSync(path.join(fullPath, name))

                if (stats.isDirectory()) {
                    // folder - scsiezka
                    let target = "";
                    if (currentPath === "") {
                        target = name;
                    } else {
                        target = currentPath + "/" + name;
                    }
                    foldersArray.push({ name: name, currentRoot: currentPath, targetPath: target })
                } else {
                    // plik - rozszerzenie
                    let extRaw = path.extname(name).toLowerCase().replace(".", "");
                    let ext = extRaw.toUpperCase() || "FILE";
                    let editableExts = ["txt", "html", "css", "js", "json"];
                    let isEditable = editableExts.includes(extRaw);

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

// edytor tekstowy
app.get("/editor", (req, res) => {
    let root = req.query.root || "";
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

// save
app.post("/saveEverything", (req, res) => {
    const { root, oldName, newName, content, config } = req.body;

    try {
        let nameToSaveAs = oldName;
        const oldPath = path.join(baseDir, root, oldName);
        const newPath = path.join(baseDir, root, newName);
        // nazwa pliku zmiana
        if (oldName !== newName) {
            if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                nameToSaveAs = newName;
            }
        }

        // nadpisywanie nowa trescia
        const finalPath = path.join(baseDir, root, nameToSaveAs);
        fs.writeFileSync(finalPath, content);

        // save config
        const configPath = path.join(__dirname, "config.json");
        fs.writeFileSync(configPath, JSON.stringify(config));

        // nazwa zmienona - reload z nowa nazwa
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

// upload
app.post("/handleUpload", (req, res) => {
    const form = new formidable.IncomingForm({ multiples: true, uploadDir: baseDir, keepExtensions: true });

    form.parse(req, (err, fields, files) => {
        let root = "";
        if (Array.isArray(fields.root)) {
            root = fields.root[0];
        } else {
            root = fields.root || "";
        }

        //  pliki w tablice
        let lista = [];
        if (files.upload) {
            if (Array.isArray(files.upload)) {
                lista = files.upload;
            } else {
                lista = [files.upload];
            }
        }

        // z folderu tymczasowego do lokalizacji usera
        lista.forEach(f => {
            let sourcePath = f.filepath || f.path;
            let targetName = f.originalFilename || f.name;
            if (sourcePath && targetName) {
                let cel = path.join(baseDir, root, targetName);
                if (fs.existsSync(sourcePath)) {
                    fs.renameSync(sourcePath, cel);
                }
            }
        });

        //drag and drop - ok
        if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
            res.send("OK");
        } else {
            res.redirect("/?path=" + root);
        }
    });
});

// config
app.get("/getConfig", (req, res) => {
    const configPath = path.join(__dirname, "config.json");
    if (fs.existsSync(configPath)) {
        res.json(JSON.parse(fs.readFileSync(configPath, "utf-8")));
    } else {
        res.json({ bgColor: "#ffffff", fontSize: "14px" });
    }
});

// create
app.get("/handleForm", (req, res) => {
    let root = req.query.root || "";
    let name = req.query.foldername || req.query.filename;
    let ext = req.query.ext || "";

    if (!name) {
        return res.redirect("/?path=" + root);
    }

    let fullName = name;
    if (ext !== "") {
        fullName = name + "." + ext;
    }

    let p = path.join(baseDir, root, fullName);

    if (req.query.foldername) {
        // tworzenie folderu
        if (!fs.existsSync(p)) {
            fs.mkdirSync(p, { recursive: true });
        }
    } else {
        if (!fs.existsSync(p)) {
            let content = "";
            if (ext === "html") content = "<!DOCTYPE html>\n<html>\n<head></head>\n<body>\n\n</body>\n</html>";
            else if (ext === "css") content = "body {\n    background-color: white;\n}";
            else if (ext === "js") content = "console.log('Hello World!');";
            else if (ext === "json") content = "{\n    \"key\": \"value\"\n}";
            else if (ext === "txt") content = "txt";

            fs.writeFileSync(p, content);
        }
    }
    res.redirect("/?path=" + root);
});

// remove
app.get("/remove", (req, res) => {
    // usuwa z zawartoscia bo recursive
    fs.rmSync(path.join(baseDir, req.query.root, req.query.name), { recursive: true, force: true });
    res.redirect("/?path=" + req.query.root);
});

// download
app.get("/download", (req, res) => {
    res.download(path.join(baseDir, req.query.root, req.query.name));
});

// zip
app.get("/zip", (req, res) => {
    const folderName = req.query.name;
    const root = req.query.root || "";
    const folderPath = path.join(baseDir, root, folderName);

    if (fs.existsSync(folderPath)) {
        const zip = new AdmZip();
        zip.addLocalFolder(folderPath);
        const buffer = zip.toBuffer();
        res.set('Content-Disposition', `attachment; filename=${folderName}.zip`);
        res.set('Content-Type', 'application/zip');

        res.send(buffer);
    } else {
        res.redirect("/?path=" + root);
    }
});

// rename z poziomu pliku
app.get("/rename", (req, res) => {
    fs.renameSync(
        path.join(baseDir, req.query.root, req.query.oldName),
        path.join(baseDir, req.query.root, req.query.newName)
    );
    res.redirect("/?path=" + req.query.root);
});

app.listen(PORT, function () {
    console.log("start serwera na porcie " + PORT)
})
