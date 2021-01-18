const { xml } = require('cheerio');
var express = require('express');
var router = express.Router();
const mysql = require('mysql');
const charset = require('charset');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const request = require('request');

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

connection1.connect();
connection2.connect();
connection3.connect();

function makeintype(res, cookieinfo) {
  res.cookie('intype', cookieinfo ,{maxAge: 1000 * 1});
}

function dateform(array) {
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

/* 나의 예측 페이지
  1. 내 예측중 nextprice가 비어있는 쿼리를 찾음
  2. 그 종목 code에 대하여 nextprice를 채우기 위한 데이터를 가져온다
   2-1. date가 today보다 작고, nextprice가 비어있으면 데이터 파싱을 시도
   2-2. 데이터 파싱을 하면 쿠키를 이용, 같은작업 반복하지 않게
  3. db의 nextprice부분을 채워넣어준다
  4. 나의 예측 페이지 출력 */
router.get('/predict', function(req, res) {

  // YYYY-MM-DD 형식의 today값
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

  // 크롤링 함수
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
  } // 이하 로직이 돌아갔다는 쿠키가 없을 때
  else if(req.cookies.predicted == undefined){
    connection3.query(`SELECT distinct \`code\` FROM \`${req.session.loginid}_pred\` WHERE \`nextprice\` is null;`
        , (err, rows1) => {
          for(let j in rows1){
            // rows1[j].code : nextprice가 비어있는 종목code
            let stockcode = rows1[j].code
              // 오늘 데이터가 존재하는지 체크
            connection2.query(`SELECT EXISTS (SELECT \`date\` from \`${rows1[j].code}\`  
              where \`date\` = '${today}') as success;`, (err,rows2) => {
                // 오늘 데이터가 존재하지 않을 경우
                if(rows2[0].success == 0) {
                  async function datacrawl(code) {
                    let result = await crawlpage(code);
                    }
                  datacrawl(stockcode);
                };
                // 비어있는 nextprice를 채워주는 파트
                connection3.query(`SELECT * FROM \`${req.session.loginid}_pred\` WHERE \`nextprice\` is null AND 
                  \`code\` = '${rows1[j].code}';`
                  , (err, rows3) => {
                      for(let i in rows3){
                        rows3.map(x => dateform(x));
                        connection2.query(`SELECT \`endprice\`, \`date\` FROM \`${rows3[i].code}\` WHERE date_format(date,'%Y-%m-%d') = 
                        (SELECT MIN(\`date\`) FROM \`${rows3[i].code}\` WHERE date_format(date,'%Y-%m-%d') > '${rows3[i].date}');`
                          , (err, rows4) => {
                            if (err) {throw err;}
                            // 이후 날짜의 데이터가 있을 경우 ex)1일 예측한 값에 대해, 4일 데이터가 존재할 경우
                            // 이후 날짜의 endprice를 nextprice에 채워주는 부분
                            if(rows4[0]){
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

// 나의 예측 페이징 처리
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

// 관심종목 리스트 페이징
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

// '/stockinfo/list/:page' 에서 post된 종목 code값을 관심종목 db에 추가하고, 그 전 페이지로 다시 보내는 페이지
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

// post된 종목 code값을 관심종목 db에 추가하고, 이전 페이지로 리다이렉트시키는 페이지
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

// post된 종목 code값을 관심종목 db에서 삭제하고, 전 페이지로 리다이렉트시키는 페이지
router.post('/mylistout', function(req, res){
  connection3.query(`DELETE FROM \`${req.session.loginid}\` WHERE (\`id\` = '${req.body.id}');`
        , (err, rows) => {
          if (err) {
            throw err;
          }
          makeintype(res, '관심종목에서 삭제되었습니다!');
          res.redirect('back');
        });
});

// 나의 예측에서 데이터를 삭제하는 페이지
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

// 예측 DB에 추가하는 페이지
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
});

module.exports = router;