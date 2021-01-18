var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const session = require('express-session');
const MySQLStore = require('express-mysql-session');

const dbconfig  = require('./config/dbsetting.json');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var stockinfoRouter = require('./routes/stockinfo');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  key: 'mykey',
  secret: 'mysecret',
  store: new MySQLStore({
    host: dbconfig.host,
    port: dbconfig.port,
    user: dbconfig.user,
    password: dbconfig.password,
    database: dbconfig.database1,
    clearExpired: true,
    checkExpirationInterval : 1000 * 100
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60, // 60sec
    secure: false
  }
}))

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/stockinfo', stockinfoRouter);
var router = express.Router();


router.get('/', function(req, res, next) {
  if(req.session.loginid){
    res.end(`Logined with ID : ${req.session.loginid}`)
  } else {
  res.send('respond with a resource');
  };
});

module.exports = router;

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
