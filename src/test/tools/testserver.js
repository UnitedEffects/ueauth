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
			try {
				console.info(json);
				console.info(JSON.stringify(JSON.parse(json), null, 2));
			} catch (e) {
				console.error('ERROR', e);
			}
		});
		console.info('headers....');
		console.info(req.headers);
	}
	res.writeHead(200);
	res.end('test response');
};

const server = http.createServer(requestListener);
server.listen(8080);