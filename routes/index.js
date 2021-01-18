var express = require('express');
var router = express.Router();
const mysql = require('mysql');
const crypto = require('crypto');
const async = require('async');
const nodemailer = require('nodemailer');

const dbconfig = require('../config/dbsetting.json');
const pwconfig = require('../config/pwsetting.json');
const mailconfig = require('../config/mailsetting.json');

const connection1 = mysql.createConnection({
  host: dbconfig.host,
  port: dbconfig.port,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database1
});

const connection2 = mysql.createConnection({
  host: dbconfig.host,
  port: dbconfig.port,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database2
});

const connection3 = mysql.createConnection({
  host: dbconfig.host,
  port: dbconfig.port,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database3
});

connection1.connect();
connection2.connect();
connection3.connect();

// 알람 함수. 쿠키 내용이 알람에 나옴
function makeintype(res, cookieinfo) {
  res.cookie('intype', cookieinfo ,{maxAge: 1000 * 1});
}

// main page. 로그인, 인증되지 않은 이메일, 로그인되지 않았을 때
router.get('/', function(req, res) {
  if(req.session.loginid){
    res.render('index', {loginid: req.session.loginid, intype: req.cookies.intype});
  } else if(req.session.email){
    res.render('index', {intype: req.cookies.intype, loginnonauth: req.session.email});
  } else{
  res.render('index', {intype: req.cookies.intype});
  }
});

router.post('/logout', function(req, res) {
  req.session.destroy(function(){
    makeintype(res, '로그아웃 되었습니다')
    res.redirect('back');
  });
});

 // 회원가입 페이지
router.post('/signup', function(req, res, next) {
  /* post data 유효성 검사
    1. 중복성 검사
    2. id 형식 검사
    3. 이메일 주소 중복 검사
    4. 입력받은 비밀번호 같은지 검사
    5. 비밀번호 형식 검사
    6. 모두 통과시 회원가입 시작 */
  connection1.query(`SELECT EXISTS (SELECT \`id\` FROM \`users\` WHERE \`id\`='${req.body.id}') as success`,
    (err, rows1) => {
      if(rows1[0].success == 1){
        makeintype(res, '중복되는 ID가 존재합니다');
        res.redirect('/')
      } else if (!/^[a-zA-Z0-9]{8,20}$/.test(req.body.id)) {
        makeintype(res, 'ID는 영문과 숫자로 구성된 8~20자리이어야 합니다');
        res.redirect('/')
      }
      else {
        connection1.query(`SELECT EXISTS (SELECT \`email\` FROM \`users\` WHERE \`email\` = '${req.body.address}') as success`,
        (err, rows2) => {
          if(rows2[0].success == 1){
            makeintype(res, '이미 존재하는 이메일 주소입니다');
            res.redirect('/')
          } else {
            if (req.body.password !== req.body.password2) {
              makeintype(res, '서로 같은 비밀번호를 입력해 주십시오');
              res.redirect('/')
            } else if(req.body.password.length > 20 || req.body.password.length < 8){
              makeintype(res, '비밀번호는 8자리 이상, 20자리 이하이어야 합니다');
              res.redirect('/')
            } else if (/^(?=.*[a-zA-Z])((?=.*\d)|(?=.*\W)).{8,20}$/.test(req.body.password) == false) {
              makeintype(res, '비밀번호는 숫자나, 특수문자를 포함해야 합니다.');
              res.redirect('/')
            } else {
              /*모든 제한을 통과하면 작동하는 회원가입 과정
                1. 비밀번호 암호화
                2. db에 집어넣음
              */
              const cryptpasswordfunc = (callback) => {
                crypto.pbkdf2(req.body.password, pwconfig.salt, pwconfig.runnum, pwconfig.byte, 
                  pwconfig.method, (err, derivedKey) => {
                  if (err) {
                    console.log('암호화 과정 에러');
                    callback(err);
                    }
                  callback(null, req.body.id, derivedKey.toString('hex'), req.body.address);
                  });
                };
              const savepassword = (arg1, arg2, arg3, callback) => {
                connection1.query(`INSERT INTO users (id, password, email, auth) VALUES ('${arg1}', '${arg2}', '${arg3}', '0');`
                  , (err, rows, fields) => {
                  if (err) {
                    console.log('sql에 저장이 안되는 오류 발생');
                    callback(err);
                    }
                  else {
                  callback(null);
                  }
                });
              };
              let tasks = [
                cryptpasswordfunc,
                savepassword
              ];
              async.waterfall(tasks, function(err, result){
                }
              );
              // 이후 서비스 제공을 위한 db table 생성
              connection3.query(`CREATE TABLE \`${req.body.id}\` (\`id\` INT NOT NULL AUTO_INCREMENT,
                \`code\` INT(6) UNSIGNED ZEROFILL NOT NULL, \`name\` VARCHAR(45),
                \`info\` VARCHAR(45), PRIMARY KEY (\`id\`))`
                    , (err, rows) => {
                      if (err) {
                        throw err;
                      }
                    });
              connection3.query(`CREATE TABLE \`${req.body.id}_pred\` (\`id\` INT NOT NULL AUTO_INCREMENT,
                \`code\` INT(6) UNSIGNED ZEROFILL NOT NULL, \`name\` VARCHAR(45),
                \`date\` DATE, \`dayprice\` INT, \`expectprice\` INT, \`nextprice\` INT,
                PRIMARY KEY (\`id\`))`
                    , (err, rows) => {
                      if (err) {
                        throw err;
                      }
                    });
                    makeintype(res, '회원가입이 완료되었습니다!');
              res.redirect('/');
            } 
          }
        });
      }
    });
});

  /*login page
    1. 비밀번호 암호화
    2. id, pw와 일치하는지 db에서 찾기
      2-1. 존재하지 않음
      2-2. 존재하면 auth값 확인
        2-2-1. auth = 0 => 이메일 인증
        2-2-2. auth = 1 => 정상 로그인 */
