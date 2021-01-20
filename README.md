# Stockpredict
국내 증권시장의 다음 가격을 예측해 볼 수 있는 웹 사이트입니다.

## 회원 관리
회원가입, 이메일 인증,  ID-PW 찾기, 로그인, 로그아웃이 가능합니다.
* 회원가입
  - ID는 영문과 숫자로 구성된 8~20자리 문자열이어야 합니다.
  - 비밀번호는 8~20자리 숫자나 특수문자를 꼭 포함하는 문자열이어야 합니다.
  - 비밀번호는 일방향 암호화되어 저장됩니다.
  - 이메일 주소는 이메일 형식을 만족하여야 합니다.
  - 가입이 성공하면 DB에 아이디, 암호화된 비밀번호, 이메일 인증여부(auth) 및 서비스 제공을 위한 DB 테이블이 생성됩니다.
* 이메일 인증
  - nodemailer 미들웨어를 통해 인증 키를 이메일로 전송합니다.
* 로그인, 로그아웃
  - 세션을 활용하여 사용자 인증 기능이 구현됩니다.
  
## DB (MySQL)
* DB는 다음과 같이 구성되었습니다.
  ![DB 구조](https://docs.google.com/drawings/d/e/2PACX-1vQj6qQQ2-hHuEZhzZcNuSNkUtEpclMv6Nc5kDlxaw_2oFm29SZiHyenf8u_0vWtB-ZDS1JE_WVVjnAL/pub?w=1440&h=1080)

## 증권 리스트 페이지
  - DB에서 가져온 정보를 이용하여 페이지를 구성합니다.
  - KOSPI, KOSDAQ의 모든 종목을 보여줍니다.
  - 나의 관심종목에 추가/제거할 수 있습니다.
  - 종목 이름을 검색할 수 있습니다.
  ![증권 목록 페이지](https://docs.google.com/drawings/d/e/2PACX-1vQ0KyQ3d4isKzmlwl3qCKEaGqZA49dXDARjwRBBB-W2Ll6v9U_OS0QPD4qDj7_MnIFSsNNWYR53xpKV/pub?w=1440&h=1080)
  
## 관심종목 페이지
  - 개인별 관심종목 테이블에서 가져온 정보를 이용하여 페이지를 구성합니다.
  - 관심종목을 제거할 수 있습니다.
  
## 나의 예측 페이지
  - 개인별 예측정보 테이블에서 가져온 정보를 이용하여 페이지를 구성합니다.
  - 예측한 종목정보, 예측 날짜, 예측당시 가격, 예측한 가격, 다음날의 가격 등의 정보를 제공합니다.
  - 다음 가격(nextprice)값이 비어있을 경우 해당 종목의 DB를 갱신하고 nextprice값을 갱신합니다.
  ![나의 예측 페이지](https://docs.google.com/drawings/d/e/2PACX-1vSKJXdBAxJQKmCgF0XUO775BIHqs0taToFuWxhcTiwzX9FQ_X9Pn7pKInXDTm8muKxEyD638yQVG_hh/pub?w=1440&h=1080)

## 종목 정보 페이지
  - 단일 종목에 대한 정보를 제공합니다.
  - 관심종목 추가/제거, 다음 가격 예측이 가능합니다.
  - 종목정보는 네이버 증권 페이지에서 최근 50일의 가격을 가져옵니다.
  - 제공되는 차트는 chart.js 미들웨어를 통해 최근 30일 가격추이를 보여줍니다.
  ![종목 정보 페이지](https://docs.google.com/drawings/d/e/2PACX-1vTgOFs84UID1w66y_dM3zlXD68hg-1uzUG6GVykI9k22y6VC5JYdLGERdnbwTkHlj46IUGjuIHolmwk/pub?w=1440&h=1080)
