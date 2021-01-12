const errorrate = (a,b) => {
    let ans = (Math.abs((a - b) / b)*100).toFixed(1);
    document.write(ans);
    document.write('%');
}; // 정확도 계산 함수

const changerate = (a,b) => {
    let ans = ((Math.abs(a/b)-1)*100).toFixed(1);;
    if (a>b){
        document.write('(+');
    } else {
        document.write('(');
    }
    document.write(ans);
    document.write('%');
    document.write(')');
}; // 정확도 계산 함수

function getCookie(name) {
    let matches = document.cookie.match(new RegExp(
      "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
  }
// 정규표현식을 이용한 쿠키를 가져오는 함수. getcookie(name) : name의 값을 가져옴. 검색해서 복붙한 함수