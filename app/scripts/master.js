const remote = require('electron').remote;
const fs = require('fs');
const path = require('path');
const exec = require('child_process').execFile;					
const {Menu, MenuItem} = remote;

var selected = new Selected('file-selected');

function init(){
	var win = remote.getCurrentWindow();
	let explorerPath = ['C:\\'];

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

	updateLocation(explorerPath);

	document.querySelector('#up').addEventListener('click', function(){
		updateLocation(explorerPath, '../');
	});

	document.querySelector('#reload').addEventListener('click', function(){
		updateLocation(explorerPath);
	});

	win.on('resize', function(){
		if (win.isMaximized()){
			document.querySelector('body').style.border = 'none';
		} else {
			document.querySelector('body').style.border = 'solid 5px #000';
		}
	});
}

function updateLocation(explorerPath, targetDir){
	var locationString = explorerPath[explorerPath.length - 1];

	if (targetDir) {
		locationString = path.resolve(explorerPath[explorerPath.length - 1], targetDir);
		explorerPath.push(locationString);
	}

	appendFiles(explorerPath);
	
	var pathContainer = document.querySelector('.path-container');
	pathContainer.innerHTML = '';
	var splitLocation = explorerPath[explorerPath.length - 1].split(path.sep);

	splitLocation.forEach(function(item, index){
		let locEl = document.createElement('span');
		locEl.setAttribute('class', 'location-element');

		locEl.innerHTML = item;

		//get current iteration location
		let locationSliced = splitLocation.slice(0, index + 1);
		let currLocation = locationSliced.join(path.sep);

		locEl.addEventListener('click', function(e){
			//fix C location to be at root
			locationSliced.length === 1 ? explorerPath.push('C:\\') : explorerPath.push(currLocation);
			updateLocation(explorerPath);
		});

		pathContainer.appendChild(locEl);

		if (index < splitLocation.length - 1){
			let locSep = document.createElement('span');
			locSep.setAttribute('class', 'location-separator');
			pathContainer.appendChild(locSep);
		}
	});
}

function appendFiles(explorerPath){
	fs.readdir(explorerPath[explorerPath.length - 1], function(err, files){
		if (err) {
			return console.error(err);
		}

		let explorerContainer = document.querySelector('#explorer-container');
		let navigationContainer = document.querySelector('#navigation-container');

		explorerContainer.innerHTML = '';
		navigationContainer.innerHTML = '';

		setTimeout(function(){
			files.forEach(function(file){
				let fileName = path.resolve(explorerPath[explorerPath.length - 1], file);
				let span = document.createElement('span');
				let stat;

				try {
					stat = fs.statSync(fileName);
				} catch (err) {
					return console.error(err);
				}

				span.addEventListener('dblclick', function(e){
					if (stat.isFile()) {
						let child = exec('explorer', [fileName], (err, stdout, stderr) => {
							if (err){
								console.error(err);
							}
						});
					}
				});

				span.addEventListener('click', function(e){
					selected.clearAndAdd(span);
				});

				span.addEventListener('contextmenu', (e) => {
					selected.clearAndAdd(span);
					
					const template = [
						{
							label: 'Open'
						},
						{
							type: 'separator'
						},
						{
							label: 'Undo',
							accelerator: 'Ctrl+Z',
							click: () => {console.log('undo')}
						},
						{
							label: 'Redo',
							accelerator: 'Ctrl+Y',
							click: () => {console.log('redo')}
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
							click: () => {console.log('delete')}
						}
					];
					const menu = Menu.buildFromTemplate(template);
					menu.popup({window: remote.getCurrentWindow()});
				}, false);

				if (stat.isDirectory()){
					//side nav folder structure
					let sideNavFolder = document.createElement('span');
					sideNavFolder.innerHTML = '<img src="img/folder-icon.png" class="icon">' + file;
					sideNavFolder.addEventListener('dblclick', function(e){
						updateLocation(explorerPath, file);
					});
					navigationContainer.appendChild(sideNavFolder);

					//explorer folders
					span.innerHTML = '<img src="img/folder-icon.png" class="icon">' + file;
					navigationContainer.appendChild(span);
					//add event listener
					span.addEventListener('dblclick', function(e){
						updateLocation(explorerPath, file);
					});
				} else {
					span.innerHTML = '<img src="img/file-icon.png" class="icon">' + file;
				}

				explorerContainer.appendChild(span);
			});
		}, 0);
	});
}

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