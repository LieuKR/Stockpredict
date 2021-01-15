const { xml } = require('cheerio');
var express = require('express');
var router = express.Router();
const mysql = require('mysql');
const charset = require('charset'); // 헤더에 있는 charset 값을 알수있음
const cheerio = require('cheerio'); // html 데이터로부터 원하는 값을 파싱하기 위한 모듈
const iconv = require('iconv-lite'); // for charset change EUC-KR to UTF-8
const request = require('request'); // for html crawling

const dbconfig  = require('../config/dbsetting.json');

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

connection1.connect(); // connection1 : stockpredict
connection2.connect(); // connection2 : stockdata
connection3.connect(); // conn3 : userinfo

function makeintype(res, cookieinfo) {
  res.cookie('intype', cookieinfo ,{maxAge: 1000 * 1});
}

function dateform(array) { // date : 날짜값. Thu Nov 19 2020 00:00:00 GMT+0900 (GMT+09:00) 요론모양. 
  let year = array.date.getFullYear();
  let month = array.date.getMonth()+1;
  let day = array.date.getDate();
  if(month < 10){
    month = "0"+month;
  }
  if(day < 10){
    day = "0"+day;
  }
  array.date = year+"-"+month+"-"+day;
}

// 이 페이지에 들어오면 일단 내 예측에 있는 모든 쿼리를 뽑아와서, nextprice가 비어있는 쿼리를 찾아내서 채울 수 있으면 채워주자.
/* 그 전에 데이터-파싱이 먼저겠지?
1. 페이지에 들어오면, nextprice가 비어있는 쿼리를 찾아내.
2. nextprice를 채우기 위해 데이터 파싱을 먼저 해.
date가 오늘보다 적고, stockinfo의 오늘자 nextprice가 비어있으면 데이터 파싱을 시도할거임
+ 데이터 파싱을 하면, 세션(유효기간이 오늘 00시까지인 체크용 세션)을 만들어서 다시 그 주식 파싱 안하게.
3. nextprice를 채워 줘
*/

