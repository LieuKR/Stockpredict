var express = require('express');
var router = express.Router();
const mysql = require('mysql');
const crypto = require('crypto');
const async = require('async');
const nodemailer = require('nodemailer');

const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '229478',
  database: 'stockpredict'
});

const connection2 = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '229478',
  database: 'stockdata'
});

const connection3 = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '229478',
  database: 'userinfo'
});

connection.connect();
connection2.connect(); // connection2 : stockdata
connection3.connect(); // conn3 : userinfo

function makeintype(res, cookieinfo) {
  res.cookie('intype', cookieinfo ,{maxAge: 1000 * 1});
} // intype라는 쿠키에 어떤 내용을 담아 보내는 함수. 이 쿠키를 이용하여 알람을 나타내려 함.

/* 홈페이지. 로그인, 회원가입등의 기능을 요구 */
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

// 회원가입 페이지. 데이터베이스에 평문 id, 평문 email address 암호화된 password, 그리고 이메일 인증여부를 넣어준다
// ID에 제한이 필요. 6자리 숫자 or 'kosdaq', 'kospi'는 안됨.
router.post('/signup', function(req, res, next) {

  // 입력받아온 post data의 유효성 검사를 먼저 하자.
  // req.body.id, req.body.password, req.body.password2, req.body.address

  // 1. id 중복여부 체크
  // 2. 이메일 중복여부 체크
  // 3. password = password2

  connection.query(`SELECT EXISTS (SELECT \`id\` FROM \`users\` WHERE \`id\`='${req.body.id}') as success`,
    (err, rows1) => {
      if(rows1[0].success == 1){
        makeintype(res, '중복되는 ID가 존재합니다');
        res.redirect('/')
      } else if (!/^[a-zA-Z0-9]{8,20}$/.test(req.body.id)) {
        makeintype(res, 'ID는 영문과 숫자로 구성된 8~20자리이어야 합니다');
        res.redirect('/')
      }
      else {
        connection.query(`SELECT EXISTS (SELECT \`email\` FROM \`users\` WHERE \`email\` = '${req.body.address}') as success`,
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
            } else { // 모든 제한을 통과하면 작동하는 회원가입 시퀀스
              const cryptpasswordfunc = (callback) => {
                crypto.pbkdf2(req.body.password, 'mysalt', 98731, 64, 'sha512', (err, derivedKey) => { // crypto 모듈을 이용한 일방향 암호화. 복호화가 불가능
                  if (err) {
                    console.log('암호화 과정 에러');
                    callback(err);
                    }
                  callback(null, req.body.id, derivedKey.toString('hex'), req.body.address);
                  });
                };
              const savepassword = (arg1, arg2, arg3, callback) => {
                connection.query(`INSERT INTO users (id, password, email, auth) VALUES ('${arg1}', '${arg2}', '${arg3}', '0');`
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
              //이 밑으로는 처음 회원가입때 유저정보를 담기 위한 테이블 생성 과정
              connection3.query(`CREATE TABLE \`${req.body.id}\` (\`id\` INT NOT NULL AUTO_INCREMENT,
                \`code\` INT(6) UNSIGNED ZEROFILL NOT NULL, \`name\` VARCHAR(45),
                \`info\` VARCHAR(45), PRIMARY KEY (\`id\`))`
                    , (err, rows) => {
                      if (err) {
                        throw err;
                      }
                    });
              //요 아래쿼리문은 회원가입할때 유저 예측 정보를 위한 테이블 생성
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

// login page : pw를 먼저 암호화 -> id,pw가 일치하는게 있는지 db와 매칭하고 여러 경우의 수를 채워준다.
  // 1. 받아온 평문 암호 암호화부터.
  // 2. 아이디, 암호화된 패스워드가 일치하는 것을 찾는 쿼리문 작성
    // if 1) 일치하는게 없으면 아이디와 비밀번호가 일치하지 않습니다 << 알람 표시 후 처음 페이지로
    // if 2) 둘다 일치하는게 있으면 그 no의 auth값 확인
        // if 2-1) auth = 0 이면 이메일 인증이 안된거임. 이메일 인증 페이지로 슝
        // if 2-2) auth = 1 이면 이메일 인증까지 댄거임. 로그인 쿠키를 내어주고, 처음 페이지로

router.post('/login', function(req, res, next) {
  // req.body.id : 입력받아 온 id값, req.body.password : 입력받아온 평문 암호, 암호화 필요함
  const cryptpasswordfunc = (callback) => {
    crypto.pbkdf2(req.body.password, 'mysalt', 98731, 64, 'sha512', (err, derivedKey) => {
      if (err) {
        console.log('암호화 과정 에러');
        callback(err);
        }
      callback(null, req.body.id, derivedKey.toString('hex'));
      });
   };
  const checkidpw = (arg1, arg2, callback) => {
    connection.query(`SELECT * FROM users WHERE id='${arg1}' and password='${arg2}';`
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
// rows[0] 를 보내주자. rows[0].id , password, address, auth 를 사용할 수 있을거임.
  const checkauth = (arg1, arg2, callback) => {  // arg1 : 0 or 1, 인증유무 확인 / arg2 : 로그인한 아이디
    // arg1.table : 그 테이블의 값
    if (arg1.auth === 1) { 
      let test = () => {
        makeintype(res, '로그인 되었습니다!')
        req.session.loginid = arg2;
        res.redirect('back'); // 메인 페이지로 세션이 설정된 쿠키를 쥐여준뒤 보내줌
      };
      test();
    } else {
      let test = () => {
        req.session.email = arg1.email;
        makeintype(res, '이메일 인증이 필요합니다!')
        res.redirect('/emailauth'); // 이메일 인증 페이지로 보냄
      };
      test();
    };
  };
  let tasks = [
    cryptpasswordfunc,
    checkidpw,
    checkauth
  ];
  async.waterfall(tasks, function(err, result){ // 비동기 처리를 위해 꼭 필요
    if (err) {console.log('로그인 ERROR')}
    }
  );
});

// 이메일 인증 페이지. 받아오는 post정보는 no, id, email address 세개
router.get('/emailauth', function(req, res, next) {
  if(req.session.email){
    function sendemail(toemail, title, txt){
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        secure: true,
        auth: {
          user: 'stockpredict17',
          pass: 'testpassword17'
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
    randomkey = (callback) => { // 랜덤키 생성. 이걸 인증키로 사용할 예정
      let randomnumber = Math.floor(Math.random() * 10000000000 - 1);
      callback(randomnumber);
    };
    if (req.session.foremailauth){
      console.log('인증용 키가 이미 있습니다');
    } else {
      // 인증키가 없으면 인증키를 만들고, 세션에 저장.
      randomkey(function(randomedkey){
        // 전송된 키는 변수 randomedkey, 세션에 저장
        // console.log('이메일 인증을 위해 생성된 키는 %d 입니다', randomedkey);  기능확인을 위해 넣었었음
        req.session.foremailauth = `${randomedkey}`;
        sendemail(req.session.email, '이메일 인증을 위한 stockpredict 인증번호', `${randomedkey}`);
        // req.session.email 주소에 stockpredict 인증번호라는 제목으로, 생성된 랜덤키를 전송
      });
    };
    res.render('emailcheck', {loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else {
    makeintype(res, '세션이 만료되었습니다')
    res.redirect('/')
  }
});

// 이메일 인증값 바꿔주는 페이지
// 위에서 만든 키가 입력되었는지 체크하고, 맞으면 auth값을 바꿔주고 아니면 전페이지로 보내버리기
router.post('/emailauth/check', function(req, res, next){
  if(req.session.foremailauth == req.body.authnumber){
    connection.query(`UPDATE users SET auth = '1' WHERE (email = '${req.session.email}');`
    , (err, rows, fields) => {
    if (err) {
      console.log('sql에 저장이 안되는 오류 발생');
      }
    else {
      // auth = 1로 바뀌며 모든 세션을 파괴
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

// 아이디 찾아주는 페이지, req.body.address : 입력받아온 이메일값
router.post('/fid', function(req, res, next){
  connection.query(`SELECT * FROM users WHERE email='${req.body.address}';`
  , (err, rows, fields) => {
  if (rows[0] == null) {
    makeintype(res, '가입되지 않은 이메일 주소입니다!')
    res.redirect('/');
    }
  else {
    req.session.emailforpass = req.body.address; // 이메일 주소
    req.session.idforcheakpass = rows[0].id; // 아이디
    res.redirect('/fid/cpw'); // 이 페이지에서 이메일 인증을 요구하자
  };
});

// 비밀번호 바꿔주기 위한 이메일 인증 페이지
router.get('/fid/cpw', function(req, res){
  function sendemail(toemail, title, txt){
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      secure: true,
      auth: {
        user: 'stockpredict17',
        pass: 'testpassword17'
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
      // console.log('비밀번호 교체를 위해 전송될 키는 %d 입니다', randomedkey);  기능확인을 위해 넣었었음
      req.session.forpasschang = `${randomedkey}`;
      sendemail(req.session.emailforpass, '비밀번호 교체를 위한 stockpredict 인증번호', `${randomedkey}`);
    });
    res.render('cpw', {myid: req.session.idforcheakpass, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  }
});

// 인증번호를 입력받았을 경우
router.post('/fid/auth', function(req, res, next){
  if(req.session.forpasschang == req.body.authnumber){ // 인증번호를 옳게 입력
    req.session.enteredauthnumber = req.body.authnumber;
    res.render('npw', {loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else { // 인증번호를 잘못 입력. 알람을 띄우고, 전페이지로
    makeintype(res, '잘못된 인증번호입니다!')
    res.redirect('/fid/cpw');
  };
});

// 보안문제가 생길 수 있는 페이지. 그래서 세션을 사용하였다.
router.get('/fid/auth', function(req, res, next){
  if(req.session.enteredauthnumber){
    res.render('npw', {loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  } else {
    makeintype(res, '세션이 만료되었습니다')
    res.redirect('/');
  };
});

// 새 비밀번호를 만들어 주는 페이지. 암호화 방식이 복호화가 불가능한 방식이므로, 무조건 새로 만들게 해야함
router.post('/fid/npw', function(req, res, next){
  if(req.body.authnumber1 == req.body.authnumber2){ // 같은 비밀번호가 잘 입력되었을 때
    const cryptpasswordfunc = (callback) => {
      crypto.pbkdf2(req.body.authnumber1, 'mysalt', 98731, 64, 'sha512', (err, derivedKey) => {
        if (err) {
          console.log('암호화 과정 에러');
          callback(err);
          }
        callback(null, derivedKey.toString('hex'));
        });
     };
    const changepw = (arg1, callback) => {
      connection.query(`UPDATE users SET password = '${arg1}' WHERE (email = '${req.session.emailforpass}');`
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
   } else { // 서로 다른 비밀번호가 입력되었을때. 전페이지 보내면서 알람
      makeintype(res, '같은 비밀번호가 입력되지 않았습니다!')
      res.redirect('/fid/auth');
   }
  });
});

module.exports = router;