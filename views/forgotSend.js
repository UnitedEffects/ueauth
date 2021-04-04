window.addEventListener( "load", function () {
    function sendData(FD) {
        const XHR = new XMLHttpRequest();
        XHR.addEventListener( "load", function(event) {
            if (event.target.status !== 204) {
                alert( 'There is a problem. Your reset window may have expired. Please try again or contact the admin' );
                //todo redirect to an error page...
            } else {
                document.getElementById("title").innerHTML = "Successful Reset";
                if(redirect && redirect !== '') {
                    form.remove();
                    document.getElementById("gotoSite").classList.remove("visible");
                    document.getElementById("message").innerHTML = "Your password is changed. Click below to continue."
                }
                else {
                    document.getElementById("message").innerHTML = "Your password is changed. Go to your login screen to try it out."
                    form.remove();
                }
            }
        } );
        XHR.addEventListener( "error", function( event ) {
            alert( 'There is a problem, please try again later. If this continues, contact the admin' );
            //todo redirect to an error page...
        } );
        XHR.open( "POST", url);
        XHR.setRequestHeader('authorization', `bearer ${iat}`);
        XHR.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        XHR.send( JSON.stringify({ "password": `${FD.get('password')}` }) );
    }
    const form = document.getElementById( "forgot" );
    form.addEventListener( "submit", function ( event ) {
        event.preventDefault();
        const data = new FormData(this);
        sendData(data);
    } );
} );