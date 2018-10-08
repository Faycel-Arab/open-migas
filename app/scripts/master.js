const remote = require('electron').remote;
const fs = require('fs');
const path = require('path');
const exec = require('child_process').execFile;
const spawn = require('child_process').spawn;
const {Menu, MenuItem, dialog} = remote;
const trash = require('trash');
const deleteConfirmationDialog = require('../view/delete-dialog.js');
const vdom = require('virtual-dom');
const hyperx = require('hyperx');
const hx = hyperx(vdom.h);

var selected = new Selected('file-selected');

function init(){
	var win = remote.getCurrentWindow();

	function History(root){
		var history = root ? [root] : [];
		var position = 0;
		this.add = function(path){
			history.splice(position + 1);
			history.push(path);
			position = history.length - 1;
		}
		this.goBack = function(){
			if (position > 0) position--;
		}
		this.goForward = function(){
			if (position < history.length - 1) position++;
		}
		this.getCurrentLocation = function(){
			return history[position];
		}
		this.getHistoryPath = function(){
			return history;
		}
	}

	let history = new History();

	window.addEventListener('contextmenu', (e) => {
		e.preventDefault();
	})

	document.querySelector('#close-button').addEventListener('click', function(e){
		win.close();
	});

	document.querySelector("#maximize-button").addEventListener("click", function(e){
		if(win.isMaximized()){
			win.unmaximize();
		}else{
			win.maximize();
		}
	});

	document.querySelector("#minimize-button").addEventListener("click", function(e){
		win.minimize();
	});

	const root = {
		name: 'C:',
		fullname: 'C:\\',
		children: []
	};

	const tree = require('electron-tree-view')({
		root,
		container: document.querySelector('#folder-tree'),
		children: c => c.children,
		label: c => c.name,
		renderItem: (hx, data, children, loadHook, clickElem, createChild) => {
			return hx`<div class="" loaded=${loadHook}>
				<a href="#" class="clickable-elem" onclick=${clickElem}>
				<div>
					<span>${hx`<i class="icon-right-open chevron" />`} ${data.name}</span>
				</div>
				</a>
				<ul>
					${children.map(createChild)}
				</ul>
			</div>`
		}
	});

	tree.on('selected', function(ele){
		loadView(ele.fullname, (childElements) => {
			ele.children = childElements;
			history.add(ele.fullname);
			console.log(history.getHistoryPath());
			tree.loop.update({root});
		});
	});

	document.querySelector('#up').addEventListener('click', function(){
	//	updateLocation(explorerPath, '../');
	});

	document.querySelector('#reload').addEventListener('click', function(){
		loadView(history.getCurrentLocation(), function(childElements){
			tree.loop.update({root});
		});
	});

	win.on('resize', function(){
		if (win.isMaximized()){
			document.querySelector('#maximize-button').innerHTML = '<i class="icon-window-restore"></i>';
			document.querySelector('body').style.border = 'none';
		} else {
			document.querySelector('#maximize-button').innerHTML = '<i class="icon-window-maximize"></i>';
			document.querySelector('body').style.border = 'solid 5px #000';
		}
	});
}

function loadView(fullname, loaded){
	readFolder(fullname, (childFiles) => {
		let childElements = [];
		childFiles.forEach((item, index) => {
			if (item.stat.isDirectory()){
				childElements[index] = {
					name: item.name,
					fullname: path.resolve(fullname, item.name),
					children: []
				};
			}
		});
		updateLocation(fullname, childFiles, () => {
			//go to another location
		});
		loaded(childElements);
	});
}

function readFolder(location, done){
	let filesArr = [];
	fs.readdir(location, function(err, files){
		if (err) return console.error(err);
		files.forEach((item, index) => {
			try {
				let stat;
				stat = fs.statSync(path.resolve(location, item));
				filesArr[index] = {name: item, stat: stat};
			} catch(err) {
				console.error(err);
				return;
			}
		});
		done(filesArr);
	});
}

//updates files main view and breadcrumb bar
//callback called when user select another location
function updateLocation(location, files, callback){
	let filesContainer = document.querySelector('#explorer-container');
	filesContainer.innerHTML = '';
	files.forEach(function(file){
		//explorer main view item
		let fileItem = createExplorerItem(location, file.name, file.stat, callback);
		filesContainer.appendChild(fileItem);
	});
	updateBreadcrumbLocation(location, callback);
}

