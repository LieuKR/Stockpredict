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

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug'); // template engine : pug
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
    clearExpired: true, // 만료된 세션을 자동으로 확인하고 DB에서 삭제
    checkExpirationInterval : 1000 * 100 // 100초마다 세션 확인 
  }),
  resave: false, // 요청이 바뀌지 않더라도 세션 정보를 다시 저장
  saveUninitialized: false, // 쿠키를 설정하기 전 사용자의 허락이 필요 : false
  cookie: {
    maxAge: 1000 * 60 * 60, // 세션은 60초 * 10, 60분동안 유효함
    secure: false // 기본값은 false. true일 경우 https에서만 쿠키 전송
  }
}))

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/stockinfo', stockinfoRouter);
var router = express.Router();

/* GET users listing. */
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
