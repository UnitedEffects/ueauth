const http = require('http');

const requestListener = function (req, res) {
    console.info(`Recieved request - ${req.method}`);
    if(req.method === 'POST') {
        console.info('Request Body:');
        let json = '';
        req.on('data', function (chunk){
            json += chunk.toString('utf8');
        });
        req.on('end', function (){
            console.info(JSON.parse(json));
        });
    }
	res.writeHead(200);
	res.end('test response ok');
};

const server = http.createServer(requestListener);
server.listen(8080);