//breadcrumb bar location
function updateBreadcrumbLocation(location, callback){
	let breadcrumbBar = document.querySelector('#breadcrumb-bar');
	let splitLocation = location.split(path.sep);

	//remove empty string
	if (splitLocation[splitLocation.length - 1] === '') splitLocation.splice(-1, 1);
	//clear bar
	breadcrumbBar.innerHTML = '';

	splitLocation.forEach(function(item, index){
		let locationSubfolder = document.createElement('span');
		locationSubfolder.setAttribute('class', 'location-element');

		locationSubfolder.innerHTML = item;

		//get current iteration location
		let locationSliced = splitLocation.slice(0, index + 1);
		let itemLocation = locationSliced.join(path.sep);

		locationSubfolder.addEventListener('click', function(e){
			callback(itemLocation);
		});

		breadcrumbBar.appendChild(locationSubfolder);

		//add a separator
		if (index < splitLocation.length - 1){
			let itemSeparator = document.createElement('span');
			itemSeparator.setAttribute('class', 'location-separator');
			itemSeparator.innerHTML = '<i class="icon-right-open"></i>';
			breadcrumbBar.appendChild(itemSeparator);
		}
	});
}

//main explorer view items
function createExplorerItem(location, name, stat, goto){
	var ele = document.createElement('span');
	let fullname = path.resolve(location, name);
	ele.innerHTML = name;

	if (stat.isFile()){
		let open = function(){
			let child = exec('explorer', [fullname], (err, stdout, stderr) => {
				if (err){
					console.error(err);
				}
			});
		}

		ele.addEventListener('dblclick', function(e){
			open();
		});

		ele.addEventListener('contextmenu', function(e){
			let template = createFileContextMenu(fullname, open);
			const menu = Menu.buildFromTemplate(template);
			menu.popup({window: remote.getCurrentWindow()});
		});
		ele.innerHTML = '<i class="icon-doc element-item-icon file-icon"></i>' + name;
	} else if (stat.isDirectory()){
		ele.addEventListener('contextmenu', function(e){
			let template = createFolderContextMenu(fullname, function(){console.log('open folder')});
			const menu = Menu.buildFromTemplate(template);
			menu.popup({window: remote.getCurrentWindow()});
		});
		ele.innerHTML = '<i class="icon-folder-open element-item-icon folder-icon"></i>' + name;
	}

	ele.addEventListener('dblclick', function(e){
		if (stat.isFile()){
			//open with default program
		} else if (stat.isDirectory()){
			//open this folder
			//goto location
		}
	});

	function openFile(){

	}

	return ele;
}

function createFolderContextMenu(folderFullname, open, del){
	return [
		{
			label: 'Open',
			click: () => {open()}
		},
		{
			label: 'Open in terminal',
			click: () => {
				spawn(path.resolve(__dirname, '../', 'bin', 'open-terminal.cmd'), [folderFullname]);
			}
		},
		{
			type: 'separator'
		},
		{
			label: 'Cut',
			accelerator: 'Ctrl+X',
			click: () => {console.log('cut')}
		},
		{
			label: 'Copy',
			accelerator: 'Ctrl+C',
			click: () => {console.log('copy')}
		},
		{
			label: 'Paste',
			accelerator: 'Ctrl+V',
			click: () => {console.log('paste')}
		},
		{
			label: 'Delete',
			accelerator: 'Delete',
			click: () => {
				deleteConfirmationDialog(dialog, file, stat, (res) => {
					console.log(res);
				/*	trash([fileName]).then(() => {
						updateLocation(explorerPath);
						console.log('done');
					});*/
				});
			}
		}
	];
}

function createFileContextMenu(fileFullname, open, del){
	return [
		{
			label: 'Open',
			click: () => {open()}
		},
		{
			type: 'separator'
		},
		{
			label: 'Cut',
			accelerator: 'Ctrl+X',
			click: () => {console.log('cut')}
		},
		{
			label: 'Copy',
			accelerator: 'Ctrl+C',
			click: () => {console.log('copy')}
		},
		{
			label: 'Paste',
			accelerator: 'Ctrl+V',
			click: () => {console.log('paste')}
		},
		{
			label: 'Delete',
			accelerator: 'Delete',
			click: () => {
				deleteConfirmationDialog(dialog, file, stat, (res) => {
					console.log(res);
					/*	trash([fileName]).then(() => {
							updateLocation(explorerPath);
							console.log('done');
						});*/
				});
			}
		}
	];
}


/*
function updateLocation(explorerPath, targetDir, parentFolder){
	var locationString = explorerPath[explorerPath.length - 1];

	if (targetDir) {
		locationString = path.resolve(explorerPath[explorerPath.length - 1], targetDir);
	}

	fs.readdir(locationString, function(err, files){
		if (err) {
			return console.error(err);
		}

		appendFiles(explorerPath, files, parentFolder);
		explorerPath.push(locationString);

		
	});
}*/

