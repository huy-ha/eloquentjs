var http = require('http'), fs = require('fs');

function load_album_list(callback){
	fs.readdir("albums", (err,files)=>{
		if(err){
			callback(err);
			return;
		}
		callback(null,files);
	});
}

function process_request(req,res){
	console.log("Incoming request: " + req.method + " " + req.url);

	load_album_list((err,files)=>{
		if(err){
			res.writeHead(500, {
				'Content-Type' : 'application/json'
			});
			res.end(JSON.stringify(err) + "\n");
			return;
		}

		res.writeHead(200,{
			'Content-Type' : 'application/json'
		});
		var out = {
			error : null;
			data: {
				albums: files
			}
		};
		res.end(JSON.stringify(out) + "\n");
	});
}

var s = http.createServer(process_request);
s.listen(8080);