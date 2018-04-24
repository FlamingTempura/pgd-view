// builds an offline version of the prototype
'use strict';

const Bluebird = require('bluebird');
const server = require('./server');
const fs = require('fs');
const fse = require('fs-extra');

let html;

fse.ensureDir('build')
	.then(() => Bluebird.all([
		fse.emptyDir('build'),
		fs.readFileAsync('client/index.html', 'utf8')
			.then(html_ => html = html_.replace('/style.css', 'style.css'))
	]))
	.then(() => Bluebird.all([
		fse.ensureDir('build/api/image'),
		server.buildStyles()
			.then(css => fs.writeFileAsync('build/style.css', css, 'utf8')),
		server.buildScripts()
			.then(js => {
				html = html.replace(/<script .*bundle.js.*><\/script>/, () => `<script>${js}</script>`); // use replace fn so $1 etc are not interpretted
			}),
		fse.copy('node_modules/material-design-icons/iconfont/MaterialIcons-Regular.eot', 'build/MaterialIcons-Regular.eot'),
		fse.copy('node_modules/material-design-icons/iconfont/MaterialIcons-Regular.ijmap', 'build/MaterialIcons-Regular.ijmap'),
		fse.copy('node_modules/material-design-icons/iconfont/MaterialIcons-Regular.svg', 'build/MaterialIcons-Regular.svg'),
		fse.copy('node_modules/material-design-icons/iconfont/MaterialIcons-Regular.ttf', 'build/MaterialIcons-Regular.ttf'),
		fse.copy('node_modules/material-design-icons/iconfont/MaterialIcons-Regular.woff', 'build/MaterialIcons-Regular.woff'),
		fse.copy('node_modules/material-design-icons/iconfont/MaterialIcons-Regular.woff2', 'build/MaterialIcons-Regular.woff2'),
		fse.copy('node_modules/typeface-hind-siliguri/files', 'build/files'),
		server.listPeople(true)
			.then(people => {
				let urls = {
					'/api/person': JSON.stringify(people)
				};
				let sources = [];
				return Bluebird
					.map(people, person => {
						return server.getPersonFilename(person.id)
							.then(filename => fs.readFileAsync(`people/${filename}`))
							.then(json => {
								let person = JSON.parse(json);
								person.sources.forEach(source => {
									if (!sources.find(s => s.id === source.id)) {
										sources.push(source);
									}
								});
								urls[`/api/person/${person.id}`] = json;
							});
					})
					.then(() => {
						return Bluebird.map(sources, s => Bluebird.all([
							server.pubmed(s.reviewQuery)
								.then(response => {
									urls[`/api/pubmed/${s.reviewQuery}`] = JSON.stringify(response);
								})
								.catch(err => {
									console.error(`failed on /api/pubmed/${s.reviewQuery}`);
									return {};
								}),
							server.image(s.name)
								.then(image => fs.writeFileAsync(`build/api/image/${s.name}.jpg`, image, 'binary'))
						]));
					})
					.then(() => {
						// override $.ajax to cache expected responses
						let js = `
							window.overrideAjax = $ => {
								let ajax = $.ajax;
								$.ajax = (options) => {
									console.log('qq', options);
									${Object.entries(urls).map(([url, data]) => `
										if (options.url === '${url}') {
											let dfd = $.Deferred();
											dfd.resolve(${data});
											return dfd.promise();
										}`
									).join('')}
									return ajax(options);
								};
							};
						`;
						html = `<script>${js}</script>${html}`;
					});
			})
	]))
	.then(() => {
		return fs.writeFileAsync('build/index.html', html, 'utf8');
	});
