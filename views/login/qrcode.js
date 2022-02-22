window.addEventListener( 'load', async function () {
    (function() {
        $('#main').css({ 'padding-top': '65px'});
        if(qrCode) {
            var qr = new QRious({
                element: document.getElementById('qrcode'),
                size: 500,
                value: qrCode
            });
        }
    })();
});