var http = require('http'), fs = require('fs'),url = require('url');

function load_albums_list(callback){
	fs.readdir("albums", (err,files)=>{
		if(err){
			callback(err);
			return;
		}
		//Loop through to only get folders
		var only_dir = [];
		
		var iterator = (i) => {
			if(i == files.length){
				callback(null,only_dir);
				return;
			}

			fs.stat("albums/"+files[i], (err,stats)=>{
				if(err){
					callback(err);
					return;
				}
				if(stats.isDirectory()){
					only_dir.push(files[i]);
					
				}
				iterator(i+1);
			});
		};
		iterator(0);
	});
}

function load_album(folder,page_num,page_size,callback){
	fs.readdir("albums/"+folder, (err,files)=>{
		if(err){
			if(err.code === "ENOENT"){
				callback(no_such_album());
			}else{
				callback(make_error("file error",JSON.stringify(err)));
			}
			return;
		}

		//Loop through to only get files
		var only_files = [];
		
		var iterator = (i) => {
			if(i == files.length){
				var ps;
				var start = page_num*page_size;
				ps = only_files.slice(start,start + page_size);
				var obj = { short_name : folder, photos: ps}
				callback(null,obj);
				return;
			}

			fs.stat("albums/"+folder+"/"+files[i], (err,stats)=>{
				if(err){
					callback(err);
					return;
				}
				if(stats.isFile()){
					var obj = { filename : files[i],
								desc: files[i]};
					only_files.push(obj);
					
				}
				iterator(i+1);
			});
		};
		iterator(0);
	});
}

function handle_album_list_request(req,res){
	load_albums_list((err,files)=>{
		if(err){
			send_failure(res,500,err);
			return;
		}
		send_success(res,{
			albums:files
		});
	});
}

function handle_album_request(req,res){
	var getp = req.parsed_url.query;
	var page_num = getp.page ? parseInt(getp.page) : 0;
	var page_size = getp.page_size ? parseInt(getp.page_size) : 1000;

	if(isNaN(page_num)) page_num = 0;
	if(isNaN(page_size)) page_size = 1000;

	var core_url = req.parsed_url.pathname;

	var album_name = core_url.substr(8,core_url.length-13);
	load_album(album_name, page_num, page_size,(err,files) => {
		if(err&&err.error == "no_such_album"){
			send_failure(res,404,err);
		}else if(err){
			send_failure(res,500,err);
		}else{
			send_success(res,{album_data: files});
		}
	});
}

function handle_rename_album(req,res){
	var core_url = req.parsed_url.pathname;
	var parts = core_url.split('/');

	if (parts.length != 4){
		send_failure(res,404,invalid_resource());
		return;
	}

	var album_name = parts[2];

	var json_body = '';
	
	req.on('readable', ()=>{
		var d = req.read();
		if(d){
			if(typeof d === 'string')
				json_body+=d;
			else if(typeof d === 'object' && d instanceOf Buffer)
				json_body += d.toString('utf8');
		}
	});

	req.on('end',()=>{
		if(json_body){
			try{
				var album_data = JSON.parse(json_body);
				if(!album_data.album_name){
					send_failure(res,404,missing_data('album_name'));
					return;
				}
			}catch(e){
				send_failure(res,403,bad_json());
				return;
			}
			do_rename(album_name, album_data.album_name, (err,results) =>{
				if(err && err.code === "ENOENT"){
					send_failure(res,403,no_such_album());
					return;
				}else if(err){
					send_failure(res,500,file_error(err));
					return;
				}
				send_success(res,null);
			});
		}else{
			send_failure(res,403,bad_json());
			res.end();
		}
	});
}

function make_error(err,msg){
	var e = new Error(msg);
	e.code = err;
	return e;
}

function send_failure(res,errno,err){
	var code = err.code ? err.code : err.name;
	res.writeHead(errno, {
		'Content-Type' : 'application/json'
	});
	res.end(JSON.stringify({error: code, message:err.message}) + "\n");
}

function invalid_resource(){
	return make_error("invalid_resource","the requested resource does not exist.");
}

function no_such_album(){
	return make_error("no_such_album","The specified album does not exist");
}

function send_success(res,data){
	res.writeHead(200,{
		'Content-Type' : 'application/json'
	});
	var output = {error:null,data:data};
	res.end(JSON.stringify(output) + "\n");
}
function handle_incoming_request(req,res){
	req.parsed_url = url.parse(req.url,true);
	var core_url = req.parsed_url.pathname;
	console.log("Incoming request: " + req.method + " " + req.url);
	if(core_url ==  "/albums.json"){
		handle_album_list_request(req,res);
	}else if(core.url.substr(core_url.length-12) === '/rename.json' && req.method.toLowerCase() === 'post'){
		handle_rename_album(req,res);
	}else if(core_url.substr(0,7) === "/albums" && core_url.substr(core_url.length-5) === '.json'){
		handle_album_request(req,res);
	}else{
		send_failure(res,404,invalid_resource());
	}
}

var s = http.createServer(handle_incoming_request);
s.listen(8080);