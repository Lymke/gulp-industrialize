/////////////////////////////
// Gulp and gulp plugins
/////////////////////////////
var gulp = require('gulp'),
    gutil = require('gulp-util'),
    extend = require('extend'),
    argv = require('minimist')(process.argv),
    fs = require("fs"),
    clean = require('gulp-clean'),
    gulpif = require('gulp-if'),
    prompt = require('gulp-prompt'),
    inject = require('gulp-inject'),
    injectString = require('gulp-inject-string'),
    jshint = require('gulp-jshint'),
    gp_concat = require('gulp-concat'),
    ngAnnotate = require('gulp-ng-annotate'),
    uglify = require('gulp-uglify'),
    rename = require('gulp-rename'),
    htmlmin = require('gulp-htmlmin'),
    removeHtmlComments = require('gulp-remove-html-comments'),
    cleanCSS = require('gulp-clean-css'),
    sass = require('gulp-sass'),
    sourcemaps = require('gulp-sourcemaps'),
    jsonminify = require('gulp-jsonminify'),
    imagemin = require('gulp-imagemin')
    phpMinify = require('@aquafadas/gulp-php-minify'),
    rsync = require('gulp-rsync'),
    zip = require('gulp-zip')
    bower = require('gulp-bower');

sPathSources = (argv.source != undefined) ? './config/'+ argv.source : './config/sources.json';
oSources = require(sPathSources);
oDeploy = require('./config/deploy.json');
oProject = require('./config/project.json');
PATH_INDEX = oSources.index.src || './src/index.html.dist';
PATH_DEPLOIEMENT = oSources.deploiement || 'gulp/deploiement/';


/////////////////////////////
// Micro tasks for prepare-deploiement
/////////////////////////////

//CLEAN : clean the folder deploiement
gulp.task('clean', function () {
    return gulp.src(PATH_DEPLOIEMENT, {read: false})
        .pipe(clean({force: true}));
});

//CSS,  Run sass to create the file ./deploiement/style.min.css and minify css from sources.json
gulp.task('css-sass', ['clean'], function () {
    if (oSources.sass.active) {
        for (oTheme in oSources.sass.themes) {
            gulp.src(oSources.sass.themes[oTheme].src, { cwd: oSources.cwd})
                .pipe(sourcemaps.init())
                .pipe(sass({outputStyle: 'compressed'})
                    .on('error', sass.logError))
                .pipe(sourcemaps.write())
                .pipe(gp_concat(oSources.sass.themes[oTheme].distFileName))
                .pipe(gulp.dest(PATH_DEPLOIEMENT+oSources.sass.themes[oTheme].dist));
        }
    } else {
        return false;
    }
});

gulp.task('css-minify', ['clean'], function () {
    if (oSources.css.active) {
        return gulp.src(oSources.css.src, { cwd: oSources.cwd})
            .pipe(cleanCSS({compatibility: 'ie8'}))
            .pipe(gp_concat(oSources.css.distFileName))
            .pipe(gulp.dest(PATH_DEPLOIEMENT+oSources.css.dist));
    } else {
        return false;
    }
});

//JSON : minify json from ./config/sources.json and put the result in ./deploiement with the same tree (modules/nommodule/data..)
gulp.task('json-minify', ['clean'], function () {
    if (oSources.json.active) {
        return gulp.src(oSources.json.src, {cwd: oSources.cwd})
            .pipe(jsonminify())
            .pipe(gulp.dest(PATH_DEPLOIEMENT));
    } else {
        return false;
    }

});

//HTML : minify html files from ./config/sources.json and put the result in ./deploiement  with the same tree
gulp.task('html-minify', ['clean'], function () {
    if (oSources.html.active) {
        return gulp.src(oSources.html.src, {cwd: oSources.cwd})
            .pipe(removeHtmlComments())
            .pipe(htmlmin({collapseWhitespace: true}))
            .pipe(gulp.dest(PATH_DEPLOIEMENT+oSources.html.dist));
    } else {
        return false;
    }
});

//JS : minify and concat JS from ./config/sources.json and create the file ./deploiement/script.min.js
gulp.task('js-minify', ['clean'], function () {
    if (oSources.js.active) {
        return gulp.src(oSources.js.src, {base: '.', cwd: oSources.cwd})
            .pipe(jshint())
            .pipe(gp_concat(oSources.js.dist))
            .pipe(ngAnnotate())
            //.pipe(uglify())
            .pipe(rename({suffix: '.min'}))
            .pipe(gulp.dest(PATH_DEPLOIEMENT));
    } else {
        return false;
    }
});

//PICTURES : copy pictures from config/sources.json in deploiement
gulp.task('images', ['clean'], function () {
    if (oSources.images.active) {
        gulp.src(oSources.images.src, {cwd: oSources.cwd})
            .pipe(imagemin())
            .pipe(gulp.dest(PATH_DEPLOIEMENT + oSources.images.dist))
            .on('end', function () {
                //console.log('task images end');
            })
            .on('error', function () {
                //console.log('task images error');
            });
    } else {
        return false;
    }
});