router.post('/login', function(req, res, next) {
  const cryptpasswordfunc = (callback) => {
    crypto.pbkdf2(req.body.password, pwconfig.salt, pwconfig.runnum, pwconfig.byte, 
      pwconfig.method, (err, derivedKey) => {
      if (err) {
        console.log('암호화 과정 에러');
        callback(err);
        }
      callback(null, req.body.id, derivedKey.toString('hex'));
      });
   };
  const checkidpw = (arg1, arg2, callback) => {
    connection1.query(`SELECT * FROM users WHERE id='${arg1}' and password='${arg2}';`
      , (err, rows, fields) => {
      if (rows[0] == null) {
        makeintype(res, '아이디, 비밀번호가 잘못되었습니다')
        res.redirect('/');
        }
      else {
        callback(null, rows[0], arg1);
      };
    });
  };
  const checkauth = (arg1, arg2, callback) => {
    if (arg1.auth === 1) { 
      let test = () => {
        makeintype(res, '로그인 되었습니다!')
        req.session.loginid = arg2;
        res.redirect('back');
      };
      test();
    } else {
      let test = () => {
        req.session.email = arg1.email;
        makeintype(res, '이메일 인증이 필요합니다!')
        res.redirect('/emailauth');
      };
      test();
    };
  };
  let tasks = [
    cryptpasswordfunc,
    checkidpw,
    checkauth
  ];
  async.waterfall(tasks, function(err, result){
    if (err) {console.log('로그인 ERROR')}
    }
  );
});

