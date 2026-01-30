const express = require("express")
const app = express()
const PORT = 3000;
const path = require("path");
const { create } = require('express-handlebars');
const formidable = require('formidable');

app.use(express.static('static'))

const hbs = create({
    defaultLayout: 'main.hbs',
    extname: '.hbs'
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

app.get("/", function (req, res) {
    res.render('filemanager.hbs');
})

app.get("/", function(){
})

app.get("/handleForm", function(req, res){
 console.log(req.query.filename) 
})

app.get("/handleForm", function(req, res){
 console.log(req.query.foldername) 
})

app.get("/addFolder", function(req, res){
 fs.mkdir("/folder", function(){
 res.redirect("/")
 })
})

app.get("/addFile", function(req, res) {
    fs.mkdir("/file", function () {
        res.redirect("/")
    })
})

app.get("/removeFolder", function(){})
app.get("/removeFile", function(){})
app.post("/uploadFile", function(){})

app.listen(PORT, function () {
    console.log("start serwera na porcie " + PORT)
})
