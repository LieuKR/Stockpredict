var express = require('express');
var router = express.Router();
const request = require('request');
const iconv = require('iconv-lite');
const charset = require('charset');
const cheerio = require('cheerio');
const mysql = require('mysql');

const dbconfig  = require('../config/dbsetting.json');

const connection2 = mysql.createConnection({
  host: dbconfig.host,
  port: dbconfig.port,
  user: dbconfig.user,
  password: dbconfig.password,
  database: dbconfig.database2
});

connection2.connect();

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

// 주식목록 페이지. get방식
router.get('/list', function(req, res) {
  connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`KOSPI\` ORDER BY \`name\`;`, (err, rows) => {
    res.render('stocklist', {type: 'KOSPI', untype:'KOSDAQ', list: rows, page: 1, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  })
});

// 주식목록 페이지. post방식
router.post('/list', function(req, res) {
  connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`${req.body.type}\` ORDER BY \`name\`;`, (err, rows) => {
    if(req.body.page == undefined){
      res.render('stocklist', {type:req.body.type, untype:req.body.untype, list: rows, page: 1, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
    } else {
      res.render('stocklist', {type:req.body.type, untype:req.body.untype, list: rows, page:req.body.page, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
    }
  })
});

// 페이징 처리 파트
router.get('/list/:type', function(req, res) {
  connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`${req.params.type}\` ORDER BY \`name\`;`, (err, rows) => {
    res.render('stocklist', {type:req.params.type, untype:req.query.untype, list: rows, page:req.query.page, 
      loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  })
});

// 검색기능 파트
router.get('/search', function(req, res, next) {
  connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`${req.query.type}\` WHERE \`name\` LIKE '%${req.query.keyword}%' 
    ORDER BY \`name\`;`, (err, rows) => {
    if(err) throw err;
    if(req.query.type == 'KOSPI'){
      res.render('searchlist', {type: `${req.query.type}`, untype:'KOSDAQ', keyword: `${req.query.keyword}`, list: rows, page: 1, 
      loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
      } else {
        res.render('searchlist', {type: `${req.query.type}`, untype:'KOSPI', keyword: `${req.query.keyword}`, list: rows, page: 1, 
        loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
      }
    }
  )
});


/* 종목 상세정보
    1. 주가 데이터는 네이버 증권 페이지에서 크롤링.
      1-1. 크롤링 데이터는 최소화
      1-2. 쿠키를 이용, 같은 작업을 반복하지 않게 제한
      1-3. 오늘 데이터만 따로 갱신하는 쿼리문 작성(금일 데이터의 최신화를 위해)
    2. 
*/
router.get('/:code', function(req, res){
    // code에 해당하는 table가 없으면 table생성
    connection2.query(`CREATE TABLE IF NOT EXISTS \`${req.params.code}\` (
    \`id\` MEDIUMINT NOT NULL AUTO_INCREMENT,
    \`date\` DATE NULL UNIQUE, \`endprice\` INT NULL, PRIMARY KEY (\`id\`));`
    , (err, rows) => {
      if(err) throw err;
      }); 

    // YYYY-MM-DD형식의 today값
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

    // 쿠키를 이용, 작업 반복 안하도록
    if(req.cookies.crawled !== req.params.code){
      function crawlpage() {
        // 작업을 반복하지 않기 위한 쿠키 생성. 유효기간 2분
        res.cookie('crawled', `${req.params.code}` ,{maxAge: 1000 * 60 * 2, path:`/`});
        // 데이터 크롤링. 최신 50일치 데이터를 db에 넣어주는 과정
        return new Promise(resolve => {
          for (let i = 1; i < 5; i++){
            let url = `https://finance.naver.com/item/sise_day.nhn?code=${req.params.code}&page=${i}`;
            request({url, 
              headers: { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36' },
              encoding: null}, function(error, response, body){
              let char = charset(res.headers, body);
              let $ = cheerio.load(`${iconv.decode(body, char)}`);
              let $dailyinfo = $('body > table.type2 > tbody > tr');
              $dailyinfo.each((i, item) => {
                // 날짜와 종가가 있는 부분만 사용
                if($(item).find('td:nth-child(1) > span').text() !== ''){ 
                      connection2.query(`INSERT INTO \`${req.params.code}\` (\`date\`, \`endprice\`) 
                      SELECT '${$(item).find('td:nth-child(1) span').text()}', 
                        '${$(item).find('td:nth-child(2) span').text().replace(/,/g, '')}'
                      FROM DUAL WHERE NOT EXISTS (
                        SELECT \`date\` FROM \`${req.params.code}\` WHERE \`date\` = '${$(item).find('td:nth-child(1) span').text()}'
                      );` , (err, rows) => {
                            if(err) throw err
                            });
                    };
                  // 오늘 날짜만, 데이터가 없으면 insert, 존재하면 덮어씌움.
                  if(i == 1 && today == $(item).find('td:nth-child(1) span').text()) {
                    connection2.query(`INSERT INTO \`${req.params.code}\` (\`date\`, \`endprice\`) VALUES
                      ('${$(item).find('td:nth-child(1) span').text()}', 
                      '${$(item).find('td:nth-child(2) span').text().replace(/,/g, '')}') ON DUPLICATE 
                      KEY UPDATE \`endprice\` = VALUES(\`endprice\`);`), (err, rows) => {
                      if(err) throw err
                    };
                  };
              });
            });
          };
           // 크롤링에 걸리는 시간제한
          setTimeout(() => {
            resolve('resolved');
          }, 50);
        });
      };
      async function datacrawl() {
        let result = await crawlpage();
        res.redirect(`/stockinfo/${req.params.code}`);
      }
      datacrawl();
    } else {
      // 위 if문이 끝난 뒤 redirect되며 이하 내용이 출력됨
      connection2.query(`SELECT EXISTS (SELECT * FROM \`KOSPI\` WHERE \`code\`=${req.params.code}) as success;`, 
      (err, rows) => {
        // 종목이 kospi일 경우
        if(rows[0].success == 1) {
          connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`KOSPI\` WHERE \`code\` = ${req.params.code};`, 
          (err, rows) => {
            connection2.query(`SELECT* FROM \`${req.params.code}\` ORDER BY \`date\` DESC LIMIT 30`, 
              (err, rows1) => {
                rows1.map(x => dateform(x));
                res.render('stockinfo', {info: rows, stockdata:rows1, type: 'KOSPI', loginid: req.session.loginid
                , intype: req.cookies.intype, loginnonauth: req.session.email})
              });
          });
        } else {
          // 종목이 kosdaq일 경우
          connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`KOSDAQ\` WHERE \`code\` = ${req.params.code};`, 
          (err, rows) => {
            connection2.query(`SELECT * FROM \`${req.params.code}\` ORDER BY \`date\` DESC LIMIT 30`, 
              (err, rows1) => {
                rows1.map(x => dateform(x));
                res.render('stockinfo', {info: rows, stockdata:rows1, type: 'KOSDAQ', loginid: req.session.loginid
                , intype: req.cookies.intype, loginnonauth: req.session.email})
              });
          });
        }
        if(err) throw err;
        });
      }
});

module.exports = router;