router.get('/predict', function(req, res) {
  function maketoday() {
    let date = new Date();
    let year = date.getFullYear();
    let month = date.getMonth()+1
    let day = date.getDate();
    if(month < 10){
        month = "0"+month;
      }
    if(day < 10){
        day = "0"+day;
      }
    return year+"-"+month+"-"+day;
  };
  today = maketoday();
  function crawlpage(code) { 
    return new Promise(resolve => {
      for (let i = 1; i < 5; i++){
        let url = `https://finance.naver.com/item/sise_day.nhn?code=${code}&page=${i}`;
        request({url, headers: { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36' }, encoding: null}, function(error, response, body){
          let char = charset(res.headers, body);
          let $ = cheerio.load(`${iconv.decode(body, char)}`);
          let $dailyinfo = $('body > table.type2 > tbody > tr');
          $dailyinfo.each((i, item) => {
            if($(item).find('td:nth-child(1) > span').text() !== ''){
              connection2.query(`INSERT INTO \`${code}\` (\`date\`, \`endprice\`) 
              SELECT '${$(item).find('td:nth-child(1) > span').text()}', 
                '${$(item).find('td:nth-child(2) > span').text().replace(/,/g, '')}'
              FROM DUAL WHERE NOT EXISTS (
                SELECT \`date\` FROM \`${code}\` WHERE \`date\` = '${$(item).find('td:nth-child(1) > span').text()}'
              );` , (err, rows) => {
                    if(err) throw err
                    });
            };
          });
        });
      };
      setTimeout(() => {
        resolve('resolved');
      }, 50);
    });
    };

  if(req.session.loginid == undefined){
    makeintype(res, '로그인이 되어있지 않습니다!')
    res.redirect('/')
  }
  else if(req.cookies.predicted == undefined){ // 예측로직이 돌아갔다는 쿠키가 없을 때.
    connection3.query(`SELECT distinct \`code\` FROM \`${req.session.loginid}_pred\` WHERE \`nextprice\` is null;`
        , (err, rows1) => {
          for(let j in rows1){ // rows1[j].code : nextprice가 비어있는 코드
            let stockcode = rows1[j].code
            connection2.query(`SELECT EXISTS (SELECT \`date\` from \`${rows1[j].code}\`  
              where \`date\` = '${today}') as success;`, (err,rows2) => { // 오늘 데이터가 존재하는지 체크하기
                // console.log(`${rows1[j].code}에 대하여 데이터 체크 돌아감`); : 체크용 파트
                if(rows2[0].success == 0) { 
                  //  && req.cookies.crawled+`crawled_${rows1[j].code}` == rows1[j].code
                  // 오늘 데이터가 존재하지 않을 경우 && 이 코드에 대해 크롤링했다는 쿠키가 없을 때
                  async function datacrawl(code) {
                    let result = await crawlpage(code);
                    }
                  datacrawl(stockcode);
                  // console.log(`${stockcode}에 대하여 크롤링로직 돌아감`);  : 체크용 파트
                  // 최소 5분뒤, 그 주식에 대해 크롤링 작동하도록
                  // 쿠키생성. 오늘 날짜가 없으면 일단 크롤링하는데, 크롤링을 한번만 하고 그 이후론 그냥 통과시키기 위해
                };
                // nextprice에 채워주는 로직
                connection3.query(`SELECT * FROM \`${req.session.loginid}_pred\` WHERE \`nextprice\` is null AND 
                  \`code\` = '${rows1[j].code}';`
                  , (err, rows3) => {
                      for(let i in rows3){
                        // console.log(`${stockcode}의 nextprice 채워주는 로직 돌아감`) : 체크용 파트
                        rows3.map(x => dateform(x));
                        connection2.query(`SELECT \`endprice\`, \`date\` FROM \`${rows3[i].code}\` WHERE date_format(date,'%Y-%m-%d') = 
                        (SELECT MIN(\`date\`) FROM \`${rows3[i].code}\` WHERE date_format(date,'%Y-%m-%d') > '${rows3[i].date}');`
                          , (err, rows4) => {
                            if (err) {throw err;}
                            if(rows4[0]){ // rows4가 빈 배열이 아닐 경우. 즉 다음날 데이터가 있을 경우
                              // 가져온 다음날의 endprice를 넣어주기 위한 작업
                              connection3.query(`UPDATE \`${req.session.loginid}_pred\` SET \`nextprice\` = '${rows4[0].endprice}'
                              WHERE (\`id\` = '${rows3[i].id}');`, (err, rows5) => {
                                if (err) {throw err;}
                              });
                            }
                          });
                      }
                  });
              })
            }
            res.cookie('predicted',req.session.loginid,{maxAge: 1000 * 60 * 1, path:`/users/predict`}); // 쿠키 유효기간은 1분 (60sec)
            res.redirect('/users/predict')
        })
      }

  // 내 예측목록 출력하는 파트
  else {
    connection3.query(`SELECT * FROM \`${req.session.loginid}_pred\``
        , (err, rows) => {
          if (err) {
            throw err;
          }
          rows.map(x => dateform(x))
          res.render('mypred', {list: rows, loginid: req.session.loginid, page: 1, intype: req.cookies.intype})
        });
  }
});

router.get('/predict/:page', function(req, res) {
  if(req.session.loginid){
    connection3.query(`SELECT * FROM \`${req.session.loginid}_pred\``
        , (err, rows) => {
          if (err) {
            throw err;
          }
          rows.map(x => dateform(x))
          res.render('mypred', {list: rows, loginid: req.session.loginid, page: `${req.params.page}`, intype: req.cookies.intype})
        });
  } else {
    makeintype(res, '로그인이 되어있지 않습니다!');
    res.redirect('/')
  };
});

// 관심종목 리스트 페이지
router.get('/focus', function(req, res) {
  if(req.session.loginid){
    connection3.query(`SELECT * FROM \`${req.session.loginid}\``
        , (err, rows) => {
          if (err) {
            throw err;
          }
          res.render('myfoc', {list: rows, loginid: req.session.loginid, page: 1, intype: req.cookies.intype})
        });
  } else {
    makeintype(res, '로그인이 되어있지 않습니다!');
    res.redirect('/')
  };
});

router.get('/focus/:page', function(req, res) {
  if(req.session.loginid){
    connection3.query(`SELECT * FROM \`${req.session.loginid}\``
        , (err, rows) => {
          if (err) {
            throw err;
          }
          res.render('myfoc', {list: rows, loginid: req.session.loginid, page: `${req.params.page}`, intype: req.cookies.intype})
        });
  } else {
    makeintype(res, '로그인이 되어있지 않습니다!');
    res.redirect('/')
  };
});

// post로 입력받아온 종목코드를 관심종목에 insert하고, 전 페이지(목록 페이지)로 보내주는 페이지
router.post('/mylistfromlist', function(req, res, next){
  if(req.session.loginid == undefined){
    makeintype(res, '로그인이 되어있지 않습니다!');
    res.redirect(`/stockinfo/list/${req.body.type}?untype=${req.body.untype}&page=${req.body.page}`);
  } else {
    connection3.query(`SELECT EXISTS (SELECT * FROM \`${req.session.loginid}\` where \`code\` = '${req.body.code}') as success;`
        , (err, rows) => {
          if(rows[0].success == 1){
            makeintype(res, '이미 관심종목에 등록되어 있습니다!');
            res.redirect(`/stockinfo/list/${req.body.type}?untype=${req.body.untype}&page=${req.body.page}`);
          } else {
            connection3.query(`INSERT INTO \`${req.session.loginid}\` (\`code\`, \`name\`, \`info\`) 
              VALUES ('${req.body.code}', '${req.body.name}', '${req.body.info}');`, (err, rows) => {
              if (err) { throw err; }
              makeintype(res, '관심종목에 추가되었습니다!');
              res.redirect(`/stockinfo/list/${req.body.type}?untype=${req.body.untype}&page=${req.body.page}`);
              });
            }
    })
  }
});

// post로 입력받아온 종목코드를 관심종목에 insert하고, 전 페이지로 리다이렉트시키는 페이지
router.post('/mylist', function(req, res, next){
  if(req.session.loginid == undefined){
    makeintype(res, '로그인이 되어있지 않습니다!');
    res.redirect('back');
  } else {
    connection3.query(`SELECT EXISTS (SELECT * FROM \`${req.session.loginid}\` where \`code\` = '${req.body.code}') as success;`
        , (err, rows) => {
          if(rows[0].success == 1){
            makeintype(res, '이미 관심종목에 등록되어 있습니다!');
            res.redirect('back');
          } else {
            connection3.query(`INSERT INTO \`${req.session.loginid}\` (\`code\`, \`name\`, \`info\`) 
              VALUES ('${req.body.code}', '${req.body.name}', '${req.body.info}');`, (err, rows) => {
              if (err) { throw err; }
              makeintype(res, '관심종목에 추가되었습니다!');
              res.redirect('back');
              });
            }
    })
  }
  
});

// post로 입력받아온 종목코드를 관심종목에서 삭제하고, 전 페이지로 리다이렉트시키는 페이지
router.post('/mylistout', function(req, res){
  connection3.query(`DELETE FROM \`${req.session.loginid}\` WHERE (\`id\` = '${req.body.id}');`
        , (err, rows) => {
          if (err) {
            throw err;
          }
          makeintype(res, '관심종목에서 삭제되었습니다!');
          res.redirect('back');
        });
  //req.body.code : 입력받아온 종목코드
  //if(req.session.loginid) : 세션으로 가져오는 로그인 아이디
});

// 내 예측 페이지에서 받아온 정보(code, date)를 바탕으로 나으 예측에서 데이터를 삭제하는 페이지
router.post('/mypredout', function(req, res){
  connection3.query(`DELETE FROM \`${req.session.loginid}_pred\` WHERE \`id\` = '${req.body.id}';`
        , (err, rows) => {
          if (err) {
            throw err;
          }
          makeintype(res, '내 예측에서 삭제되었습니다!');
          res.redirect('back');
        });
});

// 예측 DB에 넣어주는 페이지
router.post('/mypred', function(req, res, next){
  if(req.session.loginid == undefined){  
    makeintype(res, '로그인이 되어있지 않습니다!');
    res.redirect('back');
  } else {
    connection3.query(`INSERT INTO \`${req.session.loginid}_pred\` (\`code\`, \`name\`, \`date\`, \`dayprice\`, \`expectprice\`) 
      VALUES ('${req.body.code}', '${req.body.name}', '${req.body.date}', '${req.body.dayprice}', '${req.body.expectprice}');`
        , (err, rows) => {
          if (err) {
            throw err;
          }
          makeintype(res, '나의 예측에 추가되었습니다!');
          res.redirect('back');
        });
      }
  //req.body.code : 입력받아온 종목코드
  //if(req.session.loginid) : 세션으로 가져오는 로그인 아이디
});

module.exports = router;