// 이메일 인증. auth = 0 : 이메일 인증이 안 된 계정, auth = 1 : 이메일 인증이 된 계정
router.get('/emailauth', function(req, res, next) {
  if(req.session.email){
    // email로 인증키 전송
    function sendemail(toemail, title, txt){
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        secure: true,
        auth: {
          user: mailconfig.user,
          pass: mailconfig.pass
        },
      });
      let mailoption = {
        form: 'stockpredict',
        to: toemail,
        subject: title,
        text: txt
      };
      transporter.sendMail(mailoption, function(err, info){
        if (err) {
            console.log(err);
        }
        transporter.close()
        });
    };
    // 메일 인증 키 생성함수
    randomkey = (callback) => { 
      let randomnumber = Math.floor(Math.random() * 10000000000 - 1);
      callback(randomnumber);
    };
    if (req.session.foremailauth){
      console.log('인증용 키가 이미 있습니다');
    } else {
      randomkey(function(randomedkey){
        req.session.foremailauth = `${randomedkey}`;
        sendemail(req.session.email, '이메일 인증을 위한 stockpredict 인증번호', `${randomedkey}`);
      });
    };
    res.render('emailcheck', {loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else {
    makeintype(res, '세션이 만료되었습니다')
    res.redirect('/')
  }
});

// 입력받아온 키 확인후 세션에 저장된 값과 일치하면 auth값 수정
router.post('/emailauth/check', function(req, res, next){
  if(req.session.foremailauth == req.body.authnumber){
    connection1.query(`UPDATE users SET auth = '1' WHERE (email = '${req.session.email}');`
    , (err, rows, fields) => {
    if (err) {
      console.log('sql에 저장이 안되는 오류 발생');
      }
    else {
      req.session.destroy();
      makeintype(res, '이메일 인증이 성공하였습니다! ')
      res.redirect('/');
      }
    });
  } else {
    makeintype(res, '잘못된 인증번호입니다!')
    res.redirect('/emailauth');
  };
});

// 아이디 찾아주는 페이지
router.post('/fid', function(req, res, next){
  connection1.query(`SELECT * FROM users WHERE email='${req.body.address}';`
  , (err, rows, fields) => {
  if (rows[0] == null) {
    makeintype(res, '가입되지 않은 이메일 주소입니다!')
    res.redirect('/');
    }
  else {
    req.session.emailforpass = req.body.address;
    req.session.idforcheakpass = rows[0].id;
    res.redirect('/fid/cpw');
  };
});

// 비밀번호를 바꾸기 위한 이메일 인증 페이지
router.get('/fid/cpw', function(req, res){
  function sendemail(toemail, title, txt){
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      secure: true,
      auth: {
        user: mailconfig.user,
        pass: mailconfig.pass
      },
    });
    let mailoption = {
      form: 'stockpredict',
      to: toemail,
      subject: title,
      text: txt
    };
    transporter.sendMail(mailoption, function(err, info){
      if (err) {
          console.log(err);
      }
      transporter.close()
      });
    };
  randomkey = (callback) => {
    let randomnumber = Math.floor(Math.random() * 10000000000 - 1);
    callback(randomnumber);
  };
  if(req.session.forpasschang){
    res.render('cpw', {myid: req.session.idforcheakpass, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else {
    randomkey(function(randomedkey){
      req.session.forpasschang = `${randomedkey}`;
      sendemail(req.session.emailforpass, '비밀번호 교체를 위한 stockpredict 인증번호', `${randomedkey}`);
    });
    res.render('cpw', {myid: req.session.idforcheakpass, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  }
});

// 인증번호를 입력받았을 경우
router.post('/fid/auth', function(req, res, next){
  // 인증번호를 맞게 입력한 경우
  if(req.session.forpasschang == req.body.authnumber){
    req.session.enteredauthnumber = req.body.authnumber;
    res.render('npw', {loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else { 
    makeintype(res, '잘못된 인증번호입니다!')
    res.redirect('/fid/cpw');
  };
});

// 인증번호가 잘못되었을때 들어오는 페이지. 다시 입력할 수 있게 함
router.get('/fid/auth', function(req, res, next){
  if(req.session.enteredauthnumber){
    res.render('npw', {loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else {
    makeintype(res, '세션이 만료되었습니다')
    res.redirect('/');
  };
});

// 새 비밀번호를 만들어 주는 페이지
router.post('/fid/npw', function(req, res, next){
   // 같은 비밀번호가 입력되었을 때
  if(req.body.authnumber1 == req.body.authnumber2){
    const cryptpasswordfunc = (callback) => {
      crypto.pbkdf2(req.body.authnumber1, pwconfig.salt, pwconfig.runnum, pwconfig.byte, 
        pwconfig.method, (err, derivedKey) => {
        if (err) {
          console.log('암호화 과정 에러');
          callback(err);
          }
        callback(null, derivedKey.toString('hex'));
        });
     };
    const changepw = (arg1, callback) => {
      connection1.query(`UPDATE users SET password = '${arg1}' WHERE (email = '${req.session.emailforpass}');`
        , (err, rows, fields) => {
          if (err) {
            console.log('sql에 저장이 안되는 오류 발생');
            res.redirect('/');
            }
          else {
            makeintype(res, '비밀번호가 변경되었습니다!');
            req.session.destroy();
            res.redirect('/');
            };
          });
        };
    let tasks = [
      cryptpasswordfunc,
      changepw
    ];
    async.waterfall(tasks, function(err, result){
      if (err) {console.log('비밀번호 변경 ERROR')}
      else {console.log('비밀번호 변경 완료')}
      }
    );
   } else { 
        // 서로 다른 비밀번호가 입력되었을때
      makeintype(res, '같은 비밀번호가 입력되지 않았습니다!')
      res.redirect('/fid/auth');
   }
  });
});

module.exports = router;