window.addEventListener( 'load', async function () {
    (function() {
        $('#main').css({ 'padding-top': '65px'});
        if(qrCode) {
            console.info('QR CODE', qrCode);
            var qr = new QRious({
                element: document.getElementById('qrcode'),
                size: 500,
                value: qrCode.replace(/&amp;/g, '&')
            });
        }
    })();
});