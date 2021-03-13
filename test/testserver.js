const http = require('http');

const requestListener = function (req, res) {
    console.info(`Recieved request - ${req.method}`);
    if(req.method === 'POST') {
        console.info('Request Body:');
        console.info(req.body);
    }
	res.writeHead(200);
	res.end('test response ok');
};

const server = http.createServer(requestListener);
server.listen(8080);