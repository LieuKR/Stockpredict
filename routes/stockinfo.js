var express = require('express');
var router = express.Router();
const request = require('request'); // for html crawling
const iconv = require('iconv-lite'); // for charset change EUC-KR to UTF-8
const charset = require('charset'); // 헤더에 있는 charset 값을 알수있음
const cheerio = require('cheerio'); // html 데이터로부터 원하는 값을 파싱하기 위한 모듈
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

function dateform(array) { // date : 날짜값. Thu Nov 19 2020 00:00:00 GMT+0900 (GMT+09:00) 요론모양을 2020-10-12 이런모양으로 가공해주는 함수
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

// 주식목록 페이지. 주소 입력을 받아서 들어올 경우
router.get('/list', function(req, res) {
  connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`KOSPI\` ORDER BY \`name\`;`, (err, rows) => {
    res.render('stocklist', {type: 'KOSPI', untype:'KOSDAQ', list: rows, page: 1, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
  })
});

// 주식목록 페이지로 post로 들어올 경우.
router.post('/list', function(req, res) {
  connection2.query(`SELECT \`name\`, \`code\`, \`info\` FROM \`${req.body.type}\` ORDER BY \`name\`;`, (err, rows) => {
    if(req.body.page == undefined){
      res.render('stocklist', {type:req.body.type, untype:req.body.untype, list: rows, page: 1, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
    } else {
      res.render('stocklist', {type:req.body.type, untype:req.body.untype, list: rows, page:req.body.page, loginid: req.session.loginid, intype: req.cookies.intype, loginnonauth: req.session.email});
    }
  })
});

// 페이징 처리를 위한 파트
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


// 종목 상세정보 페이지. 최근 며칠 주가, 그래프, 예측버튼, 관심종목 추가등이 필요하고,
// 그 페이지로 들어갔을때 주가정보를 크롤링해와야 한다.
// :code에 해당하는 값 : req.params.code에 들어간다. ex) /stockinfo/003942  => 003942 = req.params.code
router.get('/:code', function(req, res){
    connection2.query(`CREATE TABLE IF NOT EXISTS \`${req.params.code}\` (
    \`id\` MEDIUMINT NOT NULL AUTO_INCREMENT,
    \`date\` DATE NULL UNIQUE, \`endprice\` INT NULL, PRIMARY KEY (\`id\`));`
    , (err, rows) => {
      if(err) throw err;
      }); // table가 없으면 만들어 준다.

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
    today = maketoday(); // today값 정해진 형식으로 가져옴

    if(req.cookies.crawled !== req.params.code){ //크롤링한 쿠키가 남아있지 않을 때 작동하는 if문
      function crawlpage() {
        // 쿠키생성. 1분동안 이 작업을 반복 안하도록
        res.cookie('crawled', `${req.params.code}` ,{maxAge: 1000 * 60 * 3, path:`/`}); // 쿠키의 유효기간은 1분
        return new Promise(resolve => {
          for (let i = 1; i < 5; i++){
            let url = `https://finance.naver.com/item/sise_day.nhn?code=${req.params.code}&page=${i}`;
            request({url, 
              headers: { 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36' },
              encoding: null}, function(error, response, body){
              let char = charset(res.headers, body); // iconv.decode(body, char) 가져온 데이터. 이 값을 파싱해서 원하는 데이터 형태로 가공해야 함.
              let $ = cheerio.load(`${iconv.decode(body, char)}`);
              let $dailyinfo = $('body > table.type2 > tbody > tr');
              $dailyinfo.each((i, item) => {
                if($(item).find('td:nth-child(1) > span').text() !== ''){ // 날짜와 종가가 있는 부분만 거르는 망
                      connection2.query(`INSERT INTO \`${req.params.code}\` (\`date\`, \`endprice\`) 
                      SELECT '${$(item).find('td:nth-child(1) span').text()}', 
                        '${$(item).find('td:nth-child(2) span').text().replace(/,/g, '')}'
                      FROM DUAL WHERE NOT EXISTS (
                        SELECT \`date\` FROM \`${req.params.code}\` WHERE \`date\` = '${$(item).find('td:nth-child(1) span').text()}'
                      );` , (err, rows) => {
                            if(err) throw err
                            });
                    };
                  if(i == 1 && today == $(item).find('td:nth-child(1) span').text()) { //오늘 날짜만 없으면 넣고, 있으면 새값을 덮어씌움. 
                    // if문 따로 뺀 이유는 효율성을 위해서.
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
          setTimeout(() => {
            resolve('resolved');
          }, 50); // 크롤링까지 걸리는 시간. 위 프로미스에 0.05초 제한을 준거랑 다를바 없음
        });
      };
      async function datacrawl() {
        let result = await crawlpage();
        res.redirect(`/stockinfo/${req.params.code}`); // 위 작업을 다한 뒤 다시 이 페이지로.
      }
      datacrawl();
    } else {
        // 쿠키가 존재할 경우 들여보냄. KOSPI일때, KOSDAQ일 경우를 나눴음.
        // 위 if문이 다 돌고 난 뒤 이 부분으로 들어올 것이다
      connection2.query(`SELECT EXISTS (SELECT * FROM \`KOSPI\` WHERE \`code\`=${req.params.code}) as success;`, 
      (err, rows) => {
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