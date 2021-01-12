
// turnonlog : 로그인창 하나만 켜줌
const turnonlog = () => {
    document.getElementById(`login`).style.visibility = 'visible';
    }; 

// turnoff : 창 다 꺼버림
const turnoffall = () => {
    document.getElementById(`login`).style.visibility = 'hidden';
    document.getElementById(`signup`).style.visibility = 'hidden';
    document.getElementById(`findidpw`).style.visibility = 'hidden';
    };

// turnonsign : 로그인창 끄고, 회원가입창 켜게
const turnonsign = () => {
    document.getElementById(`signup`).style.visibility = 'visible';
    document.getElementById(`login`).style.visibility = 'hidden';
    }; 

// turnonfindidpw : 로그인창 끄고, 회원가입창 켜게
const turnonfindidpw = () => {
    document.getElementById(`findidpw`).style.visibility = 'visible';
    document.getElementById(`login`).style.visibility = 'hidden';
    }; 