/*
function appendFiles(explorerPath, files, parentFolder){
	let navigationContainer = document.querySelector('#navigation-container');
	let subfolderContainer = document.createElement('ul');

	subfolderContainer.classList.add('subfolder');
	explorerContainer.innerHTML = '';

	setTimeout(function(){
		files.forEach(function(file){
			let fileName = path.resolve(explorerPath[explorerPath.length - 1], file);
			let span = document.createElement('span');
			let stat;
			let open;

			try {
				stat = fs.statSync(fileName);
			} catch (err) {
				return console.error(err);
			}

			if (stat.isFile()){
				open = function(){
					let child = exec('explorer', [fileName], (err, stdout, stderr) => {
						if (err){
							console.error(err);
						}
					});
				}

				span.addEventListener('dblclick', function(e){
					open();
				});
				
				span.innerHTML = '<img src="img/file-icon.png" class="icon">' + file;
			}

			if (stat.isDirectory()){
				let listElement = document.createElement('li');

				open = function(){
					updateLocation(explorerPath, file, listElement);
				}

				//side nav folder structure
				let folderName = document.createElement('span');
				folderName.innerHTML = file;
				listElement.addEventListener('dblclick', function(e){
					updateLocation(explorerPath, file, listElement);
				});

				listElement.appendChild(folderName);
				subfolderContainer.appendChild(listElement);
				parentFolder.appendChild(subfolderContainer);
			//	navigationContainer.appendChild(sideNavFolder);

				//explorer folders
				span.innerHTML = '<img src="img/folder-icon.png" class="icon">' + file;
				//add event listener
				span.addEventListener('dblclick', function(e){
					open();
				});
			}

			span.addEventListener('click', function(e){
				selected.clearAndAdd(span);
			});

			span.addEventListener('contextmenu', (e) => {
				selected.clearAndAdd(span);
				let template;
				if (stat.isDirectory()){
					template = [
						{
							label: 'Open',
							click: () => {open()}
						},
						{
							label: 'Open in terminal',
							click: () => {
								spawn(path.resolve(__dirname, '../', 'bin', 'open-terminal.cmd'), [fileName]);
							}
						},
						{
							type: 'separator'
						},
						{
							label: 'Cut',
							accelerator: 'Ctrl+X',
							click: () => {console.log('cut')}
						},
						{
							label: 'Copy',
							accelerator: 'Ctrl+C',
							click: () => {console.log('copy')}
						},
						{
							label: 'Paste',
							accelerator: 'Ctrl+V',
							click: () => {console.log('paste')}
						},
						{
							label: 'Delete',
							accelerator: 'Delete',
							click: () => {
								deleteConfirmationDialog(dialog, file, stat, (res) => {
									console.log(res);
								/*	trash([fileName]).then(() => {
										updateLocation(explorerPath);
										console.log('done');
									});*//*
								});
							}
						}
					];
				}
				if (stat.isFile()){
					template = [
						{
							label: 'Open',
							click: () => {open()}
						},
						{
							type: 'separator'
						},
						{
							label: 'Cut',
							accelerator: 'Ctrl+X',
							click: () => {console.log('cut')}
						},
						{
							label: 'Copy',
							accelerator: 'Ctrl+C',
							click: () => {console.log('copy')}
						},
						{
							label: 'Paste',
							accelerator: 'Ctrl+V',
							click: () => {console.log('paste')}
						},
						{
							label: 'Delete',
							accelerator: 'Delete',
							click: () => {
								deleteConfirmationDialog(dialog, file, stat, (res) => {
									console.log(res);
									/*	trash([fileName]).then(() => {
											updateLocation(explorerPath);
											console.log('done');
										});*//*
								});
							}
						}
					];
				}
				const menu = Menu.buildFromTemplate(template);
				menu.popup({window: remote.getCurrentWindow()});
			}, false);

			explorerContainer.appendChild(span);
		});
	}, 0);
}
*/

function Selected(className){
	var elements = [];

	this.add = function(ele){
		elements.push(ele);
		ele.classList.add(className);
	}

	this.remove = function(ele){
		let index = elements.indexOf(ele);
		if (index >= 0){
			ele.classList.remove(className);
			elements.splice(index, 1);
		}
	}

	this.clearAll = function(){
		elements.forEach(function(el){
			el.classList.remove(className);
		});
		elements = [];
	}

	this.clearAndAdd = function(ele){
		this.clearAll();
		this.add(ele);
	}

	this.isSelected = function(ele){
		if(elements.indexOf(ele) >= 0) return true;
	}

	this.getSelectedElements = function(){
		return elements;
	}
}

document.onreadystatechange = function(){
	if (document.readyState === 'complete'){
		init();
	}
}