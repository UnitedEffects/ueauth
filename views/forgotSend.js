window.addEventListener( "load", function () {
    function sendData(FD) {
        const XHR = new XMLHttpRequest();
        XHR.addEventListener( "load", function(event) {
            if (event.target.status !== 204) {
                document.getElementById('message').classList.add('error');
                document.getElementById("title").innerHTML = "Uh oh...";
                document.getElementById("message").innerHTML = "Verification or reset was not successful. Your reset or verification window may have expired. Click below to resend the email";
                form.remove();
                document.getElementById('tryAgain').classList.remove('invisible');
            } else {
                document.getElementById("title").innerHTML = "Successful Verification And Reset";
                document.getElementById('message').classList.add('success');
                if(redirect && redirect !== '') {
                    form.remove();
                    document.getElementById("gotoSite").classList.remove("invisible");
                    document.getElementById("message").innerHTML = "Your password is set. Click below to continue."
                }
                else {
                    document.getElementById("message").innerHTML = "Your password is set. Go to your login screen to try it out."
                    form.remove();
                }
            }
        } );
        XHR.addEventListener( "error", function( event ) {
            document.getElementById('message').classList.add('error');
            document.getElementById("title").innerHTML = "Uh oh...";
            document.getElementById("message").innerHTML = "Verification or reset was not successful. Try again in a bit or contact the admin";
        } );
        XHR.open( "POST", url);
        XHR.setRequestHeader('authorization', `bearer ${iat}`);
        XHR.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        XHR.send( JSON.stringify({ "password": `${FD.get('password')}` }) );
    }
    function resend(FD) {
        const XHR = new XMLHttpRequest();
        XHR.addEventListener( "load", function(event) {
            if (event.target.status !== 204) {
                document.getElementById('message').classList.add('error');
                document.getElementById("title").innerHTML = "Uh oh...";
                document.getElementById("message").innerHTML = "There may be a problem. Try again later or contact the admin.";
            } else {
                document.getElementById("title").innerHTML = "Check Your Email or Mobile Device";
                document.getElementById('message').classList.add('success');
            }
        } );
        XHR.addEventListener( "error", function( event ) {
            document.getElementById('message').classList.add('error');
            document.getElementById("title").innerHTML = "Uh oh...";
            document.getElementById("message").innerHTML = "There may be a problem. Try again later or contact the admin.";
        } );
        XHR.open( "POST", retryUrl);
        XHR.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        XHR.send( JSON.stringify( {
            "email": FD.get('email')
        }) );
    }
    const form = document.getElementById( "forgot" );
    form.addEventListener( "submit", function ( event ) {
        const el = document.getElementById("message");
        el.classList.remove('error');
        event.preventDefault();
        const data = new FormData(this);
        if(data.get('password') !== data.get('confirm-password')) {
            el.innerHTML = "PASSWORDS DO NOT MATCH";
            el.classList.add('error');
        } else sendData(data);
    });
    const retry = document.getElementById( "tryAgain");
    retry.addEventListener( "submit", function ( event ) {
        const data = new FormData(this);
        resend(data);
    });
} );