//PHP : minify php
gulp.task('php-minify', ['clean'], function () {
    if (oSources.php.active) {
        gulp.src(oSources.php.src, {read: true, cwd : oSources.cwd})
            .pipe(phpMinify({silent: true, binary: oSources.php.exe}))
            .pipe(gulp.dest(oSources.deploiement));
    } else {
        return false;
    }
});


//COPY-FILES : copy files into the deploiement folder without modify them
gulp.task('copy-files', ['clean'], function () {
	if(oSources.copy.active){

        for (oRepos in oSources.copy.repos) {
            
            gulp.src(oSources.copy.repos[oRepos].src, {cwd : oSources.cwd})
                .pipe(gulp.dest(PATH_DEPLOIEMENT + oSources.copy.repos[oRepos].dist));
        }
		

	}else{
		return false;
	}
    });

//COPY-INDEX : Create the deploiement/index.html and inject dependances of local css, js and external librairies
gulp.task('copy-index', ['clean'], function () {
	if(oSources.index.active){
        console.log(oSources.index.src);
        gulp.src(oSources.index.src, {cwd: oSources.cwd})
        .pipe(rename({basename: 'index', extname: ".html"}))
        .pipe(gulp.dest(PATH_DEPLOIEMENT+oSources.index.dist));
	}else{
		return false;
	}
});

gulp.task('inject',['copy-index', 'copy-files','css-sass', 'js-minify'],  function () {

    sExterneJs = '\n';
    for (sSource in oSources.dist.js) {
        sExterneJs += '     <script src="' + oSources.dist.js[sSource] + '"></script>' + '\n';
    }

    sExterneCSS = '\n';
    for (sSource in oSources.dist.css) {
        sExterneCSS += '     <style  rel="stylesheet" href="' + oSources.dist.css[sSource] + '"></style>' + '\n';
    }

    gulp.src(PATH_DEPLOIEMENT + oSources.index.dist + "\\" +oSources.index.distFileName)
        .pipe(injectString.replace('##title##', oProject.title))
        .pipe(injectString.replace('##appName##', oProject.appName))
        .pipe(injectString.replace('##description##', oProject.description))
        .pipe(injectString.replace('##dist-js##', sExterneJs))
        .pipe(injectString.replace('##dist-css##', sExterneCSS))
        .pipe(inject(gulp.src(oSources.inject.src, {read: false, cwd: PATH_DEPLOIEMENT}), {relative: true}))
        .pipe(gulp.dest(PATH_DEPLOIEMENT+oSources.index.dist));
});

//Bower : launch bower after json-minify
gulp.task('bower',['clean','json-minify'],  function () {
     //return bower({ cwd: PATH_DEPLOIEMENT });
});

/////////////////////////////
// Micro tasks for deploy
/////////////////////////////


/////////////////////////////
// Micro tasks for backup
/////////////////////////////

gulp.task('zip', function () {
    
    var now = new Date();
    var annee   = now.getFullYear();
    var mois    = (now.getMonth() + 1 < 10) ? '0' + now.getMonth() + 1 : now.getMonth() + 1 ;
    var jour    = (now.getDate() < 10) ? '0' + now.getDate() : now.getDate();
    
    return gulp.src(PATH_DEPLOIEMENT + '/**/*')
        .pipe(zip(annee +  '_'+ mois + '_' + jour + '.zip'))
        .pipe(gulp.dest(PATH_DEPLOIEMENT + '/..' + '/backup'));
});

/////////////////////////////
// Macro tasks
/////////////////////////////
gulp.task('default', function () {

    styleMenu = gutil.colors.bgBlue.white;

    gutil.log(styleMenu('Bienvenue !!!^^!!!'));
    gutil.log(styleMenu('Commencez par préparer le déploiement, puis déployez sur votre serveur :'));
    gutil.log(styleMenu('1) gulp prepare-deploiement --source="sources-****.json"'));
    gutil.log(styleMenu('2) gulp deploy --env xxx'));

});

gulp.task('prepare-deploiement', ['css-sass', 'css-minify', 'json-minify', 'html-minify', 'php-minify','images','copy-files', 'inject','bower']);

gulp.task('deploy', function () {

    oDeploy = {
        "progress": false,
        "incremental": true,
        "relative": true,
        "emptyDirectories": true,
        "recursive": true,
        "clean": true,
        "chmod": "ugo=rwX"//,
        //"root": __dirname + '/' + PATH_DEPLOIEMENT
    };

    oConfigConnexion = require('./config/deploy.json')[argv.env];
   
    if (oConfigConnexion == undefined) {
        gutil.log(gutil.colors.bgRed.white('Config connexion undefined'));
        return false;
    } else {
        return gulp.src(PATH_DEPLOIEMENT + '/**/*')
            .pipe(gulpif((argv.production || (argv.env && argv.env == 'production')),
                prompt.confirm({
                    message: 'Are you sure to push in production ?',
                    default: false
                })
                ))
            .pipe(rsync(extend(oDeploy, oConfigConnexion)));
